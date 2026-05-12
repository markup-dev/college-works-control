import React from 'react';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
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
  filtersResetDisabled = false,
}) => (
  <div className="filters-section">
    <DashboardFilterToolbar
      searchValue={searchTerm}
      onSearchChange={onSearchChange}
      searchPlaceholder="Поиск по названию, предмету, преподавателю..."
      searchInputType="text"
      onReset={onResetFilters}
      resetDisabled={filtersResetDisabled}
      popoverAriaLabel="Фильтры по предмету и преподавателю"
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
    </DashboardFilterToolbar>

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

const SubjectFilter = ({ subjectFilter, onSubjectFilterChange, availableSubjects }) => (
  <div className="filter-popover__field">
    <label className="filter-popover__label" htmlFor="student-filter-subject">
      Предмет
    </label>
    <select
      id="student-filter-subject"
      value={subjectFilter}
      onChange={(e) => onSubjectFilterChange(e.target.value)}
      className="filter-select"
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
  <div className="filter-popover__field">
    <label className="filter-popover__label" htmlFor="student-filter-teacher">
      Преподаватель
    </label>
    <select
      id="student-filter-teacher"
      value={teacherFilter}
      onChange={(e) => onTeacherFilterChange(e.target.value)}
      className="filter-select"
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
