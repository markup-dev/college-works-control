// src/components/Admin/SystemLogs/SystemLogs.jsx
import React, { useState, useMemo } from 'react';
import Table from '../../UI/Table/Table';
import Badge from '../../UI/Badge/Badge';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import { useNotification } from '../../../context/NotificationContext';
import './SystemLogs.scss';

const SystemLogs = ({ logs }) => {
  const { showSuccess } = useNotification();
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredLogs = useMemo(() => {
    let filtered = [...logs];

    // Фильтр по типу действия
    if (filter !== 'all') {
      filtered = filtered.filter(log => {
        if (filter === 'login') return log.action.includes('login');
        if (filter === 'create') return log.action.includes('create');
        if (filter === 'submit') return log.action.includes('submit');
        if (filter === 'grade') return log.action.includes('grade');
        return true;
      });
    }

    // Фильтр по дате
    if (dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        default:
          break;
      }

      filtered = filtered.filter(log => new Date(log.timestamp) >= filterDate);
    }

    // Поиск
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.user.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        log.details.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [logs, filter, dateRange, searchTerm]);

  const getActionVariant = (action) => {
    if (action.includes('login')) return 'info';
    if (action.includes('create')) return 'success';
    if (action.includes('submit')) return 'warning';
    if (action.includes('grade')) return 'primary';
    return 'default';
  };

  const columns = [
    {
      key: 'timestamp',
      title: 'Время',
      width: '15%',
      render: (value) => new Date(value).toLocaleString('ru-RU')
    },
    {
      key: 'user',
      title: 'Пользователь',
      width: '15%'
    },
    {
      key: 'action',
      title: 'Действие',
      width: '20%',
      render: (value) => {
        const actionLabels = {
          login: 'Вход в систему',
          logout: 'Выход из системы',
          create_assignment: 'Создание задания',
          submit_work: 'Сдача работы',
          grade_submission: 'Оценка работы',
          create_course: 'Создание курса',
          update_user: 'Обновление пользователя'
        };
        
        const label = actionLabels[value] || value;
        return (
          <Badge variant={getActionVariant(value)}>
            {label}
          </Badge>
        );
      }
    },
    {
      key: 'details',
      title: 'Подробности',
      width: '45%',
      render: (value) => (
        <span className="log-details">{value}</span>
      )
    },
    {
      key: 'ip',
      title: 'IP',
      width: '10%',
      render: (value) => value || 'N/A'
    }
  ];

  const handleExportLogs = () => {
    const csvContent = [
      ['Время', 'Пользователь', 'Действие', 'Подробности', 'IP'],
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString('ru-RU'),
        log.user,
        log.action,
        log.details,
        log.ip || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
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
    // В реальном приложении здесь был бы вызов API
    showSuccess('Логи очищены (в демо-версии это только имитация)');
    setShowClearConfirm(false);
  };

  return (
    <div className="system-logs">
      <div className="section-header">
        <div className="header-left">
          <h2>Системные логи</h2>
          <p className="log-count">
            Показано {filteredLogs.length} из {logs.length} записей
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
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
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
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="filter-select"
            >
              <option value="all">За всё время</option>
              <option value="today">Сегодня</option>
              <option value="week">Последняя неделя</option>
              <option value="month">Последний месяц</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Поиск:</label>
            <input
              type="text"
              placeholder="Поиск по логам..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </Card>

      <Card className="logs-table-container">
        {filteredLogs.length === 0 ? (
          <div className="empty-logs">
            <div className="empty-icon">📋</div>
            <h3>Логи не найдены</h3>
            <p>Попробуйте изменить параметры фильтрации</p>
          </div>
        ) : (
          <Table
            columns={columns}
            data={filteredLogs}
            striped
            hoverable
            className="logs-table"
          />
        )}
      </Card>

      <div className="logs-summary">
        <div className="summary-card">
          <h4>Статистика логов</h4>
          <div className="summary-stats">
            <div className="summary-stat">
              <span className="stat-label">Всего записей:</span>
              <span className="stat-value">{logs.length}</span>
            </div>
            <div className="summary-stat">
              <span className="stat-label">Отфильтровано:</span>
              <span className="stat-value">{filteredLogs.length}</span>
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