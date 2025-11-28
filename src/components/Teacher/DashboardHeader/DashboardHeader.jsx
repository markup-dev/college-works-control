import React from 'react';
import './DashboardHeader.scss';

const DashboardHeader = ({ 
  user, 
  stats = {
    totalAssignments: 0,
    pendingSubmissions: 0,
    gradedSubmissions: 0,
    returnedSubmissions: 0
  },
  activeTab = 'assignments',
  onTabChange,
  className = "",
  loading = false
}) => {
  const teacherInfo = user ? `${user.name} • ${user.department || 'Преподаватель'}` : 'Загрузка...';

  return (
    <header className={`dashboard-header ${className}`}>
      <div className="dashboard-header__top">
        <div className="dashboard-header__info">
          <div className="dashboard-header__title-section">
            <h1 className="dashboard-header__title">Панель преподавателя</h1>
            <p className="dashboard-header__subtitle">Управление учебными заданиями и проверка работ</p>
          </div>
          <div className="dashboard-header__teacher">
            <span className="teacher-icon">👨‍🏫</span>
            <span className="teacher-info">{teacherInfo}</span>
          </div>
        </div>
        
        <StatsOverview 
          stats={stats} 
          loading={loading}
        />
      </div>

      <DashboardTabs 
        activeTab={activeTab}
        onTabChange={onTabChange}
        pendingSubmissions={stats.pendingSubmissions}
        loading={loading}
      />
    </header>
  );
};

const StatsOverview = ({ stats, loading }) => (
  <div className="stats-overview">
    {loading ? (
      <>
        {[...Array(4)].map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </>
    ) : (
      <>
        <StatCard 
          icon="📚" 
          number={stats.totalAssignments} 
          label="Активных заданий"
          trend={stats.assignmentsTrend}
        />
        <StatCard 
          icon="⏳" 
          number={stats.pendingSubmissions} 
          label="Работ на проверке" 
          urgent={stats.pendingSubmissions > 0}
          trend={stats.pendingTrend}
        />
        <StatCard 
          icon="✅" 
          number={stats.gradedSubmissions} 
          label="Проверено работ" 
          trend={stats.gradedTrend}
        />
        <StatCard 
          icon="↩️" 
          number={stats.returnedSubmissions} 
          label="Возвращено на доработку"
          trend={stats.returnedTrend}
        />
      </>
    )}
  </div>
);

const StatCard = ({ icon, number, label, urgent = false, trend }) => (
  <div className={`stat-card ${urgent ? 'stat-card--urgent' : ''}`}>
    <div className="stat-card__icon">{icon}</div>
    <div className="stat-card__content">
      <div className="stat-card__main">
        <span className="stat-card__number">{number}</span>
        {trend && (
          <span className={`stat-card__trend ${trend > 0 ? 'stat-card__trend--up' : 'stat-card__trend--down'}`}>
            {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}
          </span>
        )}
      </div>
      <span className="stat-card__label">{label}</span>
    </div>
  </div>
);

const StatCardSkeleton = () => (
  <div className="stat-card stat-card--skeleton">
    <div className="stat-card__icon skeleton"></div>
    <div className="stat-card__content">
      <div className="stat-card__main">
        <span className="stat-card__number skeleton"></span>
      </div>
      <span className="stat-card__label skeleton"></span>
    </div>
  </div>
);

const DashboardTabs = ({ activeTab, onTabChange, pendingSubmissions, loading }) => (
  <nav className="dashboard-tabs">
    <TabButton
      active={activeTab === 'assignments'}
      onClick={() => onTabChange('assignments')}
      icon="📝"
      label="Мои задания"
      loading={loading}
    />
    <TabButton
      active={activeTab === 'submissions'}
      onClick={() => onTabChange('submissions')}
      icon="📋"
      label="Работы на проверке"
      badge={pendingSubmissions}
      loading={loading}
    />
    <TabButton
      active={activeTab === 'analytics'}
      onClick={() => onTabChange('analytics')}
      icon="📊"
      label="Аналитика"
      loading={loading}
    />
    <TabButton
      active={activeTab === 'students'}
      onClick={() => onTabChange('students')}
      icon="👨‍🎓"
      label="Студенты"
      loading={loading}
    />
  </nav>
);

const TabButton = ({ active, onClick, icon, label, badge, loading }) => (
  <button 
    className={`tab-btn ${active ? 'tab-btn--active' : ''} ${loading ? 'tab-btn--loading' : ''}`}
    onClick={onClick}
    disabled={loading}
  >
    <span className="tab-btn__icon">{icon}</span>
    <span className="tab-btn__label">{label}</span>
    {badge > 0 && (
      <span className="tab-btn__badge">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
    {active && <div className="tab-btn__indicator"></div>}
  </button>
);

export default DashboardHeader;