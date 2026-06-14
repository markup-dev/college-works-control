import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './SearchableSelect.scss';

const normalize = (value) => String(value || '').trim().toLowerCase();

const PANEL_GAP = 6;
const VIEWPORT_PADDING = 8;
const PANEL_Z_INDEX = 6000;
const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 280;

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
  usePortal = true,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
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

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let width = Math.min(rect.width, viewportWidth - VIEWPORT_PADDING * 2);
    let left = rect.left;
    if (left + width > viewportWidth - VIEWPORT_PADDING) {
      left = viewportWidth - VIEWPORT_PADDING - width;
    }
    if (left < VIEWPORT_PADDING) {
      left = VIEWPORT_PADDING;
    }

    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_PADDING;
    const spaceAbove = rect.top - VIEWPORT_PADDING;
    const shouldOpenUp = spaceBelow < MIN_PANEL_HEIGHT && spaceAbove > spaceBelow;
    const availableSpace = shouldOpenUp ? spaceAbove - PANEL_GAP : spaceBelow - PANEL_GAP;
    const maxHeight = Math.max(
      MIN_PANEL_HEIGHT,
      Math.min(MAX_PANEL_HEIGHT, availableSpace),
    );

    setPanelStyle(
      shouldOpenUp
        ? {
            position: 'fixed',
            left: `${left}px`,
            width: `${width}px`,
            bottom: `${viewportHeight - rect.top + PANEL_GAP}px`,
            maxHeight: `${maxHeight}px`,
            zIndex: PANEL_Z_INDEX,
          }
        : {
            position: 'fixed',
            left: `${left}px`,
            width: `${width}px`,
            top: `${rect.bottom + PANEL_GAP}px`,
            maxHeight: `${maxHeight}px`,
            zIndex: PANEL_Z_INDEX,
          },
    );
  }, []);

  useLayoutEffect(() => {
    if (!open || !usePortal) {
      setPanelStyle(null);
      return undefined;
    }

    updatePanelPosition();

    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, usePortal, updatePanelPosition, filteredOptions.length, query]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocMouseDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
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

  const panelClass = [
    'searchable-select__panel',
    usePortal ? 'searchable-select__panel--portal' : '',
  ].filter(Boolean).join(' ');

  const panelContent = (
    <div
      ref={panelRef}
      className={panelClass}
      style={usePortal ? panelStyle ?? undefined : undefined}
    >
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
  );

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        ref={triggerRef}
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
        <span className="searchable-select__chevron" aria-hidden="true" />
      </button>

      {open && !disabled && (
        usePortal && typeof document !== 'undefined'
          ? createPortal(panelContent, document.body)
          : panelContent
      )}
    </div>
  );
};

export default SearchableSelect;
