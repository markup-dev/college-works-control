import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useAdmin } from '../../../context/AdminContext';
import api from '../../../services/api';
import { formatDateTime } from '../../../utils/dateHelpers';
import EmptyState from '../../UI/EmptyState/EmptyState';
import ErrorBanner from '../../UI/ErrorBanner/ErrorBanner';
import InfoCard from '../../UI/InfoCard/InfoCard';
import LoadingState from '../../UI/LoadingState/LoadingState';
import './AdminDashboardHome.scss';

const AdminWeekActivityChart = ({ activityWeek }) => {
  if (!activityWeek?.labels?.length) return null;
  const { labels, submissions, messages, logins } = activityWeek;
  const rows = [
    { key: 'logins', label: 'Входы в систему', values: logins || [] },
    { key: 'sub', label: 'Сдано работ', values: submissions || [] },
    { key: 'msg', label: 'Сообщений', values: messages || [] },
  ];
  const max = Math.max(1, ...rows.flatMap((r) => r.values));

  return (
    <div className="admin-dashboard-home__chart" aria-label="Активность за неделю">
      <div className="admin-dashboard-home__chart-bars-container">
        {rows.map((row) => (
          <div key={row.key} className="admin-dashboard-home__chart-row">
            <div className="admin-dashboard-home__chart-row-header">
              <span className="admin-dashboard-home__chart-row-label">{row.label}</span>
            </div>
            <div className="admin-dashboard-home__chart-bars">
              {row.values.map((v, i) => (
                <div
                  key={`${row.key}-${i}`}
                  className="admin-dashboard-home__chart-bar-wrap"
                  title={`${labels[i]}: ${v}`}
                >
                  <div
                    className={`admin-dashboard-home__chart-bar admin-dashboard-home__chart-bar--${row.key}`}
                    style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="admin-dashboard-home__chart-axis">
          {labels.map((lb) => (
            <span key={lb} className="admin-dashboard-home__chart-day">
              {lb}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const AdminDashboardHome = () => {
  const { user } = useAuth();
  const { stats, statsLoading, statsError, refreshStats } = useAdmin();
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLogsLoading(true);
      try {
        const { data } = await api.get('/admin/logs', {
          params: { per_page: 5, sort: 'newest', period: 'month' },
        });
        if (!cancelled) {
          setLogs(data?.data || []);
        }
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = useMemo(() => {
    if (!user) return '';
    if (user.fullName) return user.fullName;
    return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ').trim() || user.login;
  }, [user]);

  const activityWeek = stats?.activityWeek
    ? {
        labels: stats.activityWeek.labels,
        logins: stats.activityWeek.logins,
        submissions: stats.activityWeek.submissions,
        messages: stats.activityWeek.messages,
      }
    : null;

  const metrics = [
    {
      id: 'users',
      title: 'Пользователей',
      value: stats?.totalUsers ?? 0,
      delta: `+${stats?.usersCreatedLast7Days ?? 0} за неделю`,
      link: '/admin/users',
      color: 'blue',
    },
    {
      id: 'groups',
      title: 'Групп',
      value: stats?.totalGroups ?? 0,
      hint: `${stats?.groupsActive ?? 0} активных / ${stats?.groupsInactive ?? 0} закрытых`,
      link: '/admin/groups',
      color: 'green',
    },
    {
      id: 'assignments',
      title: 'Активных заданий',
      value: stats?.assignmentsActive ?? 0,
      hint: `${stats?.assignmentsOverdue ?? 0} просрочено / ${stats?.assignmentsActiveOnTrack ?? 0} в срок`,
      link: '/admin/homework',
      color: 'orange',
    },
    {
      id: 'control',
      title: 'На контроле',
      value: stats?.submissionsStaleReview ?? 0,
      description: 'Работ без проверки более 3 суток',
      link: '/admin/homework?filter=overdue_checks',
      color: 'red',
    },
  ];

  const quickActions = [
    { title: 'Создать пользователя', link: '/admin/users', state: { openCreateUser: true }, variant: 'primary' },
    { title: 'Новая группа', link: '/admin/groups', state: { openCreateGroup: true }, variant: 'secondary' },
    { title: 'Новый предмет', link: '/admin/subjects', state: { openCreateSubject: true }, variant: 'secondary' },
    { title: 'Импорт пользователей', link: '/admin/users', state: { openImportUsers: true }, variant: 'secondary' },
  ];

  const getLogTypeClass = (action) => {
    if (action.toLowerCase().includes('удал')) return 'log-delete';
    if (action.toLowerCase().includes('созд')) return 'log-create';
    if (action.toLowerCase().includes('измен')) return 'log-update';
    return 'log-default';
  };

  return (
    <div className="admin-dashboard-home">
      <InfoCard className="admin-dashboard-home__welcome">
        <div className="admin-dashboard-home__welcome-avatar">
          {displayName?.charAt(0) || 'A'}
        </div>
        <div className="admin-dashboard-home__welcome-content">
          <h1 className="admin-dashboard-home__welcome-title">
            Добро пожаловать{displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="admin-dashboard-home__welcome-meta">
            Последний вход: {formatDateTime(user?.lastLogin)}
          </p>
        </div>
      </InfoCard>

      {statsError && (
        <ErrorBanner
          className="admin-dashboard-home__error"
          title="Ошибка загрузки статистики"
          message={statsError}
          actionLabel="Повторить"
          onAction={refreshStats}
        />
      )}

      <section className="admin-dashboard-home__widgets" aria-label="Ключевые показатели">
        {statsLoading && !stats && (
          <LoadingState message="Загрузка метрик..." className="admin-dashboard-home__state" />
        )}
        {stats &&
          metrics.map((metric) => (
            <Link key={metric.id} className={`admin-metric-tile admin-metric-tile--${metric.color}`} to={metric.link}>
              <div className="admin-metric-tile__content">
                <div className="admin-metric-tile__value">{metric.value}</div>
                <div className="admin-metric-tile__label">{metric.title}</div>
                {metric.delta && <div className="admin-metric-tile__delta">{metric.delta}</div>}
                {metric.hint && <div className="admin-metric-tile__hint">{metric.hint}</div>}
                {metric.description && <div className="admin-metric-tile__description">{metric.description}</div>}
              </div>
            </Link>
          ))}
      </section>

      <section className="admin-dashboard-home__quick" aria-label="Быстрые действия">
        <h2 className="admin-dashboard-home__section-title">Быстрые действия</h2>
        <div className="admin-dashboard-home__quick-grid">
          {quickActions.map((action) => (
            <Link 
              key={action.title} 
              className={`admin-dashboard-home__quick-link admin-dashboard-home__quick-link--${action.variant}`} 
              to={action.link} 
              state={action.state}
            >
              {action.title}
            </Link>
          ))}
        </div>
      </section>

      <InfoCard className="admin-dashboard-home__panel">
        <h2 className="admin-dashboard-home__section-title">Активность за неделю</h2>
        {activityWeek ? (
          <AdminWeekActivityChart activityWeek={activityWeek} />
        ) : (
          <EmptyState
            asCard={false}
            title="Нет данных для графика"
            message="Активность появится после входов, сообщений или сдачи работ."
            className="admin-dashboard-home__state"
          />
        )}
      </InfoCard>

      <InfoCard className="admin-dashboard-home__panel">
        <div className="admin-dashboard-home__panel-head">
          <h2 className="admin-dashboard-home__section-title">Последние события</h2>
          <Link to="/admin/logs" className="admin-dashboard-home__link-all">
            Все события
          </Link>
        </div>
        {logsLoading && <LoadingState message="Загрузка событий..." className="admin-dashboard-home__state" />}
        {!logsLoading && logs.length === 0 && (
          <EmptyState
            asCard={false}
            title="Записей пока нет"
            message="Новые системные события появятся здесь после действий пользователей."
            className="admin-dashboard-home__state"
          />
        )}
        <ul className="admin-dashboard-home__feed">
          {logs.map((item) => (
            <li key={item.id} className={`admin-dashboard-home__feed-item ${getLogTypeClass(item.action)}`}>
              <div className="admin-dashboard-home__feed-content">
                <div className="admin-dashboard-home__feed-action">{item.action}</div>
                <div className="admin-dashboard-home__feed-meta">
                  <span className="admin-dashboard-home__feed-user">{item.user}</span>
                  <span className="admin-dashboard-home__feed-time">{formatDateTime(item.timestamp)}</span>
                </div>
                {item.details && <div className="admin-dashboard-home__feed-details">{item.details}</div>}
              </div>
            </li>
          ))}
        </ul>
      </InfoCard>
    </div>
  );
};

export default AdminDashboardHome;