import test from 'node:test';
import assert from 'node:assert/strict';
import middleware from '../middleware.js';
test('QR pages and assets bypass the SPA shell', async () => {
  const saved = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected shell fetch'); };
  try {
    for (const path of ['/qrcity', '/qrcity/', '/qrarena', '/qrarena/', '/qr-reveals/city/city.mjs']) {
      const response = await middleware(new Request('https://www.betweenthelineshockey.com' + path, { headers: { accept: 'text/html' } }));
      assert.equal(response.headers.get('x-middleware-next'), '1', path);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = saved; }
});
