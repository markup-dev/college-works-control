import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { getApiErrorMessage } from '../../../utils/adminApiErrors';
import { formatDateTimeWithSeconds } from '../../../utils/dateHelpers';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import EmptyState from '../../UI/EmptyState/EmptyState';
import EntityCard from '../../UI/EntityCard/EntityCard';
import ErrorBanner from '../../UI/ErrorBanner/ErrorBanner';
import LoadingState from '../../UI/LoadingState/LoadingState';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import { ADMIN_LIST_PAGE_SIZE } from '../../../config/adminPagination';
import usePaginationClamp from '../../../hooks/usePaginationClamp';
import { parsePaginationMeta } from '../../../utils/pagination';
import './AdminLogManagement.scss';

const AdminLogManagement = () => {
  const { showSuccess, showError } = useNotification();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const resetDisabled = useMemo(() => {
    return (
      !search
    );
  }, [search]);

  const resetFilters = () => {
    setSearch('');
    setPage(1);
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: ADMIN_LIST_PAGE_SIZE, sort: 'newest' };
      const q = debouncedSearch.trim();
      if (q) params.search = q;

      const { data } = await api.get('/admin/logs', { params });
      const list = Array.isArray(data?.data) ? data.data : [];
      setRows(list);
      const m = data?.meta;
      setMeta(parsePaginationMeta(m, page));
    } catch (e) {
      setRows([]);
      setError(getApiErrorMessage(e, 'Не удалось загрузить журнал'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  usePaginationClamp(page, meta.lastPage, setPage);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = { sort: 'newest' };
      const q = debouncedSearch.trim();
      if (q) params.search = q;

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
      showError(getApiErrorMessage(e, 'Не удалось выгрузить файл'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="admin-log-management">
      <header className="admin-log-management__head">
        <div>
          <h1 className="admin-log-management__title">Системный журнал</h1>
          <p className="admin-log-management__hint">Экспорт CSV — по текущим фильтрам, до 5000 строк.</p>
        </div>
        <div className="admin-log-management__actions">
          <Button type="button" size="small" variant="outline" loading={exporting} onClick={() => void exportCsv()}>
            Скачать CSV
          </Button>
        </div>
      </header>

      {error && (
        <ErrorBanner
          className="admin-log-management__error"
          title="Ошибка загрузки журнала"
          message={error}
          actionLabel="Повторить"
          onAction={() => void fetchLogs()}
        />
      )}

      <DashboardFilterToolbar
        className="admin-log-management__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по действию, деталям, логину или ФИО…"
        popoverAlign="end"
        popoverAriaLabel="Фильтры журнала"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        showFilterPanel={false}
      />

      <div className={`admin-log-management__grid-wrap${loading ? ' admin-log-management__grid-wrap--loading' : ''}`}>
        {loading && rows.length === 0 ? (
          <LoadingState message="Загрузка журнала..." className="admin-log-management__state" />
        ) : !loading && rows.length === 0 ? (
          <EmptyState
            title="Записи не найдены"
            message="Попробуйте изменить параметры поиска."
            className="admin-log-management__state"
          />
        ) : (
          <ol className="admin-log-management__list">
            {rows.map((row) => (
              <EntityCard key={row.id} as="li" className="admin-log-management__card" interactive={false}>
                <div className="admin-log-management__card-top">
                  <span className="admin-log-management__card-time">{formatDateTimeWithSeconds(row.timestamp)}</span>
                  <span className="admin-log-management__badge">{row.userRole ?? '—'}</span>
                </div>
                <p className="admin-log-management__card-user">{row.user}</p>
                <p className="admin-log-management__card-action">{row.action}</p>
                {row.details ? <p className="admin-log-management__card-details">{row.details}</p> : null}
              </EntityCard>
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
        hideWhenSinglePage
        onPageChange={setPage}
      />
    </div>
  );
};

export default AdminLogManagement;
