import React from 'react';
import FiltersSection from '../FiltersSection/FiltersSection';
import './DashboardHeader.scss';

const DashboardHeader = ({ 
  title = "Мои задания",
  subtitle = "Управление учебными работами",
  stats = {
    total: 0,
    urgent: 0,
    pending: 0,
    completed: 0
  },
  searchTerm = "",
  onSearchChange,
  sortBy = "deadline",
  onSortChange,
  activeFilter = "all",
  filters = [],
  filterCounts = {},
  onFilterChange,
  className = "",
  loading = false
}) => {
  return (
    <div className={`dashboard-header ${className}`}>
      {/* Заголовок и статистика */}
      <div className="header-main">
        <div className="header-info">
          <h1 className="header-title">{title}</h1>
          <p className="header-subtitle">{subtitle}</p>
        </div>
        
        <div className="stats-container">
          {loading ? (
            <div className="stats-loading">
              <div className="loading-pulse"></div>
              <div className="loading-pulse"></div>
              <div className="loading-pulse"></div>
            </div>
          ) : (
            <div className="stats">
              <StatCard 
                number={stats.total} 
                label="Всего заданий" 
                icon="📋"
              />
              <StatCard 
                number={stats.urgent} 
                label="Срочные" 
                urgent 
                icon="⏰"
              />
              <StatCard 
                number={stats.pending} 
                label="Ожидают сдачи" 
                icon="⏳"
              />
              <StatCard 
                number={stats.completed} 
                label="Выполнено" 
                icon="✅"
                completed
              />
            </div>
          )}
        </div>
      </div>

      {/* Фильтры и поиск */}
      <FiltersSection
        activeFilter={activeFilter}
        filters={filters}
        filterCounts={filterCounts}
        onFilterChange={onFilterChange}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
        loading={loading}
      />
    </div>
  );
};

const StatCard = ({ 
  number, 
  label, 
  urgent = false, 
  completed = false,
  icon = "📊"
}) => (
  <div className={`stat-card ${urgent ? 'stat-card--urgent' : ''} ${completed ? 'stat-card--completed' : ''}`}>
    <div className="stat-card__icon">{icon}</div>
    <div className="stat-card__content">
      <span className="stat-card__number">{number}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  </div>
);

export default DashboardHeader;