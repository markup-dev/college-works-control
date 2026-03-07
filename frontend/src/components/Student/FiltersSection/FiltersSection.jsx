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
  onSortChange,
  courseFilter,
  onCourseFilterChange,
  availableCourses,
  teacherFilter,
  onTeacherFilterChange,
  availableTeachers
}) => {
  return (
    <div className="filters-section">
      <div className="controls-row">
        <SearchBox 
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
        />
        <CourseFilter
          courseFilter={courseFilter}
          onCourseFilterChange={onCourseFilterChange}
          availableCourses={availableCourses}
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

const CourseFilter = ({ courseFilter, onCourseFilterChange, availableCourses }) => (
  <div className="filter-select">
    <select 
      value={courseFilter} 
      onChange={(e) => onCourseFilterChange(e.target.value)}
      className="filter-select-input"
    >
      <option value="all">📚 Все дисциплины</option>
      {availableCourses.map(course => (
        <option key={course} value={course}>{course}</option>
      ))}
    </select>
  </div>
);

const TeacherFilter = ({ teacherFilter, onTeacherFilterChange, availableTeachers }) => (
  <div className="filter-select">
    <select 
      value={teacherFilter} 
      onChange={(e) => onTeacherFilterChange(e.target.value)}
      className="filter-select-input"
    >
      <option value="all">👩‍🏫 Все преподаватели</option>
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
      <option value="priority">🎯 По приоритету</option>
      <option value="deadline">📅 По сроку сдачи</option>
      <option value="course">📚 По дисциплине</option>
      <option value="status">🔄 По статусу</option>
      <option value="title">📝 По названию</option>
    </select>
  </div>
);

const FilterButton = ({ filter, count, isActive, onClick }) => (
  <button
    type="button"
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