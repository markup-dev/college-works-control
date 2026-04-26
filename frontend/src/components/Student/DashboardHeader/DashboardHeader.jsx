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
  attentionAssignments = { retakes: [], deadlines: [] },
  onOpenAttentionAssignment,
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

      <AttentionBlock
        retakes={attentionAssignments?.retakes}
        deadlines={attentionAssignments?.deadlines}
        onOpenAssignment={onOpenAttentionAssignment}
      />

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

const AttentionBlock = React.memo(({ retakes = [], deadlines = [], onOpenAssignment }) => {
  if (retakes.length === 0 && deadlines.length === 0) {
    return null;
  }

  return (
    <section className="attention-block app-reveal">
      <div className="attention-block__header">
        <h3>Требует внимания</h3>
      </div>
      <div className="attention-block__content app-reveal-stagger">
        {retakes.length > 0 && (
          <div className="attention-block__group attention-block__group--retakes">
            <h4>
              Пересдачи
              <span className="attention-block__badge">{retakes.length}</span>
            </h4>
            <ul>
              {retakes.map((assignment) => (
                <li key={`retake-${assignment.id}`}>
                  <button
                    type="button"
                    className="attention-block__item"
                    onClick={() => onOpenAssignment?.(assignment)}
                  >
                    {assignment.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {deadlines.length > 0 && (
          <div className="attention-block__group attention-block__group--deadlines">
            <h4>
              Ближайшие дедлайны
              <span className="attention-block__badge">{deadlines.length}</span>
            </h4>
            <ul>
              {deadlines.map((assignment) => (
                <li key={`deadline-${assignment.id}`}>
                  <button
                    type="button"
                    className="attention-block__item"
                    onClick={() => onOpenAssignment?.(assignment)}
                  >
                    {assignment.title} — {
                      assignment.daysLeft < 0
                        ? `просрочено на ${Math.abs(assignment.daysLeft)} дн.`
                        : assignment.daysLeft === 0
                          ? 'сегодня'
                          : `${assignment.daysLeft} дн.`
                    }
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
});

export default DashboardHeader;