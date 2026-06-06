import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { getApiErrorMessage } from '../../../utils/adminApiErrors';
import { formatDateLong } from '../../../utils/dateHelpers';
import { sanitizeSubjectCodeInput, SUBJECT_CODE_MAX_LENGTH } from '../../../utils/validation';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import EmptyState from '../../UI/EmptyState/EmptyState';
import EntityCard from '../../UI/EntityCard/EntityCard';
import ErrorBanner from '../../UI/ErrorBanner/ErrorBanner';
import LoadingState from '../../UI/LoadingState/LoadingState';
import Modal from '../../UI/Modal/Modal';
import ModalDangerZone from '../../UI/Modal/ModalDangerZone';
import ModalSection from '../../UI/Modal/ModalSection';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import { ADMIN_CARD_GRID_PAGE_SIZE } from '../../../config/adminPagination';
import usePaginationClamp from '../../../hooks/usePaginationClamp';
import { parsePaginationMeta } from '../../../utils/pagination';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import TeacherRequestModeration from '../TeacherRequestModeration/TeacherRequestModeration';
import AdminSubjectsImportModal from '../AdminSubjectsImportModal/AdminSubjectsImportModal';
import './AdminSubjectManagement.scss';


const SUBJECT_STATUS_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'inactive', label: 'Неактивные' },
];

const SUBJECT_SORT_OPTIONS = [
  { value: 'name_asc', label: 'Название (А–Я)' },
  { value: 'name_desc', label: 'Название (Я–А)' },
  { value: 'newest', label: 'Сначала новые' },
  { value: 'oldest', label: 'Сначала старые' },
];

const subjectStatusLabel = (value) => (value === 'inactive' ? 'Неактивен' : 'Активен');

const shortName = (lastName, firstName, middleName) => {
  const a = firstName?.trim()?.[0];
  const b = middleName?.trim()?.[0];
  const parts = [];
  if (a) parts.push(`${a}.`);
  if (b) parts.push(`${b}.`);
  const io = parts.join('');
  return [lastName, io].filter(Boolean).join(' ').trim() || '—';
};

const AdminSubjectManagement = () => {
  const { showSuccess, showError } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name_asc');
  const [page, setPage] = useState(1);

  const [subjects, setSubjects] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [viewId, setViewId] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [addLoadOpen, setAddLoadOpen] = useState(false);
  const [addLoadTeacherId, setAddLoadTeacherId] = useState('');
  const [addLoadGroupIds, setAddLoadGroupIds] = useState(() => new Set());
  const [addLoadTeachers, setAddLoadTeachers] = useState([]);
  const [addLoadGroups, setAddLoadGroups] = useState([]);
  const [addLoadSubmitting, setAddLoadSubmitting] = useState(false);

  useEffect(() => {
    const st = location.state;
    if (!st || typeof st !== 'object') return;
    let consumed = false;

    if (st.openCreateSubject) {
      setCreateOpen(true);
      consumed = true;
    }
    if (st.openImportSubjects) {
      setImportOpen(true);
      consumed = true;
    }
    if (st.viewSubjectId != null && st.viewSubjectId !== '') {
      setViewId(Number(st.viewSubjectId));
      consumed = true;
    }

    if (consumed) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: ADMIN_CARD_GRID_PAGE_SIZE,
        sort: sort || 'name_asc',
      };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (status) params.status = status;
      const { data } = await api.get('/admin/subjects', { params });
      setSubjects(Array.isArray(data?.data) ? data.data : []);
      const m = data?.meta;
      setMeta(parsePaginationMeta(m, page));
    } catch (e) {
      setSubjects([]);
      setError(getApiErrorMessage(e, 'Не удалось загрузить дисциплины'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, sort]);

  usePaginationClamp(page, meta.lastPage, setPage);

  useEffect(() => {
    void fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, sort]);

  useEffect(() => {
    if (viewId == null) {
      setViewData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setViewLoading(true);
      try {
        const { data } = await api.get(`/admin/subjects/${viewId}`);
        if (!cancelled) setViewData(data);
      } catch (e) {
        if (!cancelled) {
          setViewData(null);
          showError(getApiErrorMessage(e, 'Не удалось загрузить дисциплину'));
        }
      } finally {
        if (!cancelled) setViewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewId, showError]);

  useEffect(() => {
    if (!addLoadOpen || !viewId || !viewData?.subject?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/teaching-loads/form-options', {
          params: { subject_id: Number(viewData.subject.id) },
        });
        if (!cancelled) {
          setAddLoadTeachers(Array.isArray(data?.teachers) ? data.teachers : []);
        }
      } catch (e) {
        if (!cancelled) {
          setAddLoadTeachers([]);
          showError(getApiErrorMessage(e, 'Не удалось загрузить преподавателей'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addLoadOpen, viewId, viewData?.subject?.id, showError]);

  useEffect(() => {
    if (!addLoadOpen || !viewData?.subject?.id || !addLoadTeacherId) {
      setAddLoadGroups([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/teaching-loads/form-options', {
          params: {
            subject_id: Number(viewData.subject.id),
            teacher_id: Number(addLoadTeacherId),
          },
        });
        if (!cancelled) {
          setAddLoadGroups(Array.isArray(data?.groups) ? data.groups : []);
        }
      } catch (e) {
        if (!cancelled) {
          setAddLoadGroups([]);
          showError(getApiErrorMessage(e, 'Не удалось загрузить группы'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addLoadOpen, viewData?.subject?.id, addLoadTeacherId, showError]);

  useEffect(() => {
    if (!addLoadTeacherId) {
      setAddLoadGroupIds(new Set());
      return;
    }
    const available = new Set(addLoadGroups.map((g) => Number(g.id)));
    setAddLoadGroupIds((prev) => new Set([...prev].filter((id) => available.has(Number(id)))));
  }, [addLoadTeacherId, addLoadGroups]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatus('');
    setSort('name_asc');
    setPage(1);
  }, []);

  const resetDisabled = useMemo(() => !search.trim() && !status && sort === 'name_asc', [search, status, sort]);

  const openCreate = () => {
    setCreateName('');
    setCreateCode('');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    setCreateSubmitting(true);
    try {
      await api.post('/admin/subjects', {
        name: createName.trim(),
        code: createCode.trim(),
        status: 'active',
      });
      showSuccess('Дисциплина создан');
      setCreateOpen(false);
      void fetchSubjects();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось создать дисциплину'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditName(row.name || '');
    setEditCode(row.code || '');
    setEditStatus(row.status === 'inactive' ? 'inactive' : 'active');
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setEditSubmitting(true);
    try {
      await api.put(`/admin/subjects/${editRow.id}`, {
        name: editName.trim(),
        code: editCode.trim(),
        status: editStatus,
      });
      showSuccess('Изменения сохранены');
      setEditRow(null);
      void fetchSubjects();
      if (viewId === editRow.id) {
        try {
          const { data } = await api.get(`/admin/subjects/${editRow.id}`);
          setViewData(data);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const toggleSubjectStatus = async (row) => {
    const nextStatus = row.status === 'inactive' ? 'active' : 'inactive';
    try {
      await api.put(`/admin/subjects/${row.id}`, { status: nextStatus });
      showSuccess(nextStatus === 'active' ? 'Дисциплина активирован' : 'Дисциплина деактивирован');
      void fetchSubjects();
      if (viewId === row.id) {
        try {
          const { data } = await api.get(`/admin/subjects/${row.id}`);
          setViewData(data);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось изменить статус дисциплины'));
    }
  };

  const openDelete = async (row) => {
    setDeleteTarget(row);
    setDeleteConfirmCode('');
    setDeletePreview(null);
    try {
      const { data } = await api.get(`/admin/subjects/${row.id}`);
      setDeletePreview(data);
    } catch {
      setDeletePreview(null);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget || deleteConfirmCode.trim() !== deleteTarget.code) {
      showError('Введите точный код дисциплины');
      return;
    }
    setDeleteSubmitting(true);
    try {
      await api.delete(`/admin/subjects/${deleteTarget.id}`);
      showSuccess('Дисциплина удалён');
      setDeleteTarget(null);
      setDeletePreview(null);
      setDeleteConfirmCode('');
      if (viewId === deleteTarget.id) setViewId(null);
      void fetchSubjects();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось удалить'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const openAddLoad = () => {
    setAddLoadTeacherId('');
    setAddLoadGroupIds(new Set());
    setAddLoadOpen(true);
  };

  const submitAddLoad = async () => {
    if (!viewData?.subject?.id || !addLoadTeacherId) {
      showError('Выберите преподавателя и хотя бы одну группу');
      return;
    }
    const gids = Array.from(addLoadGroupIds);
    if (gids.length === 0) {
      showError('Отметьте хотя бы одну группу');
      return;
    }
    setAddLoadSubmitting(true);
    try {
      await Promise.all(
        gids.map((groupId) =>
          api.post('/admin/teaching-loads', {
            teacherId: Number(addLoadTeacherId),
            subjectId: viewData.subject.id,
            groupId: Number(groupId),
            status: 'active',
          })
        )
      );
      showSuccess('Назначения добавлены');
      setAddLoadOpen(false);
      try {
        const { data } = await api.get(`/admin/subjects/${viewData.subject.id}`);
        setViewData(data);
      } catch {
        /* ignore */
      }
      void fetchSubjects();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось добавить назначение'));
    } finally {
      setAddLoadSubmitting(false);
    }
  };

  const refreshAfterDisciplineRequest = async () => {
    await fetchSubjects();
    if (viewData?.subject?.id) {
      try {
        const { data } = await api.get(`/admin/subjects/${viewData.subject.id}`);
        setViewData(data);
      } catch {
        /* ignore */
      }
    }
  };

  const handleSubjectsImported = useCallback(
    (data) => {
      const created = data?.summary?.created ?? 0;
      showSuccess(`Импорт завершён: добавлено дисциплин — ${created}.`);
      void fetchSubjects();
    },
    [fetchSubjects, showSuccess],
  );

  return (
    <div className="admin-subject-management">
      <div className="admin-subject-management__head">
        <h1 className="admin-subject-management__title">Дисциплины</h1>
      </div>

      <TeacherRequestModeration
        kind="discipline"
        title="Заявки на допуск к дисциплинам"
        emptyMessage="Новых заявок на допуск нет"
        onResolved={refreshAfterDisciplineRequest}
      />

      <DashboardFilterToolbar
        className="admin-subject-management__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по названию или коду дисциплины…"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        popoverAlign="end"
        popoverAriaLabel="Фильтры списка дисциплин"
      >
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-subject-status-filter">
            Статус
          </label>
          <select
            id="admin-subject-status-filter"
            className="filter-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {SUBJECT_STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-subject-sort-filter">
            Сортировка
          </label>
          <select
            id="admin-subject-sort-filter"
            className="filter-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {SUBJECT_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </DashboardFilterToolbar>

      <div className="admin-subject-management__actions">
        <Button type="button" variant="primary" onClick={openCreate}>
          Новая дисциплина
        </Button>
        <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
          Импорт CSV
        </Button>
      </div>

      {error && (
        <ErrorBanner
          className="admin-subject-management__error"
          title="Ошибка загрузки дисциплин"
          message={error}
          actionLabel="Повторить"
          onAction={() => void fetchSubjects()}
        />
      )}

      <div className={`admin-subject-management__grid-wrap${loading ? ' admin-subject-management__grid-wrap--loading' : ''}`}>
        {loading && <LoadingState message="Загрузка дисциплин..." className="admin-subject-management__state" />}
        {!loading && subjects.length === 0 && !error && (
          <EmptyState
            title="Дисциплины не найдены"
            message="Попробуйте изменить параметры поиска или фильтрации"
            className="admin-subject-management__state"
          />
        )}
        {!loading && subjects.length > 0 && (
          <div className="admin-subject-management__card-grid">
            {subjects.map((row) => {
              const t = row.teachersCount ?? 0;
              const g = row.groupsCount ?? 0;
              const a = row.assignmentsCount ?? 0;
              const isActive = row.status !== 'inactive';
              return (
                <EntityCard
                  key={row.id}
                  className="admin-subject-card"
                  padding="small"
                  interactive
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewId(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setViewId(row.id);
                    }
                  }}
                >
                  <div className="admin-subject-card__body">
                    <div className="admin-subject-card__top">
                      <div className="admin-subject-card__title-block">
                        <div className="admin-subject-card__title">{row.name}</div>
                        {row.code ? (
                          <span className="admin-subject-card__code">{row.code}</span>
                        ) : null}
                      </div>
                      <StatusBadge tone={isActive ? 'success' : 'neutral'} className="admin-subject-card__status">
                        {subjectStatusLabel(row.status)}
                      </StatusBadge>
                    </div>
                    <div className="admin-subject-card__fields">
                      <div className="admin-subject-card__row admin-subject-card__row--labeled">
                        <span className="admin-subject-card__label">Преподавателей</span>
                        <span className="admin-subject-card__value">{t}</span>
                      </div>
                      <div className="admin-subject-card__row admin-subject-card__row--labeled">
                        <span className="admin-subject-card__label">Групп</span>
                        <span className="admin-subject-card__value">{g}</span>
                      </div>
                      <div className="admin-subject-card__row admin-subject-card__row--labeled">
                        <span className="admin-subject-card__label">Заданий</span>
                        <span className="admin-subject-card__value">{a}</span>
                      </div>
                    </div>
                  </div>
                </EntityCard>
              );
            })}
          </div>
        )}
      </div>

      <Pagination
        className="admin-subject-management__pagination"
        currentPage={meta.currentPage}
        lastPage={meta.lastPage}
        total={meta.total}
        fallbackCount={subjects.length}
        disabled={loading}
        hideWhenSinglePage
        onPageChange={setPage}
      />

      <Modal
        isOpen={createOpen}
        onClose={() => !createSubmitting && setCreateOpen(false)}
        title="Новая дисциплина"
        size="medium"
        contentClassName="admin-subject-form"
        footer={(
          <>
            <Button
              type="button"
              variant="primary"
              loading={createSubmitting}
              disabled={createSubmitting || createName.trim().length < 2 || !createCode.trim()}
              onClick={() => void submitCreate()}
            >
              Создать
            </Button>
          </>
        )}
      >
        <ModalSection title="Данные дисциплины">
          <label className="admin-subject-form__label">
            Название
            <input
              className="admin-subject-form__input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Например: Базы данных"
              autoComplete="off"
            />
          </label>
          <label className="admin-subject-form__label">
            Код
            <input
              className="admin-subject-form__input admin-subject-form__input--code"
              value={createCode}
              onChange={(e) => setCreateCode(sanitizeSubjectCodeInput(e.target.value))}
              placeholder="БД-301"
              maxLength={SUBJECT_CODE_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <p className="admin-subject-form__hint">
            Только заглавные буквы (А–Я или A–Z), цифры, точка, дефис и подчёркивание. Код уникален в каталоге.
          </p>
        </ModalSection>
      </Modal>

      <Modal
        isOpen={!!editRow}
        onClose={() => !editSubmitting && setEditRow(null)}
        title="Редактировать дисциплину"
        size="medium"
        contentClassName="admin-subject-form"
        footer={(
          <>
            <Button
              type="button"
              variant="primary"
              loading={editSubmitting}
              disabled={editSubmitting || editName.trim().length < 2 || !editCode.trim()}
              onClick={() => void submitEdit()}
            >
              Сохранить
            </Button>
          </>
        )}
      >
        <ModalSection title="Данные дисциплины">
          <label className="admin-subject-form__label">
            Название
            <input
              className="admin-subject-form__input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Например: Базы данных"
              autoComplete="off"
            />
          </label>
          <label className="admin-subject-form__label">
            Код
            <input
              className="admin-subject-form__input admin-subject-form__input--code"
              value={editCode}
              onChange={(e) => setEditCode(sanitizeSubjectCodeInput(e.target.value))}
              placeholder="БД-301"
              maxLength={SUBJECT_CODE_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="admin-subject-form__label">
            Статус
            <select
              className="admin-subject-form__input"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              <option value="active">Активен</option>
              <option value="inactive">Неактивен</option>
            </select>
          </label>
          <p className="admin-subject-form__hint">
            При изменении кода задания сохраняют привязку к этой же записи дисциплины.
          </p>
        </ModalSection>
      </Modal>

      <Modal
        isOpen={viewId != null}
        onClose={() => setViewId(null)}
        title="Дисциплина"
        size="large"
        contentClassName="admin-subject-view-modal"
        footer={!viewLoading && viewData?.subject ? (
          <>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                const s = viewData.subject;
                setViewId(null);
                openEdit({ id: s.id, name: s.name, code: s.code, status: s.status });
              }}
            >
              Редактировать
            </Button>
            <Button type="button" variant="outline" onClick={openAddLoad}>
              Добавить назначение
            </Button>
          </>
        ) : null}
      >
        {viewLoading && <LoadingState message="Загрузка..." className="admin-subject-management__state" />}
        {!viewLoading && viewData?.subject && (
          <div className="admin-subject-view">
            <section className="admin-subject-view__hero">
              <div>
                <span className="admin-subject-view__eyebrow">Дисциплина</span>
                <h3 className="admin-subject-view__name">{viewData.subject.name}</h3>
                <p className="admin-subject-view__code">Код: {viewData.subject.code}</p>
                <StatusBadge
                  tone={viewData.subject.status === 'inactive' ? 'neutral' : 'success'}
                  className="admin-subject-view__status"
                >
                  {subjectStatusLabel(viewData.subject.status)}
                </StatusBadge>
              </div>
              <div className="admin-subject-view__created">
                <span>Создан</span>
                <strong>{formatDateLong(viewData.subject.createdAt)}</strong>
              </div>
            </section>
            {viewData.stats && (
              <ModalSection title="Показатели" variant="soft">
                <div className="admin-subject-view__stats-grid">
                  <div className="admin-subject-view__stat-card">
                    <span>Преподавателей</span>
                    <strong>{viewData.stats.teachersCount}</strong>
                  </div>
                  <div className="admin-subject-view__stat-card">
                    <span>Групп</span>
                    <strong>{viewData.stats.groupsCount}</strong>
                  </div>
                  <div className="admin-subject-view__stat-card">
                    <span>Назначений</span>
                    <strong>{viewData.stats.teachingLoadsCount ?? viewData.teachingLoads?.length ?? 0}</strong>
                  </div>
                  <div className="admin-subject-view__stat-card">
                    <span>Заданий</span>
                    <strong>{viewData.stats.assignmentsCount}</strong>
                  </div>
                  <div className="admin-subject-view__stat-card">
                    <span>Активных заданий</span>
                    <strong>{viewData.stats.activeAssignmentsCount}</strong>
                  </div>
                  <div className="admin-subject-view__stat-card">
                    <span>Сданных работ</span>
                    <strong>{viewData.stats.submissionsCount}</strong>
                  </div>
                </div>
              </ModalSection>
            )}
            <ModalSection title={`Назначения (${viewData.teachingLoads?.length ?? 0})`}>
              {!viewData.teachingLoads?.length && (
                <EmptyState
                  title="Назначений пока нет"
                  message="Добавьте преподавателя и группу через кнопку «Добавить назначение»."
                />
              )}
              {viewData.teachingLoads?.length > 0 && (
                <ul className="admin-subject-view__loads">
                  {viewData.teachingLoads.map((row) => (
                    <li key={row.teachingLoadId} className="admin-subject-view__load-card">
                      <div className="admin-subject-view__load-top">
                        <strong>
                          {row.teacher
                            ? shortName(row.teacher.lastName, row.teacher.firstName, row.teacher.middleName)
                            : '—'}
                        </strong>
                      </div>
                      <div className="admin-subject-view__load-fields">
                        <div className="admin-subject-view__load-row">
                          <span>Группа</span>
                          <span>{row.group?.name || '—'}</span>
                        </div>
                        <div className="admin-subject-view__load-row">
                          <span>Активных заданий</span>
                          <span>{row.activeAssignmentsCount ?? 0}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ModalSection>

            <ModalDangerZone
              title="Статус и удаление"
              description="Деактивация скрывает дисциплину из новых назначений. Удаление доступно, если нет активных связей."
            >
              <Button
                type="button"
                variant={viewData.subject.status === 'inactive' ? 'primary' : 'warning'}
                size="small"
                onClick={() => void toggleSubjectStatus(viewData.subject)}
              >
                {viewData.subject.status === 'inactive' ? 'Активировать' : 'Деактивировать'}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="small"
                onClick={() => {
                  const s = viewData.subject;
                  setViewId(null);
                  void openDelete({ id: s.id, name: s.name, code: s.code });
                }}
              >
                Удалить дисциплину
              </Button>
            </ModalDangerZone>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={addLoadOpen}
        onClose={() => !addLoadSubmitting && setAddLoadOpen(false)}
        title="Новое назначение"
        size="medium"
        contentClassName="admin-subject-form admin-subject-add-load"
        footer={(
          <>
            <Button type="button" variant="primary" loading={addLoadSubmitting} onClick={() => void submitAddLoad()}>
              Создать
            </Button>
          </>
        )}
      >
        <ModalSection title="Преподаватель и группы">
          <label className="admin-subject-form__label">
            Преподаватель
            <select
              className="admin-subject-form__input"
              value={addLoadTeacherId}
              onChange={(e) => {
                setAddLoadTeacherId(e.target.value);
                setAddLoadGroupIds(new Set());
              }}
            >
              <option value="">Выберите</option>
              {addLoadTeachers.map((u) => (
                <option key={u.id} value={u.id}>
                  {shortName(u.lastName, u.firstName, u.middleName)}
                </option>
              ))}
            </select>
          </label>
          {addLoadTeachers.length === 0 && (
            <p className="admin-subject-management__hint">Нет преподавателей с допуском к этой дисциплине.</p>
          )}
          <div className="admin-subject-form__label">Группы</div>
          {!addLoadTeacherId ? (
            <p className="admin-subject-management__hint">Сначала выберите преподавателя.</p>
          ) : addLoadGroups.length === 0 ? (
            <p className="admin-subject-management__hint">
              Нет свободных групп: все подходящие уже назначены этому преподавателю или нет групп с дисциплиной на текущем курсе.
            </p>
          ) : (
          <div className="admin-subject-add-load__groups">
            {addLoadGroups.map((gr) => (
              <label key={gr.id} className="admin-subject-add-load__cb">
                <input
                  type="checkbox"
                  checked={addLoadGroupIds.has(gr.id)}
                  onChange={(e) => {
                    const next = new Set(addLoadGroupIds);
                    if (e.target.checked) next.add(gr.id);
                    else next.delete(gr.id);
                    setAddLoadGroupIds(next);
                  }}
                />
                {gr.name}
              </label>
            ))}
          </div>
          )}
        </ModalSection>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleteSubmitting && setDeleteTarget(null)}
        title={deleteTarget ? `Удалить дисциплину «${deleteTarget.name}»` : 'Удаление'}
        size="medium"
        contentClassName="admin-subject-form"
        footer={(
          <>
            <Button type="button" variant="danger" loading={deleteSubmitting} onClick={() => void submitDelete()}>
              Удалить
            </Button>
          </>
        )}
      >
        <ModalSection title="Подтверждение удаления" variant="danger">
          {deletePreview?.stats && (
            <p className="admin-subject-form__warn">
              Связано: преподавателей {deletePreview.stats.teachersCount}, групп {deletePreview.stats.groupsCount},
              заданий {deletePreview.stats.assignmentsCount}, сданных работ {deletePreview.stats.submissionsCount}.
              Назначения будут удалены; задания останутся без привязки к дисциплине.
            </p>
          )}
          <label className="admin-subject-form__label">
            Введите код дисциплины для подтверждения
            <input
              className="admin-subject-form__input"
              value={deleteConfirmCode}
              onChange={(e) => setDeleteConfirmCode(e.target.value)}
              placeholder={deleteTarget?.code || ''}
              autoComplete="off"
            />
          </label>
        </ModalSection>
      </Modal>
      <AdminSubjectsImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleSubjectsImported}
      />
    </div>
  );
};

export default AdminSubjectManagement;
