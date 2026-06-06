import React from 'react';
import Button from '../Button/Button';
import './Pagination.scss';

const Pagination = ({
  currentPage = 1,
  lastPage = 1,
  total = 0,
  fallbackCount = 0,
  onPageChange,
  onPrev,
  onNext,
  className = '',
  disabled = false,
  hideWhenSinglePage = false,
  prevLabel = 'Назад',
  nextLabel = 'Далее',
}) => {
  const safeCurrentPage = Math.max(1, Number(currentPage) || 1);
  const safeLastPage = Math.max(1, Number(lastPage) || 1);
  const safeTotal = Number(total) || Number(fallbackCount) || 0;
  const navDisabled = disabled || safeTotal <= 0;

  if (hideWhenSinglePage && safeLastPage <= 1) {
    return null;
  }

  const goToPage = (page) => {
    const next = Math.min(safeLastPage, Math.max(1, page));
    if (onPageChange) {
      onPageChange(next);
      return;
    }
    if (next < safeCurrentPage) {
      onPrev?.();
    } else if (next > safeCurrentPage) {
      onNext?.();
    }
  };

  return (
    <nav className={`ui-pagination ${className}`.trim()} aria-label="Навигация по страницам">
      <Button
        className="ui-pagination__prev"
        size="small"
        variant="outline"
        disabled={navDisabled || safeCurrentPage <= 1}
        onClick={() => goToPage(safeCurrentPage - 1)}
      >
        {prevLabel}
      </Button>

      <div className="ui-pagination__meta">
        <span className="ui-pagination__meta-pages">
          Страница {safeCurrentPage} из {safeLastPage}
        </span>
        <span className="ui-pagination__meta-total">Всего {safeTotal}</span>
      </div>

      <Button
        className="ui-pagination__next"
        size="small"
        variant="outline"
        disabled={navDisabled || safeCurrentPage >= safeLastPage}
        onClick={() => goToPage(safeCurrentPage + 1)}
      >
        {nextLabel}
      </Button>
    </nav>
  );
};

export default Pagination;
