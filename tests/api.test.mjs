import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_BASE_URL || 'http://localhost:3001';
const secureBase = process.env.TEST_SECURE_URL || 'http://localhost:3002';
const email = `test-${randomUUID()}@example.com`;
const password = `Test-only-${randomUUID()}`;
let cookie = '';
let guestOrder;
async function request(path, body, { method = body ? 'POST' : 'GET', session = '', origin = base, host = base } = {}) {
  const res = await fetch(`${host}/api/${path}`, { method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(session ? { Cookie: session } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  return { res, data };
}
test('catalogue is usable and unverified sample stations are never presented as verified', async () => {
  const { res, data } = await request('catalog');
  assert.equal(res.status, 200);
  assert.ok(data.products.length >= 6);
  assert.ok(data.stations.some(s => s.city === 'Adama'));
  assert.ok(data.stations.every(s => s.verified === 0));
  assert.equal(data.demo, true);
});
test('cross-origin mutations and oversized requests are rejected', async () => {
  const rejected = await request('auth/register', { name: 'Test User', email, password }, { origin: 'https://untrusted.example' });
  assert.equal(rejected.res.status, 403);
  const oversized = await request('contact', { message: 'x'.repeat(40000) });
  assert.equal(oversized.res.status, 413);
});
test('account registration uses protected cookies and does not expose password hashes', async () => {
  const { res, data } = await request('auth/register', { name: 'Test Driver', email, password, role: 'admin' });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);
  cookie = setCookie.split(';')[0];
  assert.equal(data.user.email, email);
  assert.equal(data.user.role, 'customer');
  assert.equal(data.user.password, undefined);
  assert.equal((await request('account')).res.status, 401);
  const account = await request('account', undefined, { session: cookie });
  assert.equal(account.data.user.email, email);
});
test('sign-in checks passwords and profile/address updates stay in the user account', async () => {
  assert.equal((await request('auth/login', { email, password: 'wrong-password-123' })).res.status, 401);
  assert.equal((await request('auth/login', { email, password })).res.status, 200);
  assert.equal((await request('account', { name: 'Updated Driver', phone: '+251911000000' }, { method: 'PUT', session: cookie })).res.status, 200);
  assert.equal((await request('account/addresses', { label: 'Home', city: 'Addis Ababa', address: 'Bole, near the test landmark', phone: '+251911000000' }, { session: cookie })).res.status, 200);
  const { data } = await request('account', undefined, { session: cookie });
  assert.equal(data.user.name, 'Updated Driver');
  assert.equal(data.addresses.length, 1);
});
test('server validates stock and computes totals without trusting a client price', async () => {
  const customer = { name: 'Guest Driver', email: `guest-${randomUUID()}@example.com`, phone: '+251911000000', city: 'Adama', address: 'Test address, central Adama', installation: false };
  const before = (await request('catalog')).data.products.find(p => p.id === 'home-7');
  const invalid = await request('orders', { ...customer, items: [{ productId: 'home-7', quantity: 999 }] });
  assert.equal(invalid.res.status, 400);
  const { res, data } = await request('orders', { ...customer, items: [{ productId: 'home-7', quantity: 1, price: 1 }], total: 1 });
  assert.equal(res.status, 200);
  assert.equal(data.demo, true);
  guestOrder = data;
  const receipt = await request(`orders/${data.id}?token=${data.guestToken}`);
  assert.equal(receipt.data.total, before.price);
  assert.equal(receipt.data.payment_status, 'demo');
  assert.equal(receipt.data.guest_token, undefined);
  const after = (await request('catalog')).data.products.find(p => p.id === 'home-7');
  assert.equal(after.stock, before.stock - 1);
});
test('guest receipts require a private token and invoices identify demo orders', async () => {
  assert.equal((await request(`orders/${guestOrder.id}`)).res.status, 401);
  assert.equal((await request(`orders/${guestOrder.id}`, undefined, { session: cookie })).res.status, 401);
  const invoice = await fetch(`${base}/api/orders/${guestOrder.id}/invoice?token=${guestOrder.guestToken}`);
  assert.equal(invoice.status, 200);
  assert.match(await invoice.text(), /DEMO INVOICE/);
});
test('authenticated orders are visible in purchase history', async () => {
  const { data } = await request('orders', { name: 'Test Driver', email, phone: '+251911000000', city: 'Addis Ababa', address: 'Test landmark', installation: false, items: [{ productId: 'cable', quantity: 1 }] }, { session: cookie });
  const account = (await request('account', undefined, { session: cookie })).data;
  assert.ok(account.orders.some(o => o.id === data.id));
  assert.equal(account.orders[0].delivery, 250);
});
test('booking rejects past dates and stores a valid request without claiming confirmation', async () => {
  const booking = { name: 'Test Driver', email, phone: '+251911000000', service: 'Mobile EV Charging', date: '2020-01-01', time: '09:00–11:00', location: 'Bole test landmark', connector: 'Type 2', notes: '' };
  assert.equal((await request('bookings', booking)).res.status, 400);
  booking.date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const { res, data } = await request('bookings', booking, { session: cookie });
  assert.equal(res.status, 200);
  assert.match(data.id, /^BK-/);
  const account = (await request('account', undefined, { session: cookie })).data;
  assert.equal(account.bookings[0].status, 'Requested');
});
test('contact enquiries persist and invalid station verification is rejected', async () => {
  assert.equal((await request('contact', { name: 'Test Partner', email, topic: 'Business partnership', message: 'We would like to discuss a charging partnership.', website: '' })).res.status, 200);
  const admin = (await request('admin')).data;
  assert.ok(admin.enquiries.some(e => e.email === email));
  const sample = admin.stations[0];
  assert.equal((await request('admin/stations', { ...sample, verified: true, source_url: '', status: 'Available' }, { method: 'PUT' })).res.status, 400);
});
test('production mode denies anonymous administration and disables unconfigured live payments', async () => {
  const admin = await request('admin', undefined, { host: secureBase, origin: secureBase });
  assert.equal(admin.res.status, 403);
  const order = await request('orders', { name: 'Test Driver', email, phone: '+251911000000', city: 'Addis Ababa', address: 'Test address', installation: false, items: [{ productId: 'cable', quantity: 1 }] }, { host: secureBase, origin: secureBase });
  assert.equal(order.res.status, 503);
  assert.equal((await request('catalog', undefined, { host: secureBase })).data.paymentsAvailable, false);
  const customer = await request('auth/register', { name: 'Secure Test Driver', email: `secure-${randomUUID()}@example.com`, password, role: 'admin' }, { host: secureBase, origin: secureBase });
  assert.equal(customer.res.status, 200);
  assert.equal(customer.data.user.role, 'customer');
  const customerCookie = customer.res.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('admin', undefined, { host: secureBase, origin: secureBase, session: customerCookie })).res.status, 403);
  assert.equal((await request('admin/content', { announcement: 'Unauthorised edit' }, { host: secureBase, origin: secureBase, session: customerCookie, method: 'PUT' })).res.status, 403);
});
test('logout revokes the stored session', async () => {
  const { res } = await request('auth/logout', {}, { session: cookie });
  assert.equal(res.status, 200);
  assert.equal((await request('account', undefined, { session: cookie })).res.status, 401);
});
