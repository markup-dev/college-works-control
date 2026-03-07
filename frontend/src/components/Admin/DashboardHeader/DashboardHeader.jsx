import React from 'react';
import './DashboardHeader.scss';

const DashboardHeader = ({ 
  user, 
  stats = {}, 
  activeTab = 'overview', 
  onTabChange,
  className = "",
  loading = false
}) => {
  const {
    totalUsers = 0,
    totalCourses = 0,
    totalAssignments = 0,
    systemUptime = '100%',
    activeUsers = 0,
    storageUsage = '2.5/10 ГБ'
  } = stats;

  const tabs = [
    { key: 'overview', label: 'Обзор системы', icon: '📊', badge: null },
    { key: 'users', label: 'Пользователи', icon: '👥', badge: totalUsers },
    { key: 'courses', label: 'Курсы', icon: '📚', badge: totalCourses },
    { key: 'assignments', label: 'Задания', icon: '📝', badge: totalAssignments },
    { key: 'logs', label: 'Логи системы', icon: '📋', badge: null },
    { key: 'settings', label: 'Настройки', icon: '⚙️', badge: null }
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
            <div className="user-name">{user?.name || 'Администратор'}</div>
            <div className="user-role">Системный администратор</div>
          </div>
        </div>
      </div>

      <div className="admin-stats">
        {loading ? (
          <>
            {[...Array(4)].map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </>
        ) : (
          <>
            <StatCard 
              icon="👥" 
              value={totalUsers} 
              label="Всего пользователей"
              trend={stats.usersTrend}
              description="Студенты и преподаватели"
            />
            <StatCard 
              icon="📚" 
              value={totalCourses} 
              label="Активных курсов"
              trend={stats.coursesTrend}
              description="Учебные дисциплины"
            />
            <StatCard 
              icon="📝" 
              value={totalAssignments} 
              label="Заданий в системе"
              trend={stats.assignmentsTrend}
              description="Активные задания"
            />
            <StatCard 
              icon="⏱️" 
              value={systemUptime} 
              label="Доступность системы"
              description="За последние 30 дней"
              isUptime
            />
            <StatCard 
              icon="🔗" 
              value={activeUsers} 
              label="Активных сессий"
              description="Онлайн пользователей"
              variant="accent"
            />
            <StatCard 
              icon="💾" 
              value={storageUsage} 
              label="Использование хранилища"
              description="Файлы и данные"
              variant="storage"
            />
          </>
        )}
      </div>

      <nav className="admin-tabs">
        {tabs.map(tab => (
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

const StatCard = ({ 
  icon, 
  value, 
  label, 
  description, 
  trend, 
  isUptime = false,
  variant = 'default' 
}) => (
  <div className={`stat-card stat-card--${variant}`}>
    <div className="stat-card__icon">{icon}</div>
    <div className="stat-card__content">
      <div className="stat-card__main">
        <div className="stat-card__value">{value}</div>
        {trend && (
          <div className={`stat-card__trend ${trend > 0 ? 'stat-card__trend--up' : 'stat-card__trend--down'}`}>
            {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}
          </div>
        )}
      </div>
      <div className="stat-card__label">{label}</div>
      {description && (
        <div className="stat-card__description">{description}</div>
      )}
      {isUptime && (
        <div className="uptime-bar">
          <div 
            className="uptime-bar__fill" 
            style={{ width: typeof value === 'string' ? value : '100%' }}
          ></div>
        </div>
      )}
    </div>
  </div>
);

const StatCardSkeleton = () => (
  <div className="stat-card stat-card--skeleton">
    <div className="stat-card__icon skeleton"></div>
    <div className="stat-card__content">
      <div className="stat-card__main">
        <div className="stat-card__value skeleton"></div>
      </div>
      <div className="stat-card__label skeleton"></div>
      <div className="stat-card__description skeleton"></div>
    </div>
  </div>
);

const TabButton = ({ tab, active, onClick, loading }) => (
  <button
    className={`admin-tab ${active ? 'admin-tab--active' : ''} ${loading ? 'admin-tab--loading' : ''}`}
    onClick={onClick}
    disabled={loading}
  >
    <span className="admin-tab__icon">{tab.icon}</span>
    <span className="admin-tab__label">{tab.label}</span>
    {tab.badge && tab.badge > 0 && (
      <span className="admin-tab__badge">
        {tab.badge > 99 ? '99+' : tab.badge}
      </span>
    )}
    {active && <div className="admin-tab__indicator"></div>}
  </button>
);

export default DashboardHeader;