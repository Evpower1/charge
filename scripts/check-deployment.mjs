import assert from 'node:assert/strict';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/check-deployment.mjs https://your-domain');
  process.exit(1);
}
const target = new URL(input);
if (target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
  throw new Error('Supply only the site origin, without credentials, paths, or query parameters.');
}
const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
assert.ok(target.protocol === 'https:' || (local && target.protocol === 'http:'), 'A public deployment requires HTTPS.');
async function read(path) {
  return fetch(new URL(path, target), { redirect: 'error', signal: AbortSignal.timeout(15000) });
}
try {
  for (const path of ['/', '/services', '/locations', '/shop', '/about', '/contact', '/account']) {
    const response = await read(path);
    assert.equal(response.status, 200, `${path} must respond successfully`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', 'Missing content-type security header');
    assert.equal(response.headers.get('x-frame-options'), 'DENY', 'Missing framing protection');
    const csp = response.headers.get('content-security-policy') || '';
    assert.ok(csp.includes("frame-ancestors 'none'"), 'Missing frame-ancestor policy');
    assert.ok(!csp.includes('unsafe-eval'), 'Development script policy detected on a production deployment');
    const html = await response.text();
    assert.ok(html.includes('<h1'), `${path} is missing its main heading`);
    console.log(`PASS ${path}`);
  }
  const catalog = await read('/api/catalog');
  assert.equal(catalog.status, 200);
  const data = await catalog.json();
  assert.equal(data.demo, false, 'Public demo mode must be disabled before deployment');
  assert.ok(Array.isArray(data.products) && data.products.length > 0, 'Catalogue is unavailable');
  const session = await read('/api/session');
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user, null, 'An anonymous request unexpectedly received a session');
  const admin = await read('/api/admin');
  assert.equal(admin.status, 403, 'Anonymous administration is not blocked');
  console.log('PASS catalogue, production mode, anonymous session, and administration protection');
  console.log(`Payment provider: ${data.paymentsAvailable ? 'configured; transaction verification still required' : 'not configured; checkout remains disabled'}`);
  console.log('Read-only deployment checks passed.');
} catch (error) {
  console.error(`Deployment check failed: ${error.message}`);
  process.exitCode = 1;
}
