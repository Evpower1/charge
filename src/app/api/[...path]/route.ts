import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getDb, demoMode } from '@/lib/db';
import { currentUser, setSession, hashPassword, verifyPassword, safeUser, hashToken, requireAdmin, rateLimit, protectMutation, readBody } from '@/lib/server';
import { chapa } from '@/lib/chapa';
import { getWebsiteState,syncAnnouncement } from '@/lib/website-server';
import { safeImage } from '@/lib/website';
import type { Product, Order } from '@/lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const name = z.string().trim().min(2, 'Please enter at least 2 characters.').max(100);
const email = z.email('Please enter a valid email address.').max(200).transform(s => s.toLowerCase().trim());
const phone = z.string().trim().regex(/^\+?[\d\s()-]{9,22}$/, 'Please enter a valid phone number.');
const text = z.string().trim().min(3).max(500);
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
const itemsFor = (id: string) => getDb().prepare('SELECT product_id,name,quantity,price FROM order_items WHERE order_id = ?').all(id);
function orderFor(req: NextRequest, id: string) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return fail('Order not found.', 404);
  const user = currentUser(req);
  const token = req.nextUrl.searchParams.get('token');
  if (order.user_id !== user?.id && user?.role !== 'admin' && (!token || hashToken(token) !== order.guest_token)) fail('Please sign in or use the private link from your order confirmation.', 401);
  return order;
}
async function verifyPayment(tx: string) {
  const db = getDb();
  if (!/^[A-Za-z0-9-]{10,80}$/.test(tx)) fail('Invalid payment reference.');
  const order = db.prepare('SELECT * FROM orders WHERE tx_ref = ?').get(tx);
  if (!order) return fail('Order not found.', 404);
  if (order.payment_status === 'paid') return order;
  const result = await chapa(`transaction/verify/${encodeURIComponent(tx)}`);
  if (result.status !== 'success' || result.tx_ref !== tx || result.currency !== 'ETB' || Number(result.amount) !== Number(order.total)) return fail('Payment has not been confirmed. Please check again shortly.');
  db.prepare("UPDATE orders SET payment_status = 'paid', status = 'Confirmed' WHERE id = ? AND payment_status = 'pending'").run(order.id as string);
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id as string)!;
}
async function handle(req: NextRequest, parts: string[]) {
  const path = parts.join('/');
  const method = req.method;
  if (method !== 'GET') protectMutation(req);
  const db = getDb();
  if (method === 'GET' && path === 'catalog') return json({
    products: db.prepare('SELECT * FROM products').all(), stations: db.prepare('SELECT * FROM stations').all(),
    demo: demoMode, paymentsAvailable: !!process.env.CHAPA_SECRET_KEY,
    announcement:getWebsiteState(db).published.settings.announcement,site:getWebsiteState(db).published
  });
  if (method === 'GET' && path === 'session') return json({ user: currentUser(req), demo: demoMode });
  if (method === 'POST' && (path === 'auth/register' || path === 'auth/login')) {
    const input = z.object({ name: name.optional(), email, password: z.string().min(10, 'Use a password with at least 10 characters.').max(128) }).parse(await readBody(req));
    // Email and a global cap protect authentication without trusting a spoofable forwarded IP.
    rateLimit(`auth:${input.email}`, 12);
    rateLimit('auth:global', 250);
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(input.email);
    if (path === 'auth/register') {
      if (!input.name) fail('Please enter your name.');
      if (user) fail('An account with this email already exists. Try signing in.');
      const id = randomUUID();
      db.prepare('INSERT INTO users (id,name,email,password) VALUES (?,?,?,?)').run(id, input.name!, input.email, hashPassword(input.password));
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } else {
      // Execute the same password derivation for nonexistent accounts.
      const valid = verifyPassword(input.password, (user?.password as string) || '0123456789abcdef0123456789abcdef:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000');
      if (!user || !valid) fail('Email or password is incorrect.', 401);
    }
    const res = json({ user: safeUser(user!) });
    setSession(res, user!.id as string);
    return res;
  }
  if (method === 'POST' && path === 'auth/logout') {
    const token = req.cookies.get('evpower_session')?.value;
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(hashToken(token));
    const res = json({ ok: true });
    res.cookies.delete('evpower_session');
    return res;
  }
  if (path === 'account' || path === 'account/addresses') {
    const user = currentUser(req);
    if (!user) return fail('Please sign in to continue.', 401);
    if (method === 'GET') {
      const orders = db.prepare('SELECT id,name,email,phone,city,address,subtotal,delivery,installation,total,status,payment_status,created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id).map(o => ({ ...o, items: itemsFor(o.id as string) }));
      return json({ user, orders, addresses: db.prepare('SELECT id,label,city,address,phone FROM addresses WHERE user_id = ?').all(user.id), bookings: db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(user.id) });
    }
    if (method === 'PUT') {
      const data = z.object({ name, phone: phone.or(z.literal('')) }).parse(await readBody(req));
      db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(data.name, data.phone, user.id);
      return json({ ok: true });
    }
    if (method === 'POST' && path === 'account/addresses') {
      const data = z.object({ label: name, city: z.enum(['Addis Ababa', 'Adama']), address: text, phone }).parse(await readBody(req));
      if (Number(db.prepare('SELECT count(*) AS n FROM addresses WHERE user_id = ?').get(user.id)?.n) >= 10) fail('You can save up to 10 addresses.');
      db.prepare('INSERT INTO addresses VALUES (?,?,?,?,?,?)').run(randomUUID(), user.id, data.label, data.city, data.address, data.phone);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const data = z.object({ id: z.string() }).parse(await readBody(req));
      db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(data.id, user.id);
      return json({ ok: true });
    }
  }
  if (method === 'POST' && path === 'orders') {
    const input = z.object({ name, email, phone, city: z.enum(['Addis Ababa', 'Adama']), address: text, installation: z.boolean(), items: z.array(z.object({ productId: z.string().max(80), quantity: z.number().int().min(1).max(20) })).min(1).max(30) }).parse(await readBody(req));
    rateLimit(`order:${input.email}`, 10);
    if (!process.env.CHAPA_SECRET_KEY && !demoMode) fail(`Online checkout is not available yet. Please call ${getWebsiteState(db).published.settings.tollFree} to place an order.`, 503);
    const combined = new Map<string, number>();
    for (const i of input.items) combined.set(i.productId, (combined.get(i.productId) || 0) + i.quantity);
    const items = [...combined].map(([id, quantity]) => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
      if (!product || quantity > 20 || product.stock < quantity) return fail(`${product?.name || 'A product'} is not available in the requested quantity.`);
      return { ...product, quantity };
    });
    const subtotal = items.reduce((s, p) => s + p.price * p.quantity, 0);
    if (input.installation && !items.some(p => p.category === 'Home chargers' || p.category === 'Business chargers')) fail('Installation is available with a wallbox or business charger.');
    const delivery = subtotal >= 25000 ? 0 : 250;
    const installation = input.installation ? 3500 : 0;
    const total = subtotal + delivery + installation;
    const id = `EVP-${randomBytes(5).toString('hex').toUpperCase()}`;
    const guestToken = randomBytes(32).toString('hex');
    const user = currentUser(req);
    const isDemo = !process.env.CHAPA_SECRET_KEY && demoMode;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO orders (id,user_id,guest_token,name,email,phone,city,address,subtotal,delivery,installation,total,status,payment_status,tx_ref) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, user?.id || null, hashToken(guestToken), input.name, input.email, input.phone, input.city, input.address, subtotal, delivery, installation, total, isDemo ? 'Demo order' : 'Awaiting payment', isDemo ? 'demo' : 'pending', id);
      for (const p of items) {
        const result = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(p.quantity, p.id, p.quantity);
        if (result.changes !== 1) fail('Stock changed while checking out. Please refresh your cart.');
        db.prepare('INSERT INTO order_items (order_id,product_id,name,quantity,price) VALUES (?,?,?,?,?)').run(id, p.id, p.name, p.quantity, p.price);
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    if (isDemo) return json({ id, guestToken, demo: true });
    try {
      const base = process.env.APP_URL || req.nextUrl.origin;
      if (!base.startsWith('https://') && process.env.NODE_ENV === 'production') fail('A secure production application URL is required for payments.', 503);
      const payment = await chapa('transaction/initialize', { amount: String(total), currency: 'ETB', email: input.email, first_name: input.name.split(' ')[0], last_name: input.name.split(' ').slice(1).join(' ') || input.name, tx_ref: id, callback_url: `${base}/api/payments/verify?tx_ref=${id}`, return_url: `${base}/checkout?reference=${id}`, customization: { title: 'Evpower order', description: `Order ${id}` } });
      const url = new URL(payment.checkout_url);
      if (url.protocol !== 'https:' || !(url.hostname === 'chapa.co' || url.hostname.endsWith('.chapa.co'))) fail('The payment provider returned an invalid checkout address.', 502);
      return json({ id, guestToken, checkoutUrl: url.href });
    } catch (e) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare("UPDATE orders SET status = 'Payment initialization failed', payment_status = 'failed' WHERE id = ?").run(id);
        for (const p of items) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(p.quantity, p.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      throw e;
    }
  }
  if (method === 'GET' && parts[0] === 'orders' && parts[1]) {
    const order = orderFor(req, parts[1]);
    if (parts[2] === 'invoice') {
      const brand=getWebsiteState(db).published.settings;
      if (order.payment_status !== 'paid' && order.payment_status !== 'demo') fail('Invoices are available after payment is confirmed.');
      const escape = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
      const items = itemsFor(order.id as string);
      return new NextResponse(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escape(brand.companyName)} invoice ${escape(order.id)}</title><style>body{font:15px Arial;color:#172937;max-width:760px;margin:60px auto;padding:24px}h1{font-size:32px}table{width:100%;border-collapse:collapse;margin:32px 0}td,th{text-align:left;padding:15px;border-bottom:1px solid #ddd}button{background:#173f3c;color:white;padding:12px 20px;border:0;border-radius:8px;cursor:pointer}.muted{color:#667570}@media print{button{display:none}}</style></head><body><h1>${escape(brand.logoText)}<span style="color:#81ad19">.</span></h1><p>${order.payment_status === 'demo' ? '<strong>DEMO INVOICE — no payment collected; not a tax invoice</strong>' : 'Payment receipt — not a tax invoice'}</p><h2>${escape(order.id)}</h2><p class="muted">${escape(order.created_at)}</p><p>${escape(order.name)}<br>${escape(order.email)}<br>${escape(order.address)}, ${escape(order.city)}</p><table><thead><tr><th>Item</th><th>Qty</th><th>ETB</th></tr></thead><tbody>${items.map(i => `<tr><td>${escape(i.name)}</td><td>${escape(i.quantity)}</td><td>${Number(i.price) * Number(i.quantity)}</td></tr>`).join('')}<tr><td>Delivery</td><td></td><td>${Number(order.delivery)}</td></tr><tr><td>Installation</td><td></td><td>${Number(order.installation)}</td></tr><tr><th>Total (ETB)</th><td></td><th>${Number(order.total)}</th></tr></tbody></table><p>Thank you for choosing a cleaner journey. Contact us: ${escape(brand.tollFree)} / ${escape(brand.phoneDisplay)}</p><button onclick="window.print()">Print / save as PDF</button></body></html>`, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
    }
    const { guest_token: _guest, ...clean } = order;
    return json({ ...clean, items: itemsFor(order.id as string) });
  }
  if (method === 'GET' && path === 'payments/verify') {
    const order = await verifyPayment(req.nextUrl.searchParams.get('tx_ref') || '');
    return json({ id: order.id, payment_status: order.payment_status });
  }
  if (method === 'POST' && path === 'bookings') {
    const input = z.object({ name, email, phone, service: z.enum(['Mobile EV Charging', 'Fleet Charging Solutions', 'EV Charger Installation', 'EV Maintenance']), date: z.iso.date(), time: z.enum(['09:00–11:00', '11:00–13:00', '14:00–16:00', '16:00–18:00']), location: text, connector: z.enum(['Type 2', 'CCS2', 'GB/T', 'Not sure']), notes: z.string().max(1500).default('') }).parse(await readBody(req));
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(new Date());
    if (input.date <= today || input.date > new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)) fail('Please select a date from tomorrow up to 90 days ahead.');
    rateLimit(`booking:${input.email}`, 10);
    const id = `BK-${randomBytes(4).toString('hex').toUpperCase()}`;
    db.prepare('INSERT INTO bookings (id,user_id,name,email,phone,service,date,time,location,connector,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id, currentUser(req)?.id || null, input.name, input.email, input.phone, input.service, input.date, input.time, input.location, input.connector, input.notes);
    return json({ id, message: 'Booking requested. Our team will call to confirm availability.' });
  }
  if (method === 'POST' && path === 'contact') {
    const input = z.object({ name, email, topic: z.enum(['General enquiry', 'Charging support', 'Business partnership', 'Product & installation', 'Fleet solutions']), message: z.string().trim().min(10, 'Please add a little more detail (at least 10 characters).').max(3000), website: z.string().max(0).optional() }).parse(await readBody(req));
    rateLimit(`contact:${input.email}`, 5);
    const id = randomUUID();
    db.prepare('INSERT INTO enquiries (id,name,email,topic,message) VALUES (?,?,?,?,?)').run(id, input.name, input.email, input.topic, input.message);
    return json({ ok: true });
  }
  if (parts[0] === 'admin') {
    requireAdmin(req);
    if (method === 'GET') {
      return json({ products: db.prepare('SELECT * FROM products').all(), stations: db.prepare('SELECT * FROM stations').all(), orders: db.prepare('SELECT id,name,email,total,status,payment_status,created_at FROM orders ORDER BY created_at DESC LIMIT 500').all(), customers: db.prepare('SELECT id,name,email,phone,created_at,role FROM users ORDER BY created_at DESC LIMIT 500').all(), bookings: db.prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 500').all(), enquiries: db.prepare('SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 500').all(), content: db.prepare('SELECT * FROM content').all(), demo: demoMode });
    }
    if (method === 'PUT' && path === 'admin/products') {
      const p = z.object({ id: z.string().min(1).max(80), name, category: z.enum(['Home chargers', 'Portable chargers', 'Business chargers', 'Accessories']), price: z.number().int().min(1).max(10000000), stock: z.number().int().min(0).max(100000), description: z.string().min(10).max(2000), power: z.string().max(50), connector: z.string().max(50), image_url:z.string().refine(safeImage).default('') }).parse(await readBody(req));
      db.prepare("INSERT INTO products (id,name,category,price,stock,description,power,connector,color,image_url) VALUES (?,?,?,?,?,?,?,?,'white',?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,price=excluded.price,stock=excluded.stock,description=excluded.description,power=excluded.power,connector=excluded.connector,image_url=excluded.image_url").run(p.id, p.name, p.category, p.price, p.stock, p.description, p.power, p.connector,p.image_url);
      return json({ ok: true });
    }
    if (method === 'PUT' && path === 'admin/stations') {
      const p = z.object({ id: z.string().min(1).max(80), name, city: z.enum(['Addis Ababa', 'Adama']), area: name, lat: z.number().min(3).max(15), lng: z.number().min(33).max(48), power: z.string().min(1).max(50), connectors: z.string().min(1).max(100), hours: z.string().min(1).max(100), verified: z.boolean(), source_url: z.url().or(z.literal('')), status: z.enum(['Available', 'Busy', 'Offline', 'Planned']) }).parse(await readBody(req));
      if (p.verified && (!p.source_url.startsWith('https://') || p.status === 'Planned')) fail('Verified stations require an HTTPS evidence source and an operational status.');
      db.prepare('INSERT INTO stations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,city=excluded.city,area=excluded.area,lat=excluded.lat,lng=excluded.lng,power=excluded.power,connectors=excluded.connectors,hours=excluded.hours,verified=excluded.verified,source_url=excluded.source_url,verified_at=excluded.verified_at,status=excluded.status').run(p.id, p.name, p.city, p.area, p.lat, p.lng, p.power, p.connectors, p.hours, p.verified ? 1 : 0, p.source_url, p.verified ? new Date().toISOString() : '', p.status);
      return json({ ok: true });
    }
    if (method === 'PUT' && path === 'admin/orders') {
      const p = z.object({ id: z.string(), status: z.enum(['Confirmed', 'Preparing', 'Out for delivery', 'Delivered']) }).parse(await readBody(req));
      const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(p.id);
      if (!o || (o.payment_status !== 'paid' && o.payment_status !== 'demo')) fail('Only paid or demo orders can be fulfilled.');
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(p.status, p.id);
      return json({ ok: true });
    }
    if (method === 'PUT' && path === 'admin/bookings') {
      const p = z.object({ id: z.string(), status: z.enum(['Requested', 'Confirmed', 'Completed', 'Cancelled']) }).parse(await readBody(req));
      db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(p.status, p.id);
      return json({ ok: true });
    }
    if (method === 'PUT' && path === 'admin/content') {
      const p = z.object({ announcement: z.string().trim().min(3).max(120) }).parse(await readBody(req));
      syncAnnouncement(db,p.announcement);
      return json({ ok: true });
    }
    if (method === 'PUT' && path === 'admin/customers') {
      const p = z.object({ id: z.string(), name, phone: phone.or(z.literal('')) }).parse(await readBody(req));
      db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(p.name, p.phone, p.id);
      return json({ ok: true });
    }
  }
  return fail('This page could not be found.', 404);
}
async function route(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try { return await handle(req, (await context.params).path); }
  catch (err) {
    if (err instanceof z.ZodError) return json({ error: err.issues[0]?.message || 'Please check your details.' }, 400);
    if (err instanceof SyntaxError) return json({ error: 'Please provide valid form data.' }, 400);
    const e = err as Error & { status?: number };
    if (e.status) return json({ error: e.message }, e.status);
    console.error('Request failed:', e.name, e.message.replace(/Bearer\s+\S+/g, '[redacted]'));
    return json({ error: 'We could not complete that request. Please try again or call 8890.' }, 500);
  }
}
export { route as GET, route as POST, route as PUT, route as DELETE };
