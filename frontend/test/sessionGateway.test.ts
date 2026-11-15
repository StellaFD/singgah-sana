import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { sessionGateway } from '../src/lib/sessionGateway';

test('private gateway rejects unlisted endpoints and foreign mutations before contacting upstream', async () => {
  const original = globalThis.fetch;
  let contacted = false;
  globalThis.fetch = async () => { contacted = true; throw new Error('Unexpected upstream request'); };
  try {
    const forbiddenPath = await sessionGateway(new NextRequest('http://localhost:3000/api/private/unknown'), 'unknown');
    assert.equal(forbiddenPath.status, 404);
    const foreign = await sessionGateway(new NextRequest('http://localhost:3000/api/private/auth/login', {
      method: 'POST', headers: { Origin: 'https://foreign.test' }, body: '{}',
    }), 'auth/login');
    assert.equal(foreign.status, 403);
    assert.equal(contacted, false);
  } finally { globalThis.fetch = original; }
});

test('private gateway forwards only the session cookie and strips browser-supplied bearer and identity headers', async () => {
  const original = globalThis.fetch;
  let headers: Headers | undefined;
  globalThis.fetch = async (_url, options) => {
    headers = new Headers(options?.headers);
    return new Response(JSON.stringify({ success: true, data: {} }), { headers: {
      'Content-Type': 'application/json', 'Set-Cookie': 'ss.sid=new; Path=/; HttpOnly',
    } });
  };
  try {
    const result = await sessionGateway(new NextRequest('http://localhost:3000/api/private/auth/me', { headers: {
      Cookie: `other=private; ss.sid=${'a'.repeat(43)}`, Authorization: 'Bearer browser-value', 'X-User-Role': 'admin',
    } }), 'auth/me');
    assert.equal(result.status, 200);
    assert.equal(headers?.get('cookie'), `ss.sid=${'a'.repeat(43)}`);
    assert.equal(headers?.get('authorization'), null);
    assert.equal(headers?.get('x-user-role'), null);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.match(result.headers.get('set-cookie') || '', /HttpOnly/);
  } finally { globalThis.fetch = original; }
});
