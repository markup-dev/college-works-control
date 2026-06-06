import { useEffect } from 'react';
import { clampPage } from '../utils/pagination';

/** Сбрасывает номер страницы, если после фильтрации или удаления он стал больше lastPage */
export default function usePaginationClamp(page, lastPage, setPage) {
  useEffect(() => {
    const safeLast = Math.max(1, Number(lastPage) || 1);
    if (page > safeLast) {
      setPage(safeLast);
    }
  }, [page, lastPage, setPage]);
}

export { clampPage };
