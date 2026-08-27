import './setup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

// These exercise the HTTP layer only — routing, auth, validation and error shaping.
// They do not touch the database, so no controller body runs.
const { createApp } = await import('../dist/app.js');

const server = createApp().listen(0);
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
};

test.after(() => server.close());

test('health check', async () => {
  const res = await call('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('unknown routes return a safe 404', async () => {
  const res = await call('GET', '/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
  assert.equal(typeof res.body.error.message, 'string');
  assert.equal(res.body.error.stack, undefined);
});

test('protected routes reject anonymous callers', async (t) => {
  for (const path of [
    '/api/posts',
    '/api/notices',
    '/api/events',
    '/api/jobs',
    '/api/dashboard',
    '/api/bookmarks',
    '/api/users',
  ]) {
    await t.test(`${path} returns 401`, async () => {
      assert.equal((await call('GET', path)).status, 401);
    });
  }
});

test('a forged bearer token is rejected', async () => {
  const res = await fetch(`${base}/api/posts`, { headers: { Authorization: 'Bearer not.a.real.token' } });
  assert.equal(res.status, 401);
});

test('refresh without a session cookie is rejected', async () => {
  assert.equal((await call('POST', '/api/auth/refresh')).status, 401);
});

test('validation errors name the offending field', async () => {
  const res = await call('POST', '/api/auth/login', { email: 'nope', password: '' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'bad_request');
  assert.ok(res.body.error.details.email, 'expected a field-level message for email');
});

test('registration rejects incomplete input', async () => {
  assert.equal((await call('POST', '/api/auth/register', { name: 'A' })).status, 400);
});

test('security headers are set', async (t) => {
  const res = await fetch(`${base}/api/health`);
  await t.test('content sniffing is disabled', () =>
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff'),
  );
  await t.test('the framework is not advertised', () => assert.equal(res.headers.get('x-powered-by'), null));
  await t.test('clickjacking protection is on', () => assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN'));
});

test('rate limiting covers the API but not the liveness probe', async (t) => {
  // The health route is registered before the limiter so a monitoring system
  // polling it can never exhaust the budget for real traffic.
  await t.test('the probe is not rate limited', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.headers.get('ratelimit-policy'), null);
  });
  await t.test('API routes advertise a policy', async () => {
    const res = await fetch(`${base}/api/posts`);
    assert.ok(res.headers.get('ratelimit-policy'));
  });
  await t.test('credential routes use a tighter budget than the API', async () => {
    const api = await fetch(`${base}/api/posts`);
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.co', password: 'x' }),
    });
    const budget = (h) => Number(h.get('ratelimit-policy').split(';')[0]);
    assert.ok(budget(login.headers) < budget(api.headers));
  });
});
