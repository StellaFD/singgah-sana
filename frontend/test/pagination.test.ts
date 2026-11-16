import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPages } from '../src/lib/pagination';

test('Owner collection includes later pages and deduplicates overlapping rows', async () => {
  const visited: number[] = [];
  const result = await collectPages(async (page) => {
    visited.push(page);
    return { data: page === 1 ? [{ _id: 'a' }, { _id: 'b' }] : [{ _id: 'b' }, { _id: 'c' }],
      pagination: { currentPage: page, totalPages: 2 } };
  });
  assert.deepEqual(visited, [1, 2]);
  assert.deepEqual(result.map(item => item._id), ['a', 'b', 'c']);
});

test('Later-page failure never becomes successful partial owner data', async () => {
  await assert.rejects(collectPages(async page => {
    if (page === 2) throw new Error('Layanan tidak tersedia');
    return { data: [{ _id: 'a' }], pagination: { currentPage: page, totalPages: 2 } };
  }), /Layanan tidak tersedia/);
});

test('Abort and clamped page prevent incomplete results or repeated pagination', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(collectPages(async () => {
    calls += 1;
    return { data: [], pagination: { currentPage: 1, totalPages: 1 } };
  }, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
  await assert.rejects(collectPages(async page => ({ data: [{ _id: String(page) }],
    pagination: { currentPage: 1, totalPages: 2 } })), /Daftar kos berubah/);
});
