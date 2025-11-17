import React from 'react';
import './FiltersSection.scss';

const FiltersSection = ({ 
  activeFilter, 
  filters, 
  filterCounts, 
  onFilterChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange 
}) => {
  return (
    <div className="filters-section">
      {/* Поиск и сортировка */}
      <div className="controls-row">
        <SearchBox 
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
        />
        <SortSelect 
          sortBy={sortBy}
          onSortChange={onSortChange}
        />
      </div>

      {/* Фильтры */}
      <div className="filters-row">
        <div className="filters-container">
          {filters.map(filter => (
            <FilterButton
              key={filter.key}
              filter={filter}
              count={filterCounts[filter.key]}
              isActive={activeFilter === filter.key}
              onClick={() => onFilterChange(filter.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const SearchBox = ({ searchTerm, onSearchChange }) => (
  <div className="search-box">
    <input
      type="text"
      placeholder="🔍 Поиск по названию, дисциплине, преподавателю..."
      value={searchTerm}
      onChange={(e) => onSearchChange(e.target.value)}
      className="search-input"
    />
  </div>
);

const SortSelect = ({ sortBy, onSortChange }) => (
  <div className="sort-filter">
    <select 
      value={sortBy} 
      onChange={(e) => onSortChange(e.target.value)}
      className="sort-select"
    >
      <option value="deadline">📅 По сроку сдачи</option>
      <option value="course">📚 По дисциплине</option>
      <option value="status">🔄 По статусу</option>
      <option value="title">📝 По названию</option>
      <option value="priority">🎯 По приоритету</option>
    </select>
  </div>
);

const FilterButton = ({ filter, count, isActive, onClick }) => (
  <button
    className={`filter-btn ${isActive ? 'active' : ''}`}
    onClick={onClick}
  >
    <span className="filter-icon">{filter.icon}</span>
    <span className="filter-label">{filter.label}</span>
    {count > 0 && (
      <span className="filter-count">{count}</span>
    )}
  </button>
);

export default FiltersSection;