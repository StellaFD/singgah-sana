export type PaginatedItems<T> = {
  data: T[];
  pagination: { currentPage: number; totalPages: number };
};

/** Collect an owner's pages without silently returning an incomplete collection. */
export async function collectPages<T extends { _id: string }>(
  fetchPage: (page: number) => Promise<PaginatedItems<T>>,
  signal?: AbortSignal,
): Promise<T[]> {
  const items = new Map<string, T>();
  let page = 1;
  let totalPages = 1;
  do {
    signal?.throwIfAborted();
    const result = await fetchPage(page);
    if (!result.pagination || result.pagination.currentPage !== page ||
        !Number.isInteger(result.pagination.totalPages) || result.pagination.totalPages < page) {
      throw new Error('Daftar kos berubah. Muat ulang untuk mengambil daftar lengkap.');
    }
    totalPages = result.pagination.totalPages;
    for (const item of result.data) items.set(item._id, item);
    page += 1;
  } while (page <= totalPages);
  signal?.throwIfAborted();
  return [...items.values()];
}
