import React, { useEffect, useState } from 'react';
import Badge from '../../UI/Badge/Badge';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import Pagination from '../../UI/Pagination/Pagination';
import { useNotification } from '../../../context/NotificationContext';
import './SystemLogs.scss';

const SystemLogs = ({ logs = [], paginationMeta = {}, query = {}, onFetchLogs }) => {
  const { showSuccess } = useNotification();
  const [filterState, setFilterState] = useState({
    action: 'all',
    period: 'all',
    role: 'all',
    sort: query.sort || 'newest',
    search: '',
    page: query.page || 1,
    perPage: query.perPage || 20,
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    onFetchLogs?.({
      action: filterState.action !== 'all' ? filterState.action : undefined,
      role: filterState.role !== 'all' ? filterState.role : undefined,
      period: filterState.period,
      sort: filterState.sort,
      search: filterState.search || undefined,
      page: filterState.page,
      perPage: filterState.perPage,
    });
  }, [filterState, onFetchLogs]);

  const handleResetFilters = () => {
    setFilterState({
      action: 'all',
      period: 'all',
      role: 'all',
      sort: 'newest',
      search: '',
      page: 1,
      perPage: filterState.perPage,
    });
  };

  const getActionVariant = (action) => {
    if (action.includes('login')) return 'info';
    if (action.includes('create')) return 'success';
    if (action.includes('submit')) return 'warning';
    if (action.includes('grade')) return 'primary';
    return 'default';
  };

  const handleExportLogs = () => {
    const csvContent = [
      ['Время', 'Пользователь', 'Действие', 'Подробности', 'IP'],
      ...logs.map(log => [
        new Date(log.timestamp).toLocaleString('ru-RU'),
        log.user,
        log.action,
        log.details,
        log.ip || 'N/A'
      ])
    ].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    setShowClearConfirm(true);
  };

  const confirmClearLogs = () => {
    showSuccess('Логи очищены (в демо-версии это только имитация)');
    setShowClearConfirm(false);
  };

  return (
    <div className="system-logs">
      <div className="section-header">
        <div className="header-left">
          <h2>Системные логи</h2>
          <p className="log-count">
            Показано {logs.length} из {paginationMeta.total || logs.length} записей
          </p>
        </div>
        <div className="header-actions">
          <Button variant="secondary" size="small" onClick={handleExportLogs}>
            📥 Экспорт CSV
          </Button>
          <Button variant="danger" size="small" onClick={handleClearLogs}>
            🗑️ Очистить логи
          </Button>
        </div>
      </div>

      <Card className="logs-filters">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Тип действия:</label>
            <select 
              value={filterState.action} 
              onChange={(e) => setFilterState((prev) => ({ ...prev, action: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="all">Все действия</option>
              <option value="login">Вход/выход</option>
              <option value="create">Создание</option>
              <option value="submit">Сдача работ</option>
              <option value="grade">Оценка</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Период:</label>
            <select 
              value={filterState.period} 
              onChange={(e) => setFilterState((prev) => ({ ...prev, period: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="all">За всё время</option>
              <option value="today">Сегодня</option>
              <option value="week">Последняя неделя</option>
              <option value="month">Последний месяц</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Роль:</label>
            <select
              value={filterState.role}
              onChange={(e) => setFilterState((prev) => ({ ...prev, role: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="all">Все роли</option>
              <option value="admin">Админ</option>
              <option value="teacher">Преподаватель</option>
              <option value="student">Студент</option>
              <option value="system">Система</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Поиск:</label>
            <input
              type="text"
              placeholder="Поиск по логам..."
              value={filterState.search}
              onChange={(e) => setFilterState((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <label>Сортировка:</label>
            <select
              value={filterState.sort}
              onChange={(e) => setFilterState((prev) => ({ ...prev, sort: e.target.value, page: 1 }))}
              className="filter-select"
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
            </select>
          </div>

          <div className="filter-group filter-group--actions">
            <label>&nbsp;</label>
            <Button variant="outline" size="small" onClick={handleResetFilters}>
              Сбросить фильтры
            </Button>
          </div>
        </div>
      </Card>

      <Card className="logs-table-container">
        {logs.length === 0 ? (
          <div className="empty-logs">
            <div className="empty-icon">📋</div>
            <h3>Логи не найдены</h3>
            <p>Попробуйте изменить параметры фильтрации</p>
          </div>
        ) : (
          <div className="logs-cards">
            {logs.map((log) => (
              <div className="log-card" key={log.id}>
                <div className="log-card__top">
                  <span>{new Date(log.timestamp).toLocaleString('ru-RU')}</span>
                  <Badge variant={getActionVariant(log.action)}>{log.action}</Badge>
                </div>
                <div className="log-card__user">{log.user}</div>
                <div className="log-card__details">{log.details || 'Без подробностей'}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Pagination
        className="logs-pagination"
        currentPage={paginationMeta.currentPage}
        lastPage={paginationMeta.lastPage}
        total={paginationMeta.total}
        fallbackCount={logs.length}
        onPrev={() => setFilterState((prev) => ({ ...prev, page: Math.max(1, (paginationMeta.currentPage || 1) - 1) }))}
        onNext={() => setFilterState((prev) => ({ ...prev, page: (paginationMeta.currentPage || 1) + 1 }))}
      />

      <div className="logs-summary">
        <div className="summary-card">
          <h4>Статистика логов</h4>
          <div className="summary-stats">
            <div className="summary-stat">
              <span className="stat-label">Всего записей:</span>
              <span className="stat-value">{paginationMeta.total || logs.length}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Самая активная:</span>
              <span className="stat-value">
                {(() => {
                  const userCounts = {};
                  logs.forEach(log => {
                    userCounts[log.user] = (userCounts[log.user] || 0) + 1;
                  });
                  const mostActive = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
                  return mostActive ? `${mostActive[0]} (${mostActive[1]})` : 'Нет данных';
                })()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearLogs}
        title="Очистка логов"
        message="Вы уверены, что хотите очистить все логи? Это действие нельзя отменить."
        confirmText="Очистить"
        cancelText="Отмена"
        danger={true}
      />
    </div>
  );
};

export default SystemLogs;