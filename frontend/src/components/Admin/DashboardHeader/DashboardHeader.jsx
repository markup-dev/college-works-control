import React from 'react';
import './DashboardHeader.scss';

const DashboardHeader = ({
  user,
  stats = {},
  activeTab = 'overview',
  onTabChange,
  className = '',
  loading = false,
}) => {
  const adminName =
    user?.fullName ||
    [user?.lastName, user?.firstName, user?.middleName].filter(Boolean).join(' ').trim() ||
    'Администратор';
  const { totalUsers = 0, totalGroups = 0, totalSubjects = 0 } = stats;

  const tabs = [
    { key: 'overview', label: 'Обзор системы', icon: '📊', badge: null },
    { key: 'users', label: 'Пользователи', icon: '👥', badge: totalUsers },
    { key: 'groups', label: 'Группы', icon: '🏷️', badge: totalGroups },
    { key: 'subjects', label: 'Предметы', icon: '📚', badge: totalSubjects },
    { key: 'teaching-loads', label: 'Нагрузка', icon: '🧩', badge: null },
    { key: 'logs', label: 'Логи системы', icon: '📋', badge: null },
    { key: 'settings', label: 'Настройки', icon: '⚙️', badge: null },
  ];

  return (
    <header className={`admin-dashboard-header ${className}`}>
      <div className="admin-header__top">
        <div className="admin-header__info">
          <div className="admin-header__title-section">
            <h1 className="admin-header__title">Панель администратора</h1>
            <p className="admin-header__subtitle">Управление системой учебного портала</p>
          </div>
          <div className="admin-header__status">
            <div className="status-indicator">
              <div className="status-dot status-dot--online"></div>
              <span>Система активна</span>
            </div>
          </div>
        </div>

        <div className="admin-header__user">
          <div className="user-avatar">👨‍💼</div>
          <div className="user-info">
            <div className="user-name">{adminName}</div>
            <div className="user-role">Системный администратор</div>
          </div>
        </div>
      </div>

      <nav className="admin-tabs">
        {tabs.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            onClick={() => onTabChange(tab.key)}
            loading={loading}
          />
        ))}
      </nav>
    </header>
  );
};

const TabButton = ({ tab, active, onClick, loading }) => (
  <button
    type="button"
    className={`admin-tab ${active ? 'admin-tab--active' : ''} ${loading ? 'admin-tab--loading' : ''}`}
    onClick={onClick}
    disabled={loading}
  >
    <span className="admin-tab__icon">{tab.icon}</span>
    <span className="admin-tab__label">{tab.label}</span>
    {tab.badge != null && tab.badge > 0 && (
      <span className="admin-tab__badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
    )}
    {active && <div className="admin-tab__indicator"></div>}
  </button>
);

export default DashboardHeader;
