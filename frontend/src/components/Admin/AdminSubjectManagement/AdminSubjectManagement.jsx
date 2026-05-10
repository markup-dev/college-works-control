import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import Card from '../../UI/Card/Card';
import Modal from '../../UI/Modal/Modal';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import './AdminSubjectManagement.scss';

const PER_PAGE = 18;

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
  const [openMenuId, setOpenMenuId] = useState(null);

  const [subjects, setSubjects] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
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

  const [changeLoad, setChangeLoad] = useState(null);
  const [changeLoadGroupId, setChangeLoadGroupId] = useState('');
  const [changeLoadSubmitting, setChangeLoadSubmitting] = useState(false);

  const [removeLoadConfirm, setRemoveLoadConfirm] = useState(null);

  const [changeLoadGroups, setChangeLoadGroups] = useState([]);

  useEffect(() => {
    if (!changeLoad) {
      setChangeLoadGroups([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/groups', { params: { status: 'active', per_page: 100, sort: 'name_asc' } });
        if (!cancelled) setChangeLoadGroups(Array.isArray(data?.data) ? data.data : []);
      } catch (e) {
        if (!cancelled) {
          setChangeLoadGroups([]);
          showError(firstApiErrorMessage(e, 'Не удалось загрузить группы'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [changeLoad, showError]);

  const openCreateFromRoute = Boolean(location.state?.openCreateSubject);

  useEffect(() => {
    if (!openCreateFromRoute) return;
    setCreateOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [openCreateFromRoute, location.pathname, navigate]);

  const viewSubjectIdFromRoute = location.state?.viewSubjectId;

  useEffect(() => {
    if (viewSubjectIdFromRoute == null || viewSubjectIdFromRoute === '') return;
    setViewId(Number(viewSubjectIdFromRoute));
    navigate(location.pathname, { replace: true, state: {} });
  }, [viewSubjectIdFromRoute, location.pathname, navigate]);

  useEffect(() => {
    if (openMenuId == null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.admin-subject-card__menu-root')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenuId]);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: PER_PAGE,
        sort: sort || 'name_asc',
      };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (status) params.status = status;
      const { data } = await api.get('/admin/subjects', { params });
      setSubjects(Array.isArray(data?.data) ? data.data : []);
      const m = data?.meta;
      setMeta({
        currentPage: m?.currentPage ?? page,
        lastPage: m?.lastPage ?? 1,
        total: m?.total ?? 0,
      });
    } catch (e) {
      setSubjects([]);
      setError(e.response?.data?.message || 'Не удалось загрузить предметы');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, sort]);

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
      } catch {
        if (!cancelled) {
          setViewData(null);
          showError('Не удалось загрузить предмет');
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
    if (!addLoadOpen || !viewId) return;
    let cancelled = false;
    (async () => {
      try {
        const [u, g] = await Promise.all([
          api.get('/admin/users', { params: { role: 'teacher', per_page: 100, sort: 'name_asc' } }),
          api.get('/admin/groups', { params: { status: 'active', per_page: 100, sort: 'name_asc' } }),
        ]);
        if (!cancelled) {
          setAddLoadTeachers(Array.isArray(u.data?.data) ? u.data.data : []);
          setAddLoadGroups(Array.isArray(g.data?.data) ? g.data.data : []);
        }
      } catch (e) {
        if (!cancelled) {
          setAddLoadTeachers([]);
          setAddLoadGroups([]);
          showError(firstApiErrorMessage(e, 'Не удалось загрузить преподавателей или группы'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addLoadOpen, viewId, showError]);

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
      showSuccess('Предмет создан');
      setCreateOpen(false);
      void fetchSubjects();
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось создать предмет'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditName(row.name || '');
    setEditCode(row.code || '');
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setEditSubmitting(true);
    try {
      await api.put(`/admin/subjects/${editRow.id}`, {
        name: editName.trim(),
        code: editCode.trim(),
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
      showError(firstApiErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setEditSubmitting(false);
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
      showError('Введите точный код предмета');
      return;
    }
    setDeleteSubmitting(true);
    try {
      await api.delete(`/admin/subjects/${deleteTarget.id}`);
      showSuccess('Предмет удалён');
      setDeleteTarget(null);
      setDeletePreview(null);
      setDeleteConfirmCode('');
      if (viewId === deleteTarget.id) setViewId(null);
      void fetchSubjects();
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось удалить'));
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
      showError(firstApiErrorMessage(e, 'Не удалось добавить назначение'));
    } finally {
      setAddLoadSubmitting(false);
    }
  };

  const submitChangeLoadGroup = async () => {
    if (!changeLoad?.teachingLoadId || !changeLoadGroupId) return;
    setChangeLoadSubmitting(true);
    try {
      await api.put(`/admin/teaching-loads/${changeLoad.teachingLoadId}`, {
        groupId: Number(changeLoadGroupId),
      });
      showSuccess('Группа обновлена');
      setChangeLoad(null);
      setChangeLoadGroupId('');
      if (viewData?.subject?.id) {
        try {
          const { data } = await api.get(`/admin/subjects/${viewData.subject.id}`);
          setViewData(data);
        } catch {
          /* ignore */
        }
      }
      void fetchSubjects();
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setChangeLoadSubmitting(false);
    }
  };

  const confirmRemoveLoad = async () => {
    if (!removeLoadConfirm?.id) return;
    try {
      await api.delete(`/admin/teaching-loads/${removeLoadConfirm.id}`);
      showSuccess('Назначение снято');
      setRemoveLoadConfirm(null);
      if (viewData?.subject?.id) {
        try {
          const { data } = await api.get(`/admin/subjects/${viewData.subject.id}`);
          setViewData(data);
        } catch {
          /* ignore */
        }
      }
      void fetchSubjects();
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось удалить назначение'));
      throw e;
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="admin-subject-management">
      <div className="admin-subject-management__head">
        <h1 className="admin-subject-management__title">Предметы</h1>
      </div>

      <DashboardFilterToolbar
        className="admin-subject-management__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по названию или коду предмета…"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        popoverAlign="end"
        popoverAriaLabel="Фильтры списка предметов"
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

      <div>
        <Button type="button" variant="primary" onClick={openCreate}>
          Новый предмет
        </Button>
      </div>

      {error && (
        <div className="admin-subject-management__banner admin-subject-management__banner--error" role="alert">
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={() => void fetchSubjects()} className="admin-subject-management__retry">
            Повторить
          </Button>
        </div>
      )}

      <div className={`admin-subject-management__grid-wrap${loading ? ' admin-subject-management__grid-wrap--loading' : ''}`}>
        {loading && <p className="admin-subject-management__hint">Загрузка…</p>}
        {!loading && subjects.length === 0 && !error && (
          <p className="admin-subject-management__hint">Предметы не найдены</p>
        )}
        {!loading && subjects.length > 0 && (
          <div className="admin-subject-management__card-grid">
            {subjects.map((row) => {
              const t = row.teachersCount ?? 0;
              const g = row.groupsCount ?? 0;
              const a = row.assignmentsCount ?? 0;
              return (
                <Card key={row.id} className="admin-subject-card" padding="medium" shadow="small" bordered>
                  <div className="admin-subject-card__title">{row.name}</div>
                  <div className="admin-subject-card__code">Код: {row.code}</div>
                  <div className="admin-subject-card__meta">
                    <span>Преподавателей: {t}</span>
                    <span>Групп: {g}</span>
                    <span>Заданий: {a}</span>
                  </div>
                  <div className="admin-subject-card__menu-root">
                    <button
                      type="button"
                      className="admin-subject-card__menu-btn"
                      aria-label="Действия"
                      onClick={() => setOpenMenuId((id) => (id === row.id ? null : row.id))}
                    >
                      …
                    </button>
                    {openMenuId === row.id && (
                      <ul className="admin-subject-card__menu" role="menu">
                        <li>
                          <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); setViewId(row.id); }}>
                            Просмотр предмета
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              openEdit(row);
                            }}
                          >
                            Редактировать
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenMenuId(null);
                              void openDelete(row);
                            }}
                          >
                            Удалить
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                </Card>
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
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />

      <Modal isOpen={createOpen} onClose={() => !createSubmitting && setCreateOpen(false)} title="Новый предмет" size="medium">
        <div className="admin-subject-form">
          <label className="admin-subject-form__label">
            Название
            <input
              className="admin-subject-form__input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="admin-subject-form__label">
            Код
            <input
              className="admin-subject-form__input"
              value={createCode}
              onChange={(e) => setCreateCode(e.target.value)}
              placeholder="БД-301"
              autoComplete="off"
            />
          </label>
          <p className="admin-subject-form__hint">
            Код должен быть уникальным и используется в отчётах.
          </p>
          <div className="admin-subject-form__actions">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={createSubmitting}
              disabled={createSubmitting || createName.trim().length < 2 || !createCode.trim()}
              onClick={() => void submitCreate()}
            >
              Создать
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!editRow} onClose={() => !editSubmitting && setEditRow(null)} title="Редактировать предмет" size="medium">
        <div className="admin-subject-form">
          <label className="admin-subject-form__label">
            Название
            <input
              className="admin-subject-form__input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="admin-subject-form__label">
            Код
            <input
              className="admin-subject-form__input"
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              autoComplete="off"
            />
          </label>
          <p className="admin-subject-form__hint">
            При изменении кода задания сохраняют привязку к этой же записи предмета.
          </p>
          <div className="admin-subject-form__actions">
            <Button type="button" variant="secondary" onClick={() => setEditRow(null)} disabled={editSubmitting}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={editSubmitting}
              disabled={editSubmitting || editName.trim().length < 2 || !editCode.trim()}
              onClick={() => void submitEdit()}
            >
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={viewId != null}
        onClose={() => setViewId(null)}
        title={viewData?.subject ? viewData.subject.name : 'Предмет'}
        size="large"
      >
        {viewLoading && <p className="admin-subject-management__hint">Загрузка…</p>}
        {!viewLoading && viewData?.subject && (
          <div className="admin-subject-view">
            <section>
              <h3 className="admin-subject-view__section-title">Информация</h3>
              <dl className="admin-subject-view__dl">
                <div>
                  <dt>Название</dt>
                  <dd>{viewData.subject.name}</dd>
                </div>
                <div>
                  <dt>Код</dt>
                  <dd>{viewData.subject.code}</dd>
                </div>
                <div>
                  <dt>Создан</dt>
                  <dd>{formatDate(viewData.subject.createdAt)}</dd>
                </div>
              </dl>
            </section>
            {viewData.stats && (
              <section>
                <h3 className="admin-subject-view__section-title">Показатели</h3>
                <dl className="admin-subject-view__dl">
                  <div>
                    <dt>Преподавателей</dt>
                    <dd>{viewData.stats.teachersCount}</dd>
                  </div>
                  <div>
                    <dt>Групп по назначениям</dt>
                    <dd>{viewData.stats.groupsCount}</dd>
                  </div>
                  <div>
                    <dt>Заданий</dt>
                    <dd>{viewData.stats.assignmentsCount}</dd>
                  </div>
                  <div>
                    <dt>Активных заданий</dt>
                    <dd>{viewData.stats.activeAssignmentsCount}</dd>
                  </div>
                  <div>
                    <dt>Сданных работ</dt>
                    <dd>{viewData.stats.submissionsCount}</dd>
                  </div>
                </dl>
              </section>
            )}
            <section>
              <h3 className="admin-subject-view__section-title">Назначения</h3>
              {!viewData.teachingLoads?.length && <p className="admin-subject-management__hint">Назначений пока нет</p>}
              {viewData.teachingLoads?.length > 0 && (
                <ul className="admin-subject-view__loads">
                  {viewData.teachingLoads.map((row) => (
                    <li key={row.teachingLoadId} className="admin-subject-view__load-row">
                      <div className="admin-subject-view__load-meta">
                        <strong>
                          {row.teacher
                            ? shortName(row.teacher.lastName, row.teacher.firstName, row.teacher.middleName)
                            : '—'}
                        </strong>
                        <br />
                        {row.group ? `Группа: ${row.group.name}` : 'Группа не указана'}
                        <br />
                        Активных заданий: {row.activeAssignmentsCount ?? 0}
                      </div>
                      <div className="admin-subject-view__load-actions">
                        <Button
                          type="button"
                          size="small"
                          variant="outline"
                          onClick={() => {
                            setChangeLoad({ teachingLoadId: row.teachingLoadId, groupId: row.group?.id });
                            setChangeLoadGroupId(row.group?.id ? String(row.group.id) : '');
                          }}
                        >
                          Изменить группу
                        </Button>
                        <Button
                          type="button"
                          size="small"
                          variant="danger"
                          onClick={() => setRemoveLoadConfirm({ id: row.teachingLoadId })}
                        >
                          Убрать
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ marginTop: '0.75rem' }}>
                <Button type="button" variant="secondary" onClick={openAddLoad}>
                  Добавить назначение
                </Button>
              </div>
            </section>
            <div className="admin-subject-view__footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const s = viewData.subject;
                  setViewId(null);
                  openEdit({ id: s.id, name: s.name, code: s.code });
                }}
              >
                Редактировать предмет
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  const s = viewData.subject;
                  setViewId(null);
                  void openDelete({ id: s.id, name: s.name, code: s.code });
                }}
              >
                Удалить предмет
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={addLoadOpen}
        onClose={() => !addLoadSubmitting && setAddLoadOpen(false)}
        title="Новое назначение"
        size="medium"
      >
        <div className="admin-subject-form admin-subject-add-load">
          <label className="admin-subject-form__label">
            Преподаватель
            <select
              className="admin-subject-form__input"
              value={addLoadTeacherId}
              onChange={(e) => setAddLoadTeacherId(e.target.value)}
            >
              <option value="">Выберите</option>
              {addLoadTeachers.map((u) => (
                <option key={u.id} value={u.id}>
                  {shortName(u.lastName, u.firstName, u.middleName)}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-subject-form__label">Группы</div>
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
          <div className="admin-subject-form__actions">
            <Button type="button" variant="secondary" onClick={() => setAddLoadOpen(false)} disabled={addLoadSubmitting}>
              Отмена
            </Button>
            <Button type="button" variant="primary" loading={addLoadSubmitting} onClick={() => void submitAddLoad()}>
              Создать
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!changeLoad}
        onClose={() => !changeLoadSubmitting && setChangeLoad(null)}
        title="Изменить группу в назначении"
        size="small"
      >
        <div className="admin-subject-form">
          <label className="admin-subject-form__label">
            Группа
            <select
              className="admin-subject-form__input"
              value={changeLoadGroupId}
              onChange={(e) => setChangeLoadGroupId(e.target.value)}
            >
              <option value="">Выберите</option>
              {changeLoadGroups.map((gr) => (
                <option key={gr.id} value={String(gr.id)}>
                  {gr.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-subject-form__actions">
            <Button type="button" variant="secondary" onClick={() => setChangeLoad(null)} disabled={changeLoadSubmitting}>
              Отмена
            </Button>
            <Button type="button" variant="primary" loading={changeLoadSubmitting} onClick={() => void submitChangeLoadGroup()}>
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleteSubmitting && setDeleteTarget(null)}
        title={deleteTarget ? `Удалить предмет ${deleteTarget.name}` : 'Удаление'}
        size="medium"
      >
        <div className="admin-subject-form">
          {deletePreview?.stats && (
            <p className="admin-subject-form__warn">
              Связано: преподавателей {deletePreview.stats.teachersCount}, групп {deletePreview.stats.groupsCount},
              заданий {deletePreview.stats.assignmentsCount}, сданных работ {deletePreview.stats.submissionsCount}.
              Назначения будут удалены; задания останутся без привязки к предмету.
            </p>
          )}
          <label className="admin-subject-form__label">
            Введите код предмета для подтверждения
            <input
              className="admin-subject-form__input"
              value={deleteConfirmCode}
              onChange={(e) => setDeleteConfirmCode(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="admin-subject-form__actions">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteSubmitting}>
              Отмена
            </Button>
            <Button type="button" variant="danger" loading={deleteSubmitting} onClick={() => void submitDelete()}>
              Удалить
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!removeLoadConfirm}
        onClose={() => setRemoveLoadConfirm(null)}
        title="Снять назначение"
        message="Преподаватель потеряет доступ к этому предмету в выбранной группе. Задания сохранятся."
        confirmText="Убрать"
        cancelText="Отмена"
        danger
        onConfirm={async () => {
          await confirmRemoveLoad();
        }}
      />
    </div>
  );
};

export default AdminSubjectManagement;
