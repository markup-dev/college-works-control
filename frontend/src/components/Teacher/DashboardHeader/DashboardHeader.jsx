import React from 'react';
import { TEACHER_DASHBOARD_NAV_ITEMS } from '../../../config/teacherDashboardNavItems';
import './DashboardHeader.scss';

const DashboardHeader = ({
  user,
  activeTab = 'assignments',
  onTabChange,
  className = '',
  loading = false,
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
        loading={loading}
      />
    </header>
  );
};

const DashboardTabs = ({ activeTab, onTabChange, loading }) => (
  <nav className="dashboard-tabs dashboard-tabs--header" aria-label="Разделы панели преподавателя">
    {TEACHER_DASHBOARD_NAV_ITEMS.map(({ id, label }) => (
      <TabButton
        key={id}
        active={activeTab === id}
        onClick={() => onTabChange(id)}
        label={label}
        loading={loading}
      />
    ))}
  </nav>
);

const TabButton = ({ active, onClick, label, loading }) => (
  <button
    type="button"
    className={`tab-btn ${active ? 'tab-btn--active' : ''} ${loading ? 'tab-btn--loading' : ''}`}
    onClick={onClick}
    disabled={loading}
    aria-current={active ? 'page' : undefined}
  >
    <span className="tab-btn__label">{label}</span>
    {active && <div className="tab-btn__indicator" />}
  </button>
);

export default DashboardHeader;
