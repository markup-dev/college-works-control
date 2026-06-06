export const parsePaginationMeta = (meta, fallbackPage = 1) => ({
  currentPage: Math.max(1, Number(meta?.currentPage) || fallbackPage),
  lastPage: Math.max(1, Number(meta?.lastPage) || 1),
  total: Math.max(0, Number(meta?.total) || 0),
  perPage: Math.max(1, Number(meta?.perPage) || 0),
});

export const clampPage = (page, lastPage) =>
  Math.min(Math.max(1, Number(page) || 1), Math.max(1, Number(lastPage) || 1));
