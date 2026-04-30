import React from 'react';
import Button from '../Button/Button';
import './Pagination.scss';

const Pagination = ({
  currentPage = 1,
  lastPage = 1,
  total = 0,
  fallbackCount = 0,
  onPrev,
  onNext,
  className = '',
  disabled = false,
}) => {
  const safeCurrentPage = Math.max(1, Number(currentPage) || 1);
  const safeLastPage = Math.max(1, Number(lastPage) || 1);
  const safeTotal = Number(total) || Number(fallbackCount) || 0;
  const navDisabled = disabled || safeTotal <= 0;

  return (
    <div className={`ui-pagination ${className}`}>
      <Button
        size="small"
        variant="outline"
        disabled={navDisabled || safeCurrentPage <= 1}
        onClick={onPrev}
      >
        Назад
      </Button>

      <span className="ui-pagination__meta">
        Страница {safeCurrentPage} из {safeLastPage} · всего {safeTotal}
      </span>

      <Button
        size="small"
        variant="outline"
        disabled={navDisabled || safeCurrentPage >= safeLastPage}
        onClick={onNext}
      >
        Далее
      </Button>
    </div>
  );
};

export default Pagination;
