import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchKosListFromBackend,
  fetchKosMapFromBackend,
  fetchKosDetailFromBackend,
} from '../src/lib/backendClient';

import {
  formatRupiah,
  formatDate,
} from '../src/lib/formatters';

test('1. Formatters: formatRupiah dan formatDate menangani edge cases dengan aman', () => {
  assert.equal(formatRupiah(0), 'Rp\u00a00');
  assert.equal(formatRupiah(1500000), 'Rp\u00a01.500.000');
  assert.equal(formatRupiah(null), 'Rp 0');
  assert.equal(formatRupiah(undefined), 'Rp 0');
  assert.equal(formatRupiah('invalid'), 'Rp 0');
  assert.equal(formatRupiah(NaN), 'Rp 0');

  assert.equal(formatDate(null), '-');
  assert.equal(formatDate(undefined), '-');
  assert.equal(formatDate('invalid-date'), '-');
  assert.equal(typeof formatDate('2026-11-15T08:00:00.000Z'), 'string');
});

test('2. Backend Client: Penanganan error koneksi saat backend tidak dapat dihubungi', async () => {
  process.env.API_BASE_URL = 'http://127.0.0.1:59999/api';

  const listRes = await fetchKosListFromBackend({});
  assert.equal(listRes.success, false);
  assert.equal(listRes.isNetworkError, true);
  assert.deepEqual(listRes.data, []);

  const mapRes = await fetchKosMapFromBackend({});
  assert.equal(mapRes.success, false);
  assert.equal(mapRes.isNetworkError, true);
  assert.deepEqual(mapRes.data, []);

  const detailRes = await fetchKosDetailFromBackend('507f1f77bcf86cd799439011');
  assert.equal(detailRes.success, false);
  assert.equal(detailRes.isNetworkError, true);

  delete process.env.API_BASE_URL;
});

test('3. Backend Client: Penanganan AbortSignal untuk pembatalan request', async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    fetchKosListFromBackend({}, { signal: controller.signal }),
    { name: 'AbortError' }
  );

  await assert.rejects(
    fetchKosMapFromBackend({}, { signal: controller.signal }),
    { name: 'AbortError' }
  );

  await assert.rejects(
    fetchKosDetailFromBackend('507f1f77bcf86cd799439011', { signal: controller.signal }),
    { name: 'AbortError' }
  );
});

test('4. Backend Client: Parsing pagination backend aktual {totalData, totalPages, currentPage, limit}', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: [
        {
          _id: '507f1f77bcf86cd799439099',
          nama: 'Kos UGM Paginated',
          harga_per_bulan: 1500000,
          tipe: 'putra',
          status_verifikasi: 'approved',
        },
      ],
      pagination: {
        totalData: 42,
        totalPages: 6,
        currentPage: 2,
        limit: 8,
      },
    }),
  })) as unknown as typeof fetch;

  try {
    const res = await fetchKosListFromBackend({ page: 2, limit: 8 });

    assert.equal(res.success, true);
    assert.equal(res.totalCount, 42);
    assert.equal(res.totalPages, 6);
    assert.equal(res.page, 2);
    assert.equal(res.perPage, 8);

    assert.ok(res.pagination);
    assert.equal(res.pagination.totalData, 42);
    assert.equal(res.pagination.totalPages, 6);
    assert.equal(res.pagination.currentPage, 2);
    assert.equal(res.pagination.limit, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('5. Backend Client: Timeout mengikat pembacaan payload JSON streaming', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_url: string, { signal }: { signal: AbortSignal }) => ({
    ok: true,
    status: 200,
    json: () =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            const err = new Error('Body streaming aborted');
            err.name = 'AbortError';
            reject(err);
          },
          { once: true }
        );
      }),
  })) as unknown as typeof fetch;

  try {
    const res = await fetchKosListFromBackend({}, { timeoutMs: 50 });
    assert.equal(res.success, false);
    assert.equal(res.isNetworkError, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('6. Backend Client: External AbortSignal membatalkan request DURING body reading (rethrow AbortError)', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();

  globalThis.fetch = (async (_url: string, { signal }: { signal: AbortSignal }) => {
    setTimeout(() => {
      controller.abort();
    }, 20);

    return {
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              const err = new Error('Body reading aborted externally');
              err.name = 'AbortError';
              reject(err);
            },
            { once: true }
          );
        }),
    };
  }) as unknown as typeof fetch;

  try {
    await assert.rejects(
      fetchKosListFromBackend({}, { signal: controller.signal }),
      { name: 'AbortError' }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('7. Backend Client: Respons HTTP 200 dengan malformed/invalid JSON menghasilkan failure upstream error (bukan success)', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  })) as unknown as typeof fetch;

  try {
    const res = await fetchKosListFromBackend({});
    assert.equal(res.success, false);
    assert.equal(res.data?.length, 0);
    assert.match(res.error || '', /upstream/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('8. Backend Client: Respons HTTP 200 dengan payload { success: false, message: ... } diproses sebagai failure', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: false,
      message: 'Parameter query tidak valid pada upstream backend.',
    }),
  })) as unknown as typeof fetch;

  try {
    const res = await fetchKosListFromBackend({});
    assert.equal(res.success, false);
    assert.match(res.error || '', /upstream/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
