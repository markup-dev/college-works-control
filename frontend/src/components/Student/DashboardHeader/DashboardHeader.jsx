import React from 'react';
import FiltersSection from '../FiltersSection/FiltersSection';
import './DashboardHeader.scss';

const DashboardHeader = ({
  title = "Мои задания",
  subtitle = "Управление учебными работами",
  searchTerm = "",
  onSearchChange,
  sortBy = "priority",
  onSortChange,
  activeFilter = "all",
  filters = [],
  filterCounts = {},
  overdueCount = 0,
  onFilterChange,
  subjectFilter = "all",
  onSubjectFilterChange,
  availableSubjects = [],
  teacherFilter = "all",
  onTeacherFilterChange,
  availableTeachers = [],
  onResetFilters,
  className = "",
  loading = false
}) => {
  return (
    <div className={`dashboard-header ${className}`}>
      <div className="header-main">
        <div className="header-info">
          <h1 className="header-title">{title}</h1>
          <p className="header-subtitle">{subtitle}</p>
        </div>
      </div>

      <FiltersSection
        activeFilter={activeFilter}
        filters={filters}
        filterCounts={filterCounts}
        overdueCount={overdueCount}
        onFilterChange={onFilterChange}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
        subjectFilter={subjectFilter}
        onSubjectFilterChange={onSubjectFilterChange}
        availableSubjects={availableSubjects}
        teacherFilter={teacherFilter}
        onTeacherFilterChange={onTeacherFilterChange}
        availableTeachers={availableTeachers}
        onResetFilters={onResetFilters}
        loading={loading}
      />
    </div>
  );
};

export default DashboardHeader;