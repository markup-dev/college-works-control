import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import './DashboardFilterToolbar.scss';

/** Панель поиска, «Фильтр» с поповером и сброс. `popoverAlign="end"` — поповер справа от триггера. */
const DashboardFilterToolbar = ({
  showSearch = true,
  showFilterPanel = true,
  showResetButton = true,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Поиск…',
  searchInputType = 'search',
  searchInputClassName = 'search-input',
  searchBoxClassName = 'search-box',
  searchDisabled = false,
  onReset,
  filterLabel = 'Фильтр',
  resetLabel = 'Сбросить фильтры',
  popoverAriaLabel = 'Фильтры',
  disabled = false,
  resetDisabled = false,
  className = '',
  popoverAlign = 'start',
  renderReset,
  children,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toolbarRef = useRef(null);
  const reactId = useId();
  const popoverDomId = `dashboard-filter-popover-${reactId.replace(/:/g, '')}`;
  const searchInputId = `dashboard-filter-search-${reactId.replace(/:/g, '')}`;

  const closeAndReset = useCallback(() => {
    setFiltersOpen(false);
    onReset?.();
  }, [onReset]);

  useEffect(() => {
    if (!filtersOpen || !showFilterPanel) {
      return undefined;
    }
    const onDocMouseDown = (event) => {
      const target = event.target;
      if (target instanceof Element && (
        target.closest('.searchable-select__panel')
        || target.closest('.assignment-filter-combobox__panel')
      )) {
        return;
      }
      if (toolbarRef.current && !toolbarRef.current.contains(target)) {
        setFiltersOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filtersOpen, showFilterPanel]);

  const showToolbarActions = showFilterPanel || showResetButton;

  const rootClass =
    [
      'dashboard-filter-toolbar',
      popoverAlign === 'end' ? 'dashboard-filter-toolbar--popover-end' : '',
      showFilterPanel ? 'dashboard-filter-toolbar--has-filter-panel' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ') || 'dashboard-filter-toolbar';

  const renderSearchField = (variant = 'inline') => (
    <div
      className={[
        'dashboard-filter-toolbar__search',
        searchBoxClassName,
        variant === 'inline' ? 'dashboard-filter-toolbar__search--inline' : 'dashboard-filter-toolbar__search--in-popover',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        id={variant === 'in-popover' ? searchInputId : undefined}
        type={searchInputType}
        className={searchInputClassName.trim()}
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(event) => onSearchChange?.(event.target.value)}
        disabled={searchDisabled}
        aria-disabled={searchDisabled}
        autoComplete="off"
      />
    </div>
  );

  return (
    <div className={rootClass}>
      <div className="search-toolbar">
        {showSearch && renderSearchField('inline')}

        {showToolbarActions && (
          <div className="filters-toolbar" ref={toolbarRef}>
            <div className="filters-toolbar__actions">
              {showFilterPanel && (
                <button
                  type="button"
                  className={`filter-panel-trigger ${filtersOpen ? 'filter-panel-trigger--open' : ''}`}
                  aria-expanded={filtersOpen}
                  aria-controls={popoverDomId}
                  onClick={() => setFiltersOpen((open) => !open)}
                  disabled={disabled}
                >
                  {filterLabel}
                </button>
              )}
              {showResetButton &&
                (renderReset ? (
                  renderReset({ closeAndReset, disabled: resetDisabled })
                ) : (
                  <button
                    type="button"
                    className="reset-filters-btn"
                    onClick={closeAndReset}
                    disabled={resetDisabled}
                  >
                    {resetLabel}
                  </button>
                ))}
            </div>
            {showFilterPanel && filtersOpen && (
              <div
                id={popoverDomId}
                className="filter-popover"
                role="dialog"
                aria-label={popoverAriaLabel}
              >
                {showSearch && (
                  <div className="filter-popover__field filter-popover__field--search">
                    <label className="filter-popover__label" htmlFor={searchInputId}>
                      Поиск
                    </label>
                    {renderSearchField('in-popover')}
                  </div>
                )}
                {children}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardFilterToolbar;
