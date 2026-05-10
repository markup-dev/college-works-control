import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useAdmin } from '../../../context/AdminContext';
import api from '../../../services/api';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import './AdminDashboardHome.scss';

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const AdminWeekActivityChart = ({ activityWeek }) => {
  if (!activityWeek?.labels?.length) return null;
  const { labels, submissions, messages, logins } = activityWeek;
  const rows = [
    { key: 'logins', label: 'Входы в систему', values: logins || [] },
    { key: 'sub', label: 'Сдачи работ', values: submissions || [] },
    { key: 'msg', label: 'Сообщения', values: messages || [] },
  ];
  const max = Math.max(1, ...rows.flatMap((r) => r.values));

  return (
    <div className="admin-dashboard-home__chart" aria-label="Активность за неделю">
      <div className="admin-dashboard-home__chart-axis">
        {labels.map((lb) => (
          <span key={lb} className="admin-dashboard-home__chart-day">
            {lb}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.key} className="admin-dashboard-home__chart-row">
          <span className="admin-dashboard-home__chart-label">{row.label}</span>
          <div className="admin-dashboard-home__chart-bars">
            {row.values.map((v, i) => (
              <div
                key={`${row.key}-${i}`}
                className="admin-dashboard-home__chart-bar-wrap"
                title={`${labels[i]}: ${v}`}
              >
                <div
                  className={`admin-dashboard-home__chart-bar admin-dashboard-home__chart-bar--${row.key}`}
                  style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
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

  return (
    <div className="admin-dashboard-home">
      <Card className="admin-dashboard-home__welcome" padding="medium" shadow="small" bordered>
        <h1 className="admin-dashboard-home__welcome-title">
          Добро пожаловать{displayName ? `, ${displayName}` : ''}
        </h1>
        <p className="admin-dashboard-home__welcome-meta">
          Последний вход: {formatDateTime(user?.lastLogin)}
        </p>
      </Card>

      {statsError && (
        <div className="admin-dashboard-home__banner admin-dashboard-home__banner--error" role="alert">
          <span>{statsError}</span>
          <Button type="button" variant="secondary" onClick={refreshStats} className="admin-dashboard-home__retry">
            Повторить
          </Button>
        </div>
      )}

      <section className="admin-dashboard-home__widgets" aria-label="Ключевые показатели">
        {statsLoading && !stats && <p className="admin-dashboard-home__muted">Загрузка метрик…</p>}
        {stats && (
          <>
            <Link className="admin-metric-tile" to="/admin/users">
              <div className="admin-metric-tile__value">{stats.totalUsers ?? 0}</div>
              <div className="admin-metric-tile__label">Пользователей</div>
              <div className="admin-metric-tile__hint">
                <span className="admin-metric-tile__delta">+{stats.usersCreatedLast7Days ?? 0}</span> за неделю
              </div>
            </Link>
            <Link className="admin-metric-tile" to="/admin/groups">
              <div className="admin-metric-tile__value">{stats.totalGroups ?? 0}</div>
              <div className="admin-metric-tile__label">Групп</div>
              <div className="admin-metric-tile__hint">
                <span className="admin-metric-tile__pill admin-metric-tile__pill--ok">
                  активн.: {stats.groupsActive ?? 0}
                </span>
                <span className="admin-metric-tile__pill admin-metric-tile__pill--muted">
                  закр.: {stats.groupsInactive ?? 0}
                </span>
              </div>
            </Link>
            <Link className="admin-metric-tile" to="/admin/homework">
              <div className="admin-metric-tile__value">{stats.assignmentsActive ?? 0}</div>
              <div className="admin-metric-tile__label">Активных заданий</div>
              <div className="admin-metric-tile__hint">
                <span className="admin-metric-tile__pill admin-metric-tile__pill--warn">
                  проср.: {stats.assignmentsOverdue ?? 0}
                </span>
                <span className="admin-metric-tile__pill admin-metric-tile__pill--ok">
                  в срок: {stats.assignmentsActiveOnTrack ?? 0}
                </span>
              </div>
            </Link>
            <Link className="admin-metric-tile" to="/admin/homework?filter=overdue_checks">
              <div className="admin-metric-tile__value">{stats.submissionsStaleReview ?? 0}</div>
              <div className="admin-metric-tile__label">На контроле</div>
              <div className="admin-metric-tile__cta">Работ без проверки более 3 суток</div>
            </Link>
          </>
        )}
      </section>

      <section className="admin-dashboard-home__quick" aria-label="Быстрые действия">
        <h2 className="admin-dashboard-home__section-title">Быстрые действия</h2>
        <div className="admin-dashboard-home__quick-grid">
          <Link className="admin-dashboard-home__quick-link" to="/admin/users" state={{ openCreateUser: true }}>
            Создать пользователя
          </Link>
          <Link className="admin-dashboard-home__quick-link" to="/admin/groups" state={{ openCreateGroup: true }}>
            Новая группа
          </Link>
          <Link className="admin-dashboard-home__quick-link" to="/admin/subjects" state={{ openCreateSubject: true }}>
            Новый предмет
          </Link>
          <Link className="admin-dashboard-home__quick-link" to="/admin/users" state={{ openImportUsers: true }}>
            Импорт пользователей
          </Link>
        </div>
      </section>

      <Card className="admin-dashboard-home__panel" padding="medium" shadow="small" bordered>
        <h2 className="admin-dashboard-home__section-title">Активность за неделю</h2>
        {activityWeek ? (
          <AdminWeekActivityChart activityWeek={activityWeek} />
        ) : (
          <p className="admin-dashboard-home__muted">Нет данных для графика</p>
        )}
      </Card>

      <Card className="admin-dashboard-home__panel" padding="medium" shadow="small" bordered>
        <div className="admin-dashboard-home__panel-head">
          <h2 className="admin-dashboard-home__section-title">Последние события</h2>
          <Link to="/admin/logs" className="admin-dashboard-home__link-all">
            Все события
          </Link>
        </div>
        {logsLoading && <p className="admin-dashboard-home__muted">Загрузка…</p>}
        {!logsLoading && logs.length === 0 && (
          <p className="admin-dashboard-home__muted">Записей пока нет</p>
        )}
        <ul className="admin-dashboard-home__feed">
          {logs.map((item) => (
            <li key={item.id} className="admin-dashboard-home__feed-item">
              <div className="admin-dashboard-home__feed-action">{item.action}</div>
              <div className="admin-dashboard-home__feed-meta">
                <span>{item.user}</span>
                <span>{formatDateTime(item.timestamp)}</span>
              </div>
              {item.details && (
                <div className="admin-dashboard-home__feed-details">{item.details}</div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default AdminDashboardHome;
