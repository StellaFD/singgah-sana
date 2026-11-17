import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountApi } from '../src/modules/account/features/account/api';
import { authApi } from '../src/modules/account/features/auth/api';

test('accountApi.deleteAccount sends payload directly without nested body wrapper', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method?: string; body?: string }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : undefined,
    });

    if (url === '/api/private/auth/csrf') {
      return new Response(JSON.stringify({ success: true, data: { csrf_token: 'csrf-123' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === '/api/private/auth/me') {
      return new Response(JSON.stringify({ success: true, message: 'Akun dihapus', data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  }) as unknown as typeof fetch;

  try {
    await accountApi.deleteAccount({ password: 'Password123!', konfirmasi: 'HAPUS' });
    const deleteCall = calls.find((c) => c.method === 'DELETE');
    assert.ok(deleteCall, 'Must issue a DELETE request');
    assert.equal(deleteCall?.url, '/api/private/auth/me');
    const parsedBody = JSON.parse(deleteCall?.body || '{}');
    // Must NOT be { body: { password: ... } }
    assert.equal(parsedBody.password, 'Password123!');
    assert.equal(parsedBody.konfirmasi, 'HAPUS');
    assert.equal(parsedBody.body, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('authApi.googleAuth handles NEED_PASSWORD_LINK, NEED_ROLE, and SUCCESS branches', async () => {
  const originalFetch = globalThis.fetch;
  let mockResponse = {};

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/private/auth/csrf') {
      return new Response(JSON.stringify({ success: true, data: { csrf_token: 'csrf-456' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url === '/api/private/auth/google') {
      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as unknown as typeof fetch;

  try {
    // 1. NEED_PASSWORD_LINK
    mockResponse = {
      success: true,
      code: 'NEED_PASSWORD_LINK',
      message: 'Masukkan kata sandi akun',
      data: { email: 'user@example.com', nama: 'User', foto_profil: '' },
    };
    const res1 = await authApi.googleAuth({ credential: 'token-cred' });
    assert.equal(res1.type, 'need_password_link');
    if (res1.type === 'need_password_link') {
      assert.equal(res1.data.email, 'user@example.com');
      assert.equal(res1.data.nama, 'User');
    }

    // 2. NEED_ROLE
    mockResponse = {
      success: true,
      code: 'NEED_ROLE',
      message: 'Pilih role akun',
      data: { email: 'new@example.com', nama: 'New User', foto_profil: '' },
    };
    const res2 = await authApi.googleAuth({ credential: 'token-cred' });
    assert.equal(res2.type, 'need_role');
    if (res2.type === 'need_role') {
      assert.equal(res2.data.email, 'new@example.com');
      assert.equal(res2.data.nama, 'New User');
    }

    // 3. SUCCESS
    mockResponse = {
      success: true,
      message: 'Berhasil login',
      data: {
        _id: 'u-123',
        nama: 'Logged User',
        email: 'logged@example.com',
        role: 'pencari',
        status: 'active',
        foto_profil: '',
        nomor_telepon: '08123456789',
        has_password: true,
        is_google: true,
      },
    };
    const res3 = await authApi.googleAuth({ credential: 'token-cred', role: 'pencari' });
    assert.equal(res3.type, 'success');
    if (res3.type === 'success') {
      assert.equal(res3.user.id, 'u-123');
      assert.equal(res3.user.nama, 'Logged User');
      assert.equal(res3.user.role, 'pencari');
      assert.equal(res3.user.hasPassword, true);
      assert.equal(res3.user.isGoogle, true);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
