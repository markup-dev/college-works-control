import React from 'react';
import './FiltersSection.scss';

const FiltersSection = ({ 
  activeFilter, 
  filters, 
  filterCounts, 
  overdueCount = 0,
  onFilterChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  subjectFilter,
  onSubjectFilterChange,
  availableSubjects,
  teacherFilter,
  onTeacherFilterChange,
  availableTeachers,
  onResetFilters
}) => {
  return (
    <div className="filters-section">
      <div className="search-row">
        <SearchBox 
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
        />
        <button type="button" className="reset-filters-btn" onClick={onResetFilters}>
          Сбросить фильтры
        </button>
      </div>
      <div className="controls-row">
        <SubjectFilter
          subjectFilter={subjectFilter}
          onSubjectFilterChange={onSubjectFilterChange}
          availableSubjects={availableSubjects}
        />
        <TeacherFilter
          teacherFilter={teacherFilter}
          onTeacherFilterChange={onTeacherFilterChange}
          availableTeachers={availableTeachers}
        />
        <SortSelect 
          sortBy={sortBy}
          onSortChange={onSortChange}
        />
      </div>

      <div className="filters-row">
        <div className="filters-container">
          {filters.map(filter => (
            <FilterButton
              key={filter.key}
              filter={filter}
              count={filterCounts[filter.key]}
              overdueCount={overdueCount}
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
      placeholder="Поиск по названию, предмету, преподавателю..."
      value={searchTerm}
      onChange={(e) => onSearchChange(e.target.value)}
      className="search-input"
    />
  </div>
);

const SubjectFilter = ({ subjectFilter, onSubjectFilterChange, availableSubjects }) => (
  <div className="filter-select subject-filter">
    <select 
      value={subjectFilter} 
      onChange={(e) => onSubjectFilterChange(e.target.value)}
      className="filter-select-input"
    >
      <option value="all">Все предметы</option>
      {availableSubjects.map(subject => (
        <option key={subject} value={subject}>{subject}</option>
      ))}
    </select>
  </div>
);

const TeacherFilter = ({ teacherFilter, onTeacherFilterChange, availableTeachers }) => (
  <div className="filter-select teacher-filter">
    <select 
      value={teacherFilter} 
      onChange={(e) => onTeacherFilterChange(e.target.value)}
      className="filter-select-input"
    >
      <option value="all">Все преподаватели</option>
      {availableTeachers.map(teacher => (
        <option key={teacher} value={teacher}>{teacher}</option>
      ))}
    </select>
  </div>
);

const SortSelect = ({ sortBy, onSortChange }) => (
  <div className="sort-filter">
    <select 
      value={sortBy} 
      onChange={(e) => onSortChange(e.target.value)}
      className="sort-select"
    >
      <option value="priority">По приоритету</option>
      <option value="deadline">По ближайшему сроку</option>
      <option value="deadline_desc">По дальнему сроку</option>
      <option value="newest">Сначала новые</option>
      <option value="oldest">Сначала старые</option>
      <option value="subject">По предмету</option>
      <option value="status">По статусу</option>
      <option value="title">По названию</option>
    </select>
  </div>
);

const FilterButton = ({ filter, count, overdueCount, isActive, onClick }) => {
  const hasOverdueAlert = filter.key === 'urgent' && overdueCount > 0;

  return (
    <button
      type="button"
      className={`filter-btn ${isActive ? 'active' : ''} ${hasOverdueAlert ? 'filter-btn--overdue-alert' : ''}`}
      onClick={onClick}
    >
      <span className="filter-label">{filter.label}</span>
      {count > 0 && (
        <span className="filter-count">{count}</span>
      )}
    </button>
  );
};

export default FiltersSection;