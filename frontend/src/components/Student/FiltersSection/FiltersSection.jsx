import React, { useState, useRef, useEffect } from 'react';
import './FiltersSection.scss';

const FiltersSection = ({
  activeFilter,
  filters,
  filterCounts,
  overdueCount = 0,
  onFilterChange,
  searchTerm,
  onSearchChange,
  subjectFilter,
  onSubjectFilterChange,
  availableSubjects,
  teacherFilter,
  onTeacherFilterChange,
  availableTeachers,
  onResetFilters,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!filtersOpen) {
      return undefined;
    }
    const onDoc = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen]);

  const handleResetClick = () => {
    setFiltersOpen(false);
    onResetFilters();
  };

  return (
    <div className="filters-section">
      <div className="search-toolbar">
        <SearchBox searchTerm={searchTerm} onSearchChange={onSearchChange} />

        <div className="filters-toolbar" ref={popoverRef}>
          <div className="filters-toolbar__actions">
            <button
              type="button"
              className={`filter-panel-trigger ${filtersOpen ? 'filter-panel-trigger--open' : ''}`}
              aria-expanded={filtersOpen}
              aria-controls="student-filter-popover"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              Фильтр
            </button>
            <button type="button" className="reset-filters-btn" onClick={handleResetClick}>
              Сбросить фильтры
            </button>
          </div>

          {filtersOpen && (
            <div
              id="student-filter-popover"
              className="filter-popover"
              role="dialog"
              aria-label="Фильтры по предмету и преподавателю"
            >
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
            </div>
          )}
        </div>
      </div>

      <div className="filters-row">
        <div className="filters-container">
          {filters.map((filter) => (
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
    <label className="filter-popover__label" htmlFor="student-filter-subject">
      Предмет
    </label>
    <select
      id="student-filter-subject"
      value={subjectFilter}
      onChange={(e) => onSubjectFilterChange(e.target.value)}
      className="filter-select-input"
    >
      <option value="all">Все предметы</option>
      {availableSubjects.map((subject) => (
        <option key={subject} value={subject}>
          {subject}
        </option>
      ))}
    </select>
  </div>
);

const TeacherFilter = ({ teacherFilter, onTeacherFilterChange, availableTeachers }) => (
  <div className="filter-select teacher-filter">
    <label className="filter-popover__label" htmlFor="student-filter-teacher">
      Преподаватель
    </label>
    <select
      id="student-filter-teacher"
      value={teacherFilter}
      onChange={(e) => onTeacherFilterChange(e.target.value)}
      className="filter-select-input"
    >
      <option value="all">Все преподаватели</option>
      {availableTeachers.map((teacher) => (
        <option key={teacher} value={teacher}>
          {teacher}
        </option>
      ))}
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
      {count > 0 && <span className="filter-count">{count}</span>}
    </button>
  );
};

export default FiltersSection;
