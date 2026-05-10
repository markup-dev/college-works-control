import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import './AdminLogManagement.scss';

const PER_PAGE = 25;
const ROLE_OPTIONS = [
  { value: '', label: 'Все роли' },
  { value: 'student', label: 'Студент' },
  { value: 'teacher', label: 'Преподаватель' },
  { value: 'admin', label: 'Администратор' },
  { value: 'system', label: 'Система (без пользователя)' },
];

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Весь период' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: '7 дней' },
  { value: 'month', label: 'Месяц' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Сначала новые' },
  { value: 'oldest', label: 'Сначала старые' },
];

const formatTs = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return String(val);
  }
};

const userPickerLabel = (u) => {
  if (!u) return '';
  if (u.fullName) return u.fullName;
  const p = [u.lastName, u.firstName, u.middleName].filter(Boolean);
  if (p.length) return p.join(' ');
  return u.login ?? `ID ${u.id}`;
};

const AdminLogManagement = () => {
  const { showSuccess, showError } = useNotification();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [period, setPeriod] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const [userPickerQuery, setUserPickerQuery] = useState('');
  const debouncedUserQuery = useDebouncedValue(userPickerQuery, 300);
  const [userOptions, setUserOptions] = useState([]);
  const [userId, setUserId] = useState('');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const resetDisabled = useMemo(() => {
    return (
      !search &&
      !actionFilter &&
      !roleFilter &&
      period === 'all' &&
      sort === 'newest' &&
      !userId
    );
  }, [search, actionFilter, roleFilter, period, sort, userId]);

  const resetFilters = () => {
    setSearch('');
    setActionFilter('');
    setRoleFilter('');
    setPeriod('all');
    setSort('newest');
    setUserId('');
    setUserPickerQuery('');
    setPage(1);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = { per_page: 40, sort: 'name_asc' };
        const q = debouncedUserQuery.trim();
        if (q) params.search = q;
        const { data } = await api.get('/admin/users', { params });
        const list = Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) setUserOptions(list);
      } catch {
        if (!cancelled) setUserOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedUserQuery]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: PER_PAGE, sort };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      const af = actionFilter.trim();
      if (af) params.action = af;
      if (roleFilter) params.role = roleFilter;
      if (period && period !== 'all') params.period = period;
      if (userId) params.user_id = Number(userId);

      const { data } = await api.get('/admin/logs', { params });
      const list = Array.isArray(data?.data) ? data.data : [];
      setRows(list);
      const m = data?.meta;
      setMeta({
        currentPage: m?.currentPage ?? page,
        lastPage: m?.lastPage ?? 1,
        total: m?.total ?? 0,
      });
    } catch (e) {
      setRows([]);
      setError(firstApiErrorMessage(e.response?.data) || 'Не удалось загрузить журнал');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, actionFilter, roleFilter, period, sort, userId]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter, roleFilter, period, sort, userId]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = { sort };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      const af = actionFilter.trim();
      if (af) params.action = af;
      if (roleFilter) params.role = roleFilter;
      if (period && period !== 'all') params.period = period;
      if (userId) params.user_id = Number(userId);

      const response = await api.get('/admin/logs/export', { params, responseType: 'blob' });
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showSuccess('CSV сохранён (до 5000 записей)');
    } catch (e) {
      showError(firstApiErrorMessage(e.response?.data) || 'Не удалось выгрузить файл');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="admin-log-management">
      <header className="admin-log-management__head">
        <div>
          <h1 className="admin-log-management__title">Системный журнал</h1>
          <p className="admin-log-management__hint">
            События и действия пользователей. Экспорт в CSV учитывает текущие фильтры (лимит 5000 строк,
            разделитель «;», UTF‑8).
          </p>
        </div>
        <div className="admin-log-management__actions">
          <Button type="button" size="small" variant="outline" loading={exporting} onClick={() => void exportCsv()}>
            Скачать CSV
          </Button>
        </div>
      </header>

      {error && (
        <div className="admin-log-management__banner admin-log-management__banner--error" role="alert">
          {error}
          <Button type="button" size="small" variant="outline" onClick={() => void fetchLogs()}>
            Повторить
          </Button>
        </div>
      )}

      <DashboardFilterToolbar
        className="admin-log-management__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по действию, деталям, пользователю…"
        popoverAlign="end"
        popoverAriaLabel="Фильтры журнала"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
      >
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-logs-user-search">
            Пользователь (поиск в списке)
          </label>
          <input
            id="admin-logs-user-search"
            type="search"
            className="search-input"
            placeholder="ФИО или логин…"
            value={userPickerQuery}
            onChange={(e) => setUserPickerQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-logs-user">
            Запись от пользователя
          </label>
          <select
            id="admin-logs-user"
            className="filter-select"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Любой</option>
            {userOptions.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {userPickerLabel(u)} ({u.role})
              </option>
            ))}
          </select>
          <p className="admin-log-management__hint admin-log-management__picker-hint">
            Список обновляется при вводе в поле поиска выше (размер страницы с сервера — до 40).
          </p>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-logs-action">
            Действие (фрагмент)
          </label>
          <input
            id="admin-logs-action"
            type="text"
            className="search-input"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="например admin_broadcast"
            autoComplete="off"
          />
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-logs-role">
            Роль инициатора
          </label>
          <select
            id="admin-logs-role"
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-logs-period">
            Период
          </label>
          <select
            id="admin-logs-period"
            className="filter-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-logs-sort">
            Порядок
          </label>
          <select
            id="admin-logs-sort"
            className="filter-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </DashboardFilterToolbar>

      <div className={`admin-log-management__grid-wrap${loading ? ' admin-log-management__grid-wrap--loading' : ''}`}>
        {!loading && rows.length === 0 ? (
          <p className="admin-log-management__empty">Записи не найдены</p>
        ) : (
          <ol className="admin-log-management__list">
            {rows.map((row) => (
              <li key={row.id} className="admin-log-management__card">
                <div className="admin-log-management__card-top">
                  <span className="admin-log-management__card-time">{formatTs(row.timestamp)}</span>
                  <span className="admin-log-management__badge">{row.userRole ?? '—'}</span>
                </div>
                <p className="admin-log-management__card-user">{row.user}</p>
                <p className="admin-log-management__card-action">{row.action}</p>
                {row.details ? <p className="admin-log-management__card-details">{row.details}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <Pagination
        currentPage={meta.currentPage}
        lastPage={meta.lastPage}
        total={meta.total}
        fallbackCount={rows.length}
        disabled={loading}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
};

export default AdminLogManagement;
