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
  const teacherName = user
    ? (user.fullName || [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ').trim() || user.login)
    : '';
  const teacherInfo = user ? `${teacherName} • ${user.department || 'Преподаватель'}` : 'Загрузка...';

  return (
    <header className={`dashboard-header ${className}`}>
      <div className="dashboard-header__top">
        <div className="dashboard-header__info">
          <div className="dashboard-header__title-section">
            <h1 className="dashboard-header__title">Панель преподавателя</h1>
            <p className="dashboard-header__subtitle">Управление учебными заданиями и проверка работ</p>
          </div>
          <div className="dashboard-header__teacher">
            <span className="teacher-info">{teacherInfo}</span>
          </div>
        </div>
      </div>

      <DashboardTabs 
        activeTab={activeTab}
        onTabChange={onTabChange}
        totalAssignments={stats.totalAssignments}
        pendingSubmissions={stats.pendingSubmissions}
        loading={loading}
      />
    </header>
  );
};

const DashboardTabs = ({ activeTab, onTabChange, totalAssignments, pendingSubmissions, loading }) => (
  <nav className="dashboard-tabs">
    <TabButton
      active={activeTab === 'assignments'}
      onClick={() => onTabChange('assignments')}
      label="Мои задания"
      badge={totalAssignments}
      loading={loading}
    />
    <TabButton
      active={activeTab === 'submissions'}
      onClick={() => onTabChange('submissions')}
      label="Работы студентов"
      badge={pendingSubmissions}
      loading={loading}
    />
    <TabButton
      active={activeTab === 'completed'}
      onClick={() => onTabChange('completed')}
      label="Завершенные"
      loading={loading}
    />
    <TabButton
      active={activeTab === 'analytics'}
      onClick={() => onTabChange('analytics')}
      label="Аналитика"
      loading={loading}
    />
    <TabButton
      active={activeTab === 'students'}
      onClick={() => onTabChange('students')}
      label="Студенты"
      loading={loading}
    />
  </nav>
);

const TabButton = ({ active, onClick, label, badge, loading }) => (
  <button 
    className={`tab-btn ${active ? 'tab-btn--active' : ''} ${loading ? 'tab-btn--loading' : ''}`}
    onClick={onClick}
    disabled={loading}
  >
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