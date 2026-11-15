import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sessionRequest, SessionError } from '../src/features/auth/sessionClient';

test('1. sessionRequest: Menormalkan method lowercase ke UPPERCASE dan mengelola CSRF', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method?: string; headers?: Record<string, string> }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headersObj: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => {
        headersObj[k.toLowerCase()] = v;
      });
    }
    calls.push({ url, method: init?.method, headers: headersObj });

    if (url === '/api/private/auth/csrf') {
      return new Response(JSON.stringify({ success: true, data: { csrf_token: 'test-token-xyz' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/private/kos') {
      return new Response(JSON.stringify({ success: true, data: { id: 'k1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  }) as unknown as typeof fetch;

  try {
    // Test lowercase 'post'
    const resPost = await sessionRequest<{ success: boolean; data: { id: string } }>('/kos', {
      method: 'post',
      body: JSON.stringify({ nama: 'Kos Melati' }),
    });

    assert.equal(resPost.success, true);
    assert.equal(resPost.data.id, 'k1');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, '/api/private/auth/csrf');
    assert.equal(calls[1].url, '/api/private/kos');
    assert.equal(calls[1].method, 'POST');
    assert.equal(calls[1].headers?.['x-csrf-token'], 'test-token-xyz');
    assert.equal(calls[1].headers?.['content-type'], 'application/json');

    // Test lowercase 'get'
    calls.length = 0;
    const resGet = await sessionRequest<{ success: boolean; data: { id: string } }>('/kos', {
      method: 'get',
    });
    assert.equal(resGet.success, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/private/kos');
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[0].headers?.['x-csrf-token'], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('2. sessionRequest: CSRF hang atau abort dilempar dan tidak ditelan', async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;

  try {
    // 2a. External abort saat CSRF fetch
    const controller = new AbortController();
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            const err = new DOMException('The operation was aborted', 'AbortError');
            reject(err);
          },
          { once: true }
        );
      });
    }) as unknown as typeof fetch;

    const promise = sessionRequest('/protected', { method: 'POST', signal: controller.signal });
    controller.abort();

    await assert.rejects(
      promise,
      (err: any) => err.name === 'AbortError' || err.name === 'TimeoutError'
    );

    // 2b. Mock timer/signal factory untuk timeout tanpa menunggu 15 detik nyata
    AbortSignal.timeout = (_ms: number) => {
      const c = new AbortController();
      c.abort(new DOMException('The operation timed out', 'TimeoutError'));
      return c.signal;
    };

    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(init.signal.reason);
          return;
        }
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    }) as unknown as typeof fetch;

    await assert.rejects(
      sessionRequest('/protected', { method: 'POST' }),
      (err: any) => err.name === 'TimeoutError' || err.name === 'AbortError'
    );
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  }
});

test('3. sessionRequest: Abort saat streaming/parsing payload JSON tidak ditelan', async () => {
  const originalFetch = globalThis.fetch;

  try {
    // 3a. Abort saat parsing response CSRF
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/private/auth/csrf') {
        return {
          ok: true,
          status: 200,
          json: async () => {
            const err = new DOMException('Body reading aborted', 'AbortError');
            throw err;
          },
        } as unknown as Response;
      }
      throw new Error(`Unexpected url: ${url}`);
    }) as unknown as typeof fetch;

    await assert.rejects(
      sessionRequest('/items', { method: 'POST' }),
      (err: any) => {
        assert.notEqual(err instanceof SessionError, true);
        return err.name === 'AbortError';
      }
    );

    // 3b. Abort saat parsing response utama
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/private/auth/csrf') {
        return new Response(JSON.stringify({ success: true, data: { csrf_token: 'csrf-123' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === '/api/private/items') {
        return {
          ok: true,
          status: 200,
          json: async () => {
            const err = new DOMException('Main body streaming aborted', 'AbortError');
            throw err;
          },
        } as unknown as Response;
      }
      throw new Error(`Unexpected url: ${url}`);
    }) as unknown as typeof fetch;

    await assert.rejects(
      sessionRequest('/items', { method: 'POST' }),
      (err: any) => {
        assert.notEqual(err instanceof SessionError, true);
        return err.name === 'AbortError';
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('4. sessionRequest: Malformed JSON atau gagal layanan menghasilkan SessionError terstruktur', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    })) as unknown as typeof fetch;

    await assert.rejects(
      sessionRequest('/profile'),
      (err: any) => {
        assert.ok(err instanceof SessionError);
        assert.equal(err.status, 200);
        assert.match(err.message, /Respons layanan tidak valid/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
