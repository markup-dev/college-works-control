import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import Card from '../../UI/Card/Card';
import Modal from '../../UI/Modal/Modal';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import './AdminAssignmentManagement.scss';

const PER_PAGE = 18;
const LIST_LIMIT = 100;

const SORT_OPTIONS = [
  { value: 'deadline_asc', label: 'Дедлайн (ближайшие)' },
  { value: 'deadline_desc', label: 'Дедлайн (дальние)' },
  { value: 'created_desc', label: 'Созданы (новые)' },
  { value: 'created_asc', label: 'Созданы (старые)' },
  { value: 'submissions_desc', label: 'Больше сдач' },
  { value: 'submissions_asc', label: 'Меньше сдач' },
];

const STATUS_PACK_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активно' },
  { value: 'overdue', label: 'Просрочен дедлайн' },
  { value: 'stale_review', label: 'На проверке > 3 дн.' },
  { value: 'inactive', label: 'Приостановлено' },
  { value: 'archived', label: 'Закрыто' },
];

const statusBadge = (row) => {
  if (row.displayOverdue) {
    return { key: 'overdue', label: 'Просрочено' };
  }
  if (row.status === 'archived') {
    return { key: 'archived', label: 'Закрыто' };
  }
  if (row.status === 'inactive') {
    return { key: 'inactive', label: 'Приостановлено' };
  }
  return { key: 'active', label: 'Активно' };
};

const AdminAssignmentManagement = () => {
  const { showSuccess, showError } = useNotification();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [statusPack, setStatusPack] = useState('all');
  const [sort, setSort] = useState('deadline_asc');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);

  const [openMenuId, setOpenMenuId] = useState(null);

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [reassignRow, setReassignRow] = useState(null);
  const [eligibleTeachers, setEligibleTeachers] = useState([]);
  const [reassignTeacherId, setReassignTeacherId] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get('filter') === 'overdue_checks') {
      setStatusPack('stale_review');
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, s, g] = await Promise.all([
          api.get('/admin/users', { params: { role: 'teacher', per_page: LIST_LIMIT, sort: 'name_asc' } }),
          api.get('/admin/subjects', { params: { per_page: LIST_LIMIT, sort: 'name_asc' } }),
          api.get('/admin/groups', { params: { per_page: LIST_LIMIT, sort: 'name_asc' } }),
        ]);
        if (cancelled) return;
        setTeachers(Array.isArray(t.data?.data) ? t.data.data : []);
        setSubjects(Array.isArray(s.data?.data) ? s.data.data : []);
        setGroups(Array.isArray(g.data?.data) ? g.data.data : []);
      } catch {
        if (!cancelled) {
          setTeachers([]);
          setSubjects([]);
          setGroups([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teacherLabel = (u) => {
    if (!u) return '—';
    if (u.fullName) return u.fullName;
    const p = [u.lastName, u.firstName, u.middleName].filter(Boolean);
    return p.length ? p.join(' ') : '—';
  };

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: PER_PAGE, sort };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (teacherId) params.teacher_id = Number(teacherId);
      if (subjectId) params.subject_id = Number(subjectId);
      if (groupId) params.group_id = Number(groupId);

      if (statusPack === 'stale_review') {
        params.filter = 'review_stale';
      } else if (statusPack === 'overdue') {
        params.status = 'overdue';
      } else if (statusPack !== 'all') {
        params.status = statusPack;
      }

      const { data } = await api.get('/admin/homework', { params });
      const list = Array.isArray(data?.data) ? data.data : [];
      setRows(
        list.map((r) => ({
          id: r.id,
          title: r.title,
          teacher: r.teacher,
          subject: r.subject,
          groups: r.groups ?? [],
          status: r.status,
          displayOverdue: r.displayOverdue,
          deadline: r.deadline,
          createdAt: r.createdAt,
          stats: r.stats ?? {},
        })),
      );
      const m = data?.meta;
      setMeta({
        currentPage: m?.currentPage ?? page,
        lastPage: m?.lastPage ?? 1,
        total: m?.total ?? 0,
      });
    } catch (e) {
      setRows([]);
      setError(firstApiErrorMessage(e, 'Не удалось загрузить задания'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, teacherId, subjectId, groupId, statusPack, sort]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, teacherId, subjectId, groupId, statusPack, sort]);

  useEffect(() => {
    if (openMenuId == null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.admin-assignment-card__menu-root')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenuId]);

  useEffect(() => {
    if (detailId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const { data } = await api.get(`/admin/assignments/${detailId}`);
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) {
          setDetail(null);
          showError('Не удалось загрузить задание');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId, showError]);

  useEffect(() => {
    if (!reassignRow?.id) {
      setEligibleTeachers([]);
      setReassignTeacherId('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/admin/assignments/${reassignRow.id}/eligible-teachers`);
        const list = Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) {
          setEligibleTeachers(list);
          setReassignTeacherId('');
        }
      } catch {
        if (!cancelled) {
          setEligibleTeachers([]);
          showError('Не удалось загрузить список преподавателей');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reassignRow, showError]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setTeacherId('');
    setSubjectId('');
    setGroupId('');
    setStatusPack('all');
    setSort('deadline_asc');
    setPage(1);
  }, []);

  const resetDisabled = useMemo(
    () =>
      !search.trim() && !teacherId && !subjectId && !groupId && statusPack === 'all' && sort === 'deadline_asc',
    [search, teacherId, subjectId, groupId, statusPack, sort],
  );

  const openEdit = (row) => {
    setDetailId(null);
    setEditRow(row);
    setEditTitle(row.title || '');
    setEditDescription('');
    setEditDeadline(row.deadline || '');
    setEditStatus(row.status || 'active');
    setOpenMenuId(null);
    (async () => {
      try {
        const { data } = await api.get(`/admin/assignments/${row.id}`);
        const a = data?.assignment;
        if (a) {
          setEditTitle(a.title || '');
          setEditDescription(a.description || '');
          setEditDeadline(a.deadline || '');
          setEditStatus(a.status || 'active');
        }
      } catch {
        /* use row only */
      }
    })();
  };

  const submitEdit = async () => {
    if (!editRow) return;
    const eid = editRow.id;
    setEditSubmitting(true);
    try {
      await api.put(`/admin/assignments/${eid}`, {
        title: editTitle.trim(),
        description: editDescription,
        deadline: editDeadline,
        status: editStatus,
      });
      showSuccess('Изменения сохранены');
      setEditRow(null);
      void fetchList();
      if (detailId === eid) {
        const { data } = await api.get(`/admin/assignments/${eid}`);
        setDetail(data);
      }
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitReassign = async () => {
    if (!reassignRow?.id || !reassignTeacherId) {
      showError('Выберите преподавателя');
      return;
    }
    const rid = reassignRow.id;
    setReassignSubmitting(true);
    try {
      await api.put(`/admin/assignments/${rid}/teacher`, {
        teacherId: Number(reassignTeacherId),
      });
      showSuccess('Преподаватель обновлён');
      setReassignRow(null);
      void fetchList();
      if (detailId === rid) {
        const { data } = await api.get(`/admin/assignments/${rid}`);
        setDetail(data);
      }
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось сменить преподавателя'));
    } finally {
      setReassignSubmitting(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    const did = deleteTarget.id;
    if (deleteConfirmTitle.trim() !== deleteTarget.title) {
      showError('Введите точное название задания');
      return;
    }
    setDeleteSubmitting(true);
    try {
      await api.delete(`/admin/assignments/${did}`);
      showSuccess('Задание удалено');
      setDeleteTarget(null);
      setDeleteConfirmTitle('');
      if (detailId === did) setDetailId(null);
      void fetchList();
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось удалить'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const a = detail?.assignment;
  const stats = detail?.stats ?? {};
  const totalStudents = stats.totalStudents ?? 0;
  const submitted = stats.submitted ?? 0;
  const pct = totalStudents > 0 ? Math.round((submitted / totalStudents) * 100) : 0;
  const dist = detail?.gradeDistribution ?? {};

  return (
    <div className="admin-assignment-management">
      <div className="admin-assignment-management__head">
        <div>
          <h1 className="admin-assignment-management__title">Задания</h1>
          <p className="admin-assignment-management__hint">
            Обзор выданных заданий (не путать с банком заготовок преподавателя: банк хранит шаблоны и не отображается
            здесь). Фильтр «На проверке &gt; 3 дн.» совпадает с виджетом «На контроле» на дашборде.
          </p>
        </div>
      </div>

      <DashboardFilterToolbar
        className="admin-assignment-management__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по названию задания…"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        popoverAlign="end"
        popoverAriaLabel="Фильтры заданий"
      >
        <div className="filter-popover__section">
          <label className="filter-popover__label" htmlFor="aam-sort">
            Сортировка
          </label>
          <select id="aam-sort" className="filter-popover__select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__section">
          <label className="filter-popover__label" htmlFor="aam-status">
            Статус / контроль
          </label>
          <select id="aam-status" className="filter-popover__select" value={statusPack} onChange={(e) => setStatusPack(e.target.value)}>
            {STATUS_PACK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__section">
          <label className="filter-popover__label" htmlFor="aam-teacher">
            Преподаватель
          </label>
          <select id="aam-teacher" className="filter-popover__select" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Все преподаватели</option>
            {teachers.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {teacherLabel(u)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__section">
          <label className="filter-popover__label" htmlFor="aam-subject">
            Предмет
          </label>
          <select id="aam-subject" className="filter-popover__select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Все предметы</option>
            {subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.code ? `${s.name} (${s.code})` : s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__section">
          <label className="filter-popover__label" htmlFor="aam-group">
            Группа
          </label>
          <select id="aam-group" className="filter-popover__select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Все группы</option>
            {groups.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </DashboardFilterToolbar>

      {error && (
        <div className="admin-assignment-management__banner admin-assignment-management__banner--error" role="alert">
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={() => void fetchList()}>
            Повторить
          </Button>
        </div>
      )}

      <div className={`admin-assignment-management__grid-wrap${loading ? ' admin-assignment-management__grid-wrap--loading' : ''}`}>
        {loading && <p className="admin-assignment-management__empty">Загрузка…</p>}
        {!loading && rows.length === 0 && !error && (
          <p className="admin-assignment-management__empty">Задания не найдены</p>
        )}
        {!loading && rows.length > 0 && (
          <div className="admin-assignment-management__grid">
            {rows.map((row) => {
              const b = statusBadge(row);
              const gNames = row.groups?.map((g) => g.name).join(', ') || '—';
              const st = row.stats || {};
              return (
                <Card key={row.id} className="admin-assignment-card" padding="medium" shadow="small" bordered>
                  <div className="admin-assignment-card__head">
                    <h3 className="admin-assignment-card__title">{row.title}</h3>
                    <div className="admin-assignment-card__menu-root">
                      <button
                        type="button"
                        className="admin-assignment-card__menu-btn"
                        aria-expanded={openMenuId === row.id}
                        aria-label="Меню"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((id) => (id === row.id ? null : row.id));
                        }}
                      >
                        ⋯
                      </button>
                      {openMenuId === row.id && (
                        <div className="admin-assignment-card__menu" role="menu">
                          <button
                            type="button"
                            className="admin-assignment-card__menu-item"
                            role="menuitem"
                            onClick={() => {
                              setDetailId(row.id);
                              setOpenMenuId(null);
                            }}
                          >
                            Просмотр
                          </button>
                          <button
                            type="button"
                            className="admin-assignment-card__menu-item"
                            role="menuitem"
                            onClick={() => openEdit(row)}
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            className="admin-assignment-card__menu-item"
                            role="menuitem"
                            onClick={() => {
                              setReassignRow(row);
                              setOpenMenuId(null);
                            }}
                          >
                            Сменить преподавателя
                          </button>
                          <button
                            type="button"
                            className="admin-assignment-card__menu-item admin-assignment-card__menu-item--danger"
                            role="menuitem"
                            onClick={() => {
                              setDeleteTarget(row);
                              setDeleteConfirmTitle('');
                              setOpenMenuId(null);
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="admin-assignment-card__meta">
                    <span>{row.teacher?.short_name ?? '—'}</span>
                    <span>
                      {row.subject ? `${row.subject.name}${row.subject.code ? ` (${row.subject.code})` : ''}` : '—'}
                    </span>
                    <span>{gNames}</span>
                  </div>
                  <div className="admin-assignment-card__badges">
                    <span className={`admin-assignment-card__badge admin-assignment-card__badge--${b.key}`}>{b.label}</span>
                  </div>
                  <div className="admin-assignment-card__stats">
                    <span>Дедлайн: {row.deadline || '—'}</span>
                    <span>
                      Сдано: {st.submitted ?? 0}/{st.totalStudents ?? 0} · Проверено: {st.graded ?? 0} · Ждут:{' '}
                      {st.pendingReview ?? 0}
                    </span>
                    {st.avgScore != null ? <span>Средний балл: {st.avgScore}</span> : null}
                  </div>
                  <button type="button" className="admin-assignment-card__open" onClick={() => setDetailId(row.id)}>
                    Открыть карточку
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Pagination
        className="admin-assignment-management__pagination"
        currentPage={meta.currentPage}
        lastPage={meta.lastPage}
        total={meta.total}
        fallbackCount={rows.length}
        disabled={loading}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />

      <Modal
        isOpen={detailId != null}
        onClose={() => !detailLoading && setDetailId(null)}
        title={a?.title || 'Задание'}
        size="large"
      >
        {detailLoading && <p>Загрузка…</p>}
        {!detailLoading && a && (
          <div className="admin-assignment-detail">
            <div className="admin-assignment-detail__section">
              <h4 className="admin-assignment-detail__section-title">Информация</h4>
              <dl className="admin-assignment-detail__dl">
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Предмет</dt>
                  <dd className="admin-assignment-detail__dd">
                    {a.subject ? `${a.subject.name}${a.subject.code ? ` (${a.subject.code})` : ''}` : '—'}
                  </dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Преподаватель</dt>
                  <dd className="admin-assignment-detail__dd">{a.teacher?.short_name ?? '—'}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Группы</dt>
                  <dd className="admin-assignment-detail__dd">{a.groups?.map((g) => g.name).join(', ') || '—'}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Статус</dt>
                  <dd className="admin-assignment-detail__dd">{a.status}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Дедлайн</dt>
                  <dd className="admin-assignment-detail__dd">{a.deadline || '—'}</dd>
                </div>
              </dl>
            </div>
            <div className="admin-assignment-detail__section">
              <h4 className="admin-assignment-detail__section-title">Сдачи</h4>
              <div className="admin-assignment-detail__bar">
                <div className="admin-assignment-detail__bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <dl className="admin-assignment-detail__dl">
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Всего</dt>
                  <dd className="admin-assignment-detail__dd">{totalStudents}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Сдано</dt>
                  <dd className="admin-assignment-detail__dd">{submitted}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Проверено</dt>
                  <dd className="admin-assignment-detail__dd">{stats.graded ?? 0}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Ждут проверки</dt>
                  <dd className="admin-assignment-detail__dd">{stats.pendingReview ?? 0}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Не сдали</dt>
                  <dd className="admin-assignment-detail__dd">{stats.notSubmitted ?? 0}</dd>
                </div>
              </dl>
              {['5', '4', '3', '2'].some((k) => (dist[k] ?? 0) > 0) && (
                <ul className="admin-assignment-detail__grades">
                  {[5, 4, 3, 2].map((n) => ((dist[String(n)] ?? 0) > 0 ? <li key={n}>{`Оценка ${n}: ${dist[String(n)]}`}</li> : null))}
                </ul>
              )}
              {Array.isArray(detail?.notSubmitted) && detail.notSubmitted.length > 0 && (
                <>
                  <h4 className="admin-assignment-detail__section-title" style={{ marginTop: '0.75rem' }}>
                    Не сдали
                  </h4>
                  <ul className="admin-assignment-detail__not-list">
                    {detail.notSubmitted.map((s) => (
                      <li key={s.id}>
                        {s.shortName}
                        {s.overdue ? ' · просрочено' : ''}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="admin-assignment-detail__actions">
              <Button type="button" variant="secondary" onClick={() => setDetailId(null)}>
                Закрыть
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  const fromList = rows.find((r) => r.id === detailId);
                  if (fromList) {
                    openEdit(fromList);
                  } else {
                    openEdit({
                      id: detailId,
                      title: a.title,
                      deadline: a.deadline,
                      status: a.status,
                      displayOverdue: false,
                      stats: {},
                      groups: a.groups,
                      subject: a.subject,
                      teacher: a.teacher,
                    });
                  }
                }}
              >
                Редактировать
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!editRow}
        onClose={() => !editSubmitting && setEditRow(null)}
        title="Редактирование задания"
        size="medium"
      >
        <div className="admin-assignment-form">
          <p className="admin-assignment-form__frozen">Предмет и группы изменить нельзя (как в ТЗ).</p>
          <label className="admin-assignment-form__label" htmlFor="aam-edit-title">
            Название
          </label>
          <input id="aam-edit-title" className="admin-assignment-form__input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <label className="admin-assignment-form__label" htmlFor="aam-edit-desc">
            Описание
          </label>
          <textarea id="aam-edit-desc" className="admin-assignment-form__textarea" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          <label className="admin-assignment-form__label" htmlFor="aam-edit-deadline">
            Дедлайн
          </label>
          <input
            id="aam-edit-deadline"
            type="date"
            className="admin-assignment-form__input"
            value={editDeadline}
            onChange={(e) => setEditDeadline(e.target.value)}
          />
          <label className="admin-assignment-form__label" htmlFor="aam-edit-status">
            Статус
          </label>
          <select id="aam-edit-status" className="admin-assignment-form__select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
            <option value="active">Активно</option>
            <option value="inactive">Приостановлено</option>
            <option value="archived">Закрыто</option>
          </select>
          <p className="admin-assignment-form__hint">Преподаватель получит уведомление об изменении, если оно предусмотрено системой.</p>
          <div className="admin-assignment-form__actions">
            <Button type="button" variant="secondary" onClick={() => setEditRow(null)} disabled={editSubmitting}>
              Отмена
            </Button>
            <Button type="button" variant="primary" loading={editSubmitting} onClick={() => void submitEdit()}>
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!reassignRow}
        onClose={() => !reassignSubmitting && setReassignRow(null)}
        title="Сменить преподавателя"
        size="medium"
      >
        <div className="admin-assignment-form">
          <p className="admin-assignment-form__frozen">
            Доступны только преподаватели с активным назначением на этот предмет по всем группам задания.
          </p>
          <label className="admin-assignment-form__label" htmlFor="aam-reassign-t">
            Новый преподаватель
          </label>
          <select id="aam-reassign-t" className="admin-assignment-form__select" value={reassignTeacherId} onChange={(e) => setReassignTeacherId(e.target.value)}>
            <option value="">Выберите</option>
            {eligibleTeachers.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.shortName}
              </option>
            ))}
          </select>
          <div className="admin-assignment-form__actions">
            <Button type="button" variant="secondary" onClick={() => setReassignRow(null)} disabled={reassignSubmitting}>
              Отмена
            </Button>
            <Button type="button" variant="primary" loading={reassignSubmitting} onClick={() => void submitReassign()}>
              Сменить
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleteSubmitting && setDeleteTarget(null)}
        title="Удалить задание"
        size="medium"
      >
        <div className="admin-assignment-form">
          <p className="admin-assignment-form__hint">
            Будут удалены задание и все сданные работы. Введите название задания для подтверждения.
          </p>
          <label className="admin-assignment-form__label" htmlFor="aam-del-title">
             Название
          </label>
          <input
            id="aam-del-title"
            className="admin-assignment-form__input"
            value={deleteConfirmTitle}
            onChange={(e) => setDeleteConfirmTitle(e.target.value)}
            autoComplete="off"
          />
          <div className="admin-assignment-form__actions">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteSubmitting}>
              Отмена
            </Button>
            <Button type="button" variant="danger" loading={deleteSubmitting} onClick={() => void submitDelete()}>
              Удалить
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminAssignmentManagement;
