import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import './SearchableSelect.scss';

const normalize = (value) => String(value || '').trim().toLowerCase();

const SearchableSelect = ({
  value = '',
  onChange,
  options = [],
  placeholder = 'Выберите значение',
  searchPlaceholder = 'Поиск...',
  emptyMessage = 'Ничего не найдено',
  disabled = false,
  className = '',
  ariaLabel = 'Выбор значения',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const reactId = useId().replace(/:/g, '');
  const searchInputId = `searchable-select-${reactId}`;

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)) || null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;

    return options.filter((option) => {
      const haystack = normalize(option.searchText || `${option.label} ${option.meta || ''}`);
      return haystack.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocMouseDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [open]);

  const selectOption = (option) => {
    onChange?.(String(option.value));
    setOpen(false);
  };

  const rootClass = [
    'searchable-select',
    open ? 'searchable-select--open' : '',
    selectedOption ? 'searchable-select--selected' : '',
    disabled ? 'searchable-select--disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        className="searchable-select__trigger"
        onClick={() => !disabled && setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className="searchable-select__trigger-text">
          {selectedOption?.label || placeholder}
        </span>
        <span className="searchable-select__chevron" aria-hidden="true">⌄</span>
      </button>

      {open && !disabled && (
        <div className="searchable-select__panel">
          <input
            id={searchInputId}
            ref={inputRef}
            type="search"
            className="searchable-select__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
          <div className="searchable-select__list" role="listbox">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`searchable-select__option${String(option.value) === String(value) ? ' searchable-select__option--active' : ''}`}
                onClick={() => selectOption(option)}
                role="option"
                aria-selected={String(option.value) === String(value)}
              >
                <span className="searchable-select__option-label">{option.label}</span>
                {option.meta ? (
                  <span className="searchable-select__option-meta">{option.meta}</span>
                ) : null}
              </button>
            ))}

            {filteredOptions.length === 0 && (
              <div className="searchable-select__state">{emptyMessage}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
