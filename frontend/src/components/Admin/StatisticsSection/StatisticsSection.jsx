import React, { useMemo } from 'react';
import Card from '../../UI/Card/Card';
import './StatisticsSection.scss';

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch {
    return '—';
  }
};

const IconUsers = () => <span className="overview-icon" aria-hidden="true">👥</span>;
const IconUserOff = () => <span className="overview-icon" aria-hidden="true">🚫</span>;
const IconFolder = () => <span className="overview-icon" aria-hidden="true">📁</span>;
const IconBook = () => <span className="overview-icon" aria-hidden="true">📚</span>;
const IconChart = () => <span className="overview-icon overview-icon--panel" aria-hidden="true">📊</span>;
const IconAlert = () => <span className="overview-icon overview-icon--panel" aria-hidden="true">⚠️</span>;
const IconHistory = () => <span className="overview-icon overview-icon--panel" aria-hidden="true">🕒</span>;

const StatisticsSection = ({ stats, users = [], groups = [], subjects = [], logs = [] }) => {
  const studentCount = users.filter((user) => user.role === 'student').length;
  const teacherCount = users.filter((user) => user.role === 'teacher').length;
  const inactiveUsers = users.filter((user) => user.status === 'inactive' || user.isActive === false).length;
  const groupsWithoutStudents = groups.filter((group) => Number(group.studentsCount || 0) === 0).length;
  const inactiveSubjects = subjects.filter((subject) => subject.status === 'inactive').length;

  const topLoadedGroups = useMemo(() => {
    return [...groups]
      .sort((a, b) => Number(b.studentsCount || 0) - Number(a.studentsCount || 0))
      .slice(0, 5);
  }, [groups]);

  const maxStudents = useMemo(() => {
    if (!topLoadedGroups.length) return 1;
    return Math.max(...topLoadedGroups.map((g) => Number(g.studentsCount || 0)), 1);
  }, [topLoadedGroups]);

  const recentEvents = useMemo(() => logs.slice(0, 6), [logs]);

  return (
    <div className="statistics-section">
      <header className="statistics-hero">
        <div className="statistics-hero__text">
          <p className="statistics-hero__eyebrow">Панель администратора</p>
          <h2 className="statistics-hero__title">Обзор системы</h2>
          <p className="statistics-hero__subtitle">
            Ключевые показатели и то, на что стоит обратить внимание в первую очередь.
          </p>
        </div>
      </header>

      <div className="overview-kpi-grid">
        <KpiCard
          title="Всего пользователей"
          value={stats.totalUsers ?? users.length}
          note={`Студентов: ${studentCount} · Преподавателей: ${teacherCount}`}
          tone="primary"
          icon={<IconUsers />}
        />
        <KpiCard
          title="Неактивные пользователи"
          value={inactiveUsers}
          note="Требуют проверки или повторной активации"
          tone={inactiveUsers > 0 ? 'warning' : 'neutral'}
          icon={<IconUserOff />}
        />
        <KpiCard
          title="Пустые группы"
          value={groupsWithoutStudents}
          note="Группы без студентов"
          tone={groupsWithoutStudents > 0 ? 'warning' : 'neutral'}
          icon={<IconFolder />}
        />
        <KpiCard
          title="Неактивные предметы"
          value={inactiveSubjects}
          note="Проверьте статус предметов"
          tone={inactiveSubjects > 0 ? 'warning' : 'neutral'}
          icon={<IconBook />}
        />
      </div>

      <div className="overview-content-grid">
        <Card className="overview-panel" padding="large" shadow="medium">
          <div className="overview-panel__head">
            <span className="overview-panel__icon-wrap overview-panel__icon-wrap--chart">
              <IconChart />
            </span>
            <div>
              <h3 className="overview-panel__title">Нагрузка по группам</h3>
              <p className="overview-panel__desc">Топ групп по числу студентов</p>
            </div>
          </div>
          {topLoadedGroups.length === 0 ? (
            <p className="overview-empty">Нет данных по группам.</p>
          ) : (
            <ul className="load-list">
              {topLoadedGroups.map((group) => {
                const n = Number(group.studentsCount || 0);
                const pct = Math.round((n / maxStudents) * 100);
                return (
                  <li className="load-list__item" key={group.id}>
                    <div className="load-list__row">
                      <span className="load-list__label">{group.name}</span>
                      <span className="load-list__value">
                        {n} <span className="load-list__unit">студ.</span>
                      </span>
                    </div>
                    <div className="load-list__track" role="presentation">
                      <div className="load-list__fill" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="overview-panel" padding="large" shadow="medium">
          <div className="overview-panel__head">
            <span className="overview-panel__icon-wrap overview-panel__icon-wrap--alert">
              <IconAlert />
            </span>
            <div>
              <h3 className="overview-panel__title">Требует внимания</h3>
              <p className="overview-panel__desc">Сводка по работам и справочникам</p>
            </div>
          </div>
          <div className="attention-list">
            <AttentionItem
              label="Работ на проверке"
              value={stats.pendingSubmissions || 0}
              alert={(stats.pendingSubmissions || 0) > 0}
            />
            <AttentionItem
              label="Возвращено на доработку"
              value={stats.returnedSubmissions || 0}
              alert={(stats.returnedSubmissions || 0) > 0}
            />
            <AttentionItem label="Активные предметы" value={stats.activeSubjects || 0} variant="positive" />
            <AttentionItem label="Группы в системе" value={stats.totalGroups ?? groups.length} variant="muted" />
          </div>
        </Card>

        <Card className="overview-panel overview-panel--full" padding="large" shadow="medium">
          <div className="overview-panel__head">
            <span className="overview-panel__icon-wrap overview-panel__icon-wrap--history">
              <IconHistory />
            </span>
            <div>
              <h3 className="overview-panel__title">Последние события</h3>
              <p className="overview-panel__desc">Записи из журнала системы</p>
            </div>
          </div>
          {recentEvents.length === 0 ? (
            <p className="overview-empty">События отсутствуют.</p>
          ) : (
            <ul className="events-timeline">
              {recentEvents.map((event) => (
                <li className="events-timeline__item" key={event.id}>
                  <span className="events-timeline__dot" aria-hidden="true" />
                  <div className="events-timeline__body">
                    <div className="events-timeline__meta">
                      <strong className="events-timeline__user">{event.user || 'Система'}</strong>
                      <time className="events-timeline__time">{formatDateTime(event.timestamp)}</time>
                    </div>
                    <div className="events-timeline__action">{event.action}</div>
                    <div className="events-timeline__details">{event.details || 'Без деталей'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, note, tone = 'primary', icon }) => (
  <Card className={`overview-kpi overview-kpi--${tone}`} padding="medium" shadow="small" bordered>
    <div className="overview-kpi__inner">
      <div className="overview-kpi__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="overview-kpi__main">
        <div className="overview-kpi__title">{title}</div>
        <div className="overview-kpi__value">{value}</div>
        <div className="overview-kpi__note">{note}</div>
      </div>
    </div>
  </Card>
);

const AttentionItem = ({ label, value, alert = false, variant = 'default' }) => (
  <div
    className={`attention-row attention-row--${variant} ${alert ? 'attention-row--alert' : ''}`}
  >
    <span className="attention-row__label">{label}</span>
    <span className="attention-row__value">{value}</span>
  </div>
);

export default StatisticsSection;
