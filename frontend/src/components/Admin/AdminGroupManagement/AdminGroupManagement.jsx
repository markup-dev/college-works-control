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
import './AdminGroupManagement.scss';

const PER_PAGE = 18;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'active', label: 'Активна' },
  { value: 'inactive', label: 'Закрыта' },
];

const formatIsoDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const initialsIO = (firstName, middleName) => {
  const a = firstName?.trim()?.[0];
  const b = middleName?.trim()?.[0];
  const parts = [];
  if (a) parts.push(`${a}.`);
  if (b) parts.push(`${b}.`);
  return parts.join('');
};

const shortName = (lastName, firstName, middleName) => {
  const io = initialsIO(firstName, middleName);
  return [lastName, io].filter(Boolean).join(' ').trim() || '—';
};

const AdminGroupManagement = () => {
  const { showSuccess, showError } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [groups, setGroups] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [specialtyOptions, setSpecialtyOptions] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSpecialty, setCreateSpecialty] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [viewId, setViewId] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [closeTarget, setCloseTarget] = useState(null);
  const [closeConfirmName, setCloseConfirmName] = useState('');
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  const [reopenTarget, setReopenTarget] = useState(null);

  const openCreateFromRoute = Boolean(location.state?.openCreateGroup);

  useEffect(() => {
    if (!openCreateFromRoute) return;
    setCreateOpen(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [openCreateFromRoute, location.pathname, navigate]);

  const refreshSpecialtyOptions = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/groups', {
        params: { per_page: 500, sort: 'name_asc' },
      });
      const set = new Set();
      (Array.isArray(data?.data) ? data.data : []).forEach((g) => {
        if (g.specialty) set.add(g.specialty);
      });
      setSpecialtyOptions(Array.from(set).sort((a, b) => a.localeCompare(b, 'ru')));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshSpecialtyOptions();
  }, [refreshSpecialtyOptions]);

  useEffect(() => {
    if (openMenuId == null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.admin-group-card__menu-root')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenuId]);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: PER_PAGE,
        sort: 'name_asc',
      };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (status) params.status = status;
      if (specialty) params.specialty = specialty;

      const { data } = await api.get('/admin/groups', { params });
      setGroups(Array.isArray(data?.data) ? data.data : []);
      const m = data?.meta;
      setMeta({
        currentPage: m?.currentPage ?? page,
        lastPage: m?.lastPage ?? 1,
        total: m?.total ?? 0,
      });
    } catch (e) {
      setGroups([]);
      setMeta({ currentPage: 1, lastPage: 1, total: 0 });
      setError(e.response?.data?.message || 'Не удалось загрузить группы');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, specialty]);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, specialty]);

  useEffect(() => {
    if (viewId == null) {
      setViewData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setViewLoading(true);
      try {
        const { data } = await api.get(`/admin/groups/${viewId}`);
        if (!cancelled) setViewData(data);
      } catch {
        if (!cancelled) {
          setViewData(null);
          showError('Не удалось загрузить данные группы');
        }
      } finally {
        if (!cancelled) setViewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewId, showError]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatus('');
    setSpecialty('');
    setPage(1);
  }, []);

  const resetDisabled = useMemo(
    () => !search.trim() && !status && !specialty,
    [search, status, specialty],
  );

  const specialtyFilterSelect = useMemo(
    () => [
      { value: '', label: 'Все специальности' },
      ...specialtyOptions.map((s) => ({ value: s, label: s })),
    ],
    [specialtyOptions],
  );

  const openCreate = () => {
    setCreateName('');
    setCreateSpecialty('');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    setCreateSubmitting(true);
    try {
      await api.post('/admin/groups', {
        name: createName.trim(),
        specialty: createSpecialty.trim(),
        status: 'active',
      });
      showSuccess('Группа создана');
      setCreateOpen(false);
      void refreshSpecialtyOptions();
      void fetchGroups();
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось создать группу'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditName(row.name || '');
    setEditSpecialty(row.specialty || '');
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setEditSubmitting(true);
    try {
      await api.put(`/admin/groups/${editRow.id}`, {
        name: editName.trim(),
        specialty: editSpecialty.trim(),
      });
      showSuccess('Изменения сохранены');
      setEditRow(null);
      void refreshSpecialtyOptions();
      void fetchGroups();
      if (viewId === editRow.id) setViewId(null);
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitClose = async () => {
    if (!closeTarget || closeConfirmName.trim() !== closeTarget.name) {
      showError('Введите точное название группы для подтверждения');
      return;
    }
    const gid = closeTarget.id;
    setCloseSubmitting(true);
    try {
      await api.put(`/admin/groups/${gid}`, { status: 'inactive' });
      showSuccess('Группа закрыта');
      setCloseTarget(null);
      setCloseConfirmName('');
      void fetchGroups();
      if (viewId === gid) setViewId(null);
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось закрыть группу'));
    } finally {
      setCloseSubmitting(false);
    }
  };

  const submitReopen = async () => {
    if (!reopenTarget) return;
    try {
      await api.put(`/admin/groups/${reopenTarget.id}`, { status: 'active' });
      showSuccess('Группа снова активна');
      setReopenTarget(null);
      void fetchGroups();
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось открыть группу'));
      throw e;
    }
  };

  return (
    <div className="admin-group-management">
      <div className="admin-group-management__head">
        <h1 className="admin-group-management__title">Группы</h1>
      </div>

      <DashboardFilterToolbar
        className="admin-group-management__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по названию группы…"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        popoverAlign="end"
        popoverAriaLabel="Фильтры групп"
      >
        <div className="filter-popover__section">
          <label className="filter-popover__label" htmlFor="admin-group-specialty-filter">
            Специальность
          </label>
          <select
            id="admin-group-specialty-filter"
            className="filter-popover__select"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            {specialtyFilterSelect.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__section">
          <label className="filter-popover__label" htmlFor="admin-group-status-filter">
            Статус
          </label>
          <select
            id="admin-group-status-filter"
            className="filter-popover__select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </DashboardFilterToolbar>

      <div className="admin-group-management__actions-row">
        <Button type="button" variant="primary" onClick={openCreate}>
          Новая группа
        </Button>
      </div>

      {error && (
        <div className="admin-group-management__banner admin-group-management__banner--error" role="alert">
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={() => void fetchGroups()} className="admin-group-management__retry">
            Повторить
          </Button>
        </div>
      )}

      <div className={`admin-group-management__grid-wrap${loading ? ' admin-group-management__grid-wrap--loading' : ''}`}>
        {loading && <p className="admin-group-management__hint">Загрузка…</p>}
        {!loading && groups.length === 0 && !error && (
          <p className="admin-group-management__hint">Группы не найдены</p>
        )}
        {!loading && groups.length > 0 && (
          <div className="admin-group-management__card-grid">
            {groups.map((row) => {
              const stud = row.studentsCount ?? 0;
              const teach = row.teachersCount ?? 0;
              const isActive = row.status === 'active';
              return (
                <Card
                  key={row.id}
                  className="admin-group-card"
                  padding="medium"
                  shadow="small"
                  bordered
                >
                  <div className="admin-group-card__title">{row.name}</div>
                  <div className="admin-group-card__specialty">{row.specialty || 'Специальность не указана'}</div>
                  <div className="admin-group-card__meta">
                    <span>
                      Студентов: {stud}
                    </span>
                    <span>
                      Преподавателей: {teach}
                    </span>
                  </div>
                  <div className={`admin-group-card__status admin-group-card__status--${isActive ? 'active' : 'inactive'}`}>
                    {isActive ? 'Активна' : 'Закрыта'}
                  </div>

                  <div className="admin-group-card__menu-root">
                    <button
                      type="button"
                      className="admin-group-card__menu-btn"
                      aria-label="Действия"
                      onClick={() => setOpenMenuId((id) => (id === row.id ? null : row.id))}
                    >
                      …
                    </button>
                    {openMenuId === row.id && (
                      <ul className="admin-group-card__menu" role="menu">
                        <li>
                          <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); setViewId(row.id); }}>
                            Просмотр группы
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
                        {isActive ? (
                          <li>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setCloseTarget(row);
                                setCloseConfirmName('');
                              }}
                            >
                              Закрыть группу
                            </button>
                          </li>
                        ) : (
                          <li>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setReopenTarget(row);
                              }}
                            >
                              Открыть группу
                            </button>
                          </li>
                        )}
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
        className="admin-group-management__pagination"
        currentPage={meta.currentPage}
        lastPage={meta.lastPage}
        total={meta.total}
        fallbackCount={groups.length}
        disabled={loading}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />

      <Modal isOpen={createOpen} onClose={() => !createSubmitting && setCreateOpen(false)} title="Новая группа" size="medium">
        <div className="admin-group-form">
          <label className="admin-group-form__label">
            Название
            <input
              className="admin-group-form__input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Например: ИС-31"
              autoComplete="off"
            />
          </label>
          <label className="admin-group-form__label">
            Специальность
            <input
              className="admin-group-form__input"
              list="admin-group-specialty-datalist"
              value={createSpecialty}
              onChange={(e) => setCreateSpecialty(e.target.value)}
              placeholder="Выберите или введите новую"
              autoComplete="off"
            />
          </label>
          <datalist id="admin-group-specialty-datalist">
            {specialtyOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <p className="admin-group-form__hint">
            По умолчанию группа создаётся со статусом «Активна». Назначения преподавателей задаются в разделе «Назначения».
          </p>
          <div className="admin-group-form__actions">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={createSubmitting}
              disabled={createSubmitting || !createName.trim() || !createSpecialty.trim()}
              onClick={() => void submitCreate()}
            >
              Создать
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!editRow} onClose={() => !editSubmitting && setEditRow(null)} title="Редактировать группу" size="medium">
        <div className="admin-group-form">
          <label className="admin-group-form__label">
            Название
            <input
              className="admin-group-form__input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="admin-group-form__label">
            Специальность
            <input
              className="admin-group-form__input"
              list="admin-group-specialty-datalist-edit"
              value={editSpecialty}
              onChange={(e) => setEditSpecialty(e.target.value)}
              autoComplete="off"
            />
          </label>
          <datalist id="admin-group-specialty-datalist-edit">
            {specialtyOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {editRow && (
            <p className="admin-group-form__hint">
              Статус:{' '}
              {editRow.status === 'active' ? 'активна' : 'закрыта'}
              {editRow.status === 'inactive' &&
                ' — чтобы снова открыть группу, используйте действие «Открыть группу» в меню карточки.'}
            </p>
          )}
          <div className="admin-group-form__actions">
            <Button type="button" variant="secondary" onClick={() => setEditRow(null)} disabled={editSubmitting}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={editSubmitting}
              disabled={editSubmitting || !editName.trim() || !editSpecialty.trim()}
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
        title={viewData?.group ? `Группа ${viewData.group.name}` : 'Группа'}
        size="large"
        className="admin-group-view-modal-wrap"
      >
        {viewLoading && <p className="admin-group-management__hint">Загрузка…</p>}
        {!viewLoading && viewData?.group && (
          <div className="admin-group-view">
            <section className="admin-group-view__section">
              <h3 className="admin-group-view__h">Информация</h3>
              <dl className="admin-group-view__dl">
                <div><dt>Название</dt><dd>{viewData.group.name}</dd></div>
                <div><dt>Специальность</dt><dd>{viewData.group.specialty || '—'}</dd></div>
                <div><dt>Статус</dt><dd>{viewData.group.status === 'active' ? 'Активна' : 'Закрыта'}</dd></div>
                <div><dt>Создана</dt><dd>{formatIsoDate(viewData.group.createdAt)}</dd></div>
              </dl>
            </section>

            <section className="admin-group-view__section">
              <h3 className="admin-group-view__h">
                Студенты ({viewData.group.studentsCount ?? 0})
              </h3>
              {(!viewData.students || viewData.students.length === 0) && (
                <p className="admin-group-view__empty">Студентов пока нет</p>
              )}
              {viewData.students?.length > 0 && (
                <>
                  <div className="admin-group-view__student-grid">
                    {viewData.students.slice(0, 12).map((s) => (
                      <div key={s.id} className="admin-group-view__student-card">
                        <div className="admin-group-view__student-name">{shortName(s.lastName, s.firstName, s.middleName)}</div>
                        <div className="admin-group-view__student-avg">
                          {s.avgScore != null ? `ср. ${s.avgScore}` : 'нет оценок'}
                        </div>
                        {(s.overdueAssignments ?? 0) > 0 && (
                          <div className="admin-group-view__warn">просрочено заданий: {s.overdueAssignments}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {(viewData.group.studentsCount ?? 0) > 12 && (
                    <div className="admin-group-view__more">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          const id = viewData.group.id;
                          setViewId(null);
                          navigate('/admin/users', { state: { filterGroupId: id } });
                        }}
                      >
                        Все студенты ({viewData.group.studentsCount})
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="admin-group-view__section">
              <h3 className="admin-group-view__h">Преподаватели и предметы</h3>
              {(!viewData.subjectBlocks || viewData.subjectBlocks.length === 0) && (
                <p className="admin-group-view__empty">Нет активных назначений</p>
              )}
              {viewData.subjectBlocks?.length > 0 && (
                <ul className="admin-group-view__subjects">
                  {viewData.subjectBlocks.map((block, idx) => (
                    <li key={`${block.subject?.id}-${block.teacher?.id}-${idx}`} className="admin-group-view__subject-row">
                      <div className="admin-group-view__subject-name">{block.subject?.name || '—'}</div>
                      <div className="admin-group-view__subject-teacher">
                        {block.teacher
                          ? shortName(block.teacher.lastName, block.teacher.firstName, block.teacher.middleName)
                          : '—'}
                      </div>
                      <div className="admin-group-view__subject-count">
                        Активных заданий: {block.activeAssignmentsCount ?? 0}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="admin-group-view__footer-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const g = viewData.group;
                  setViewId(null);
                  const row = groups.find((x) => x.id === g.id);
                  openEdit(row || { id: g.id, name: g.name, specialty: g.specialty, status: g.status });
                }}
              >
                Редактировать
              </Button>
              {viewData.group.status === 'active' ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    const g = viewData.group;
                    setViewId(null);
                    setCloseTarget({ id: g.id, name: g.name });
                    setCloseConfirmName('');
                  }}
                >
                  Закрыть группу
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    const g = viewData.group;
                    setViewId(null);
                    setReopenTarget({ id: g.id, name: g.name });
                  }}
                >
                  Открыть группу
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!closeTarget}
        onClose={() => !closeSubmitting && setCloseTarget(null)}
        title={closeTarget ? `Закрыть группу ${closeTarget.name}` : 'Закрыть группу'}
        size="medium"
      >
        <div className="admin-group-form">
          <p className="admin-group-form__warn">
            После закрытия группа станет неактивной, назначения преподавателей будут деактивированы, студенты потеряют доступ к активным заданиям этой группы. Данные сохраняются.
          </p>
          <label className="admin-group-form__label">
            Введите название группы для подтверждения
            <input
              className="admin-group-form__input"
              value={closeConfirmName}
              onChange={(e) => setCloseConfirmName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="admin-group-form__actions">
            <Button type="button" variant="secondary" onClick={() => setCloseTarget(null)} disabled={closeSubmitting}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={closeSubmitting}
              onClick={() => void submitClose()}
            >
              Закрыть группу
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!reopenTarget}
        onClose={() => setReopenTarget(null)}
        title={reopenTarget ? `Открыть группу ${reopenTarget.name}` : 'Открыть группу'}
        message="Группа снова станет активной. Назначения преподавателей потребуется восстановить вручную в разделе «Назначения»."
        confirmText="Открыть"
        cancelText="Отмена"
        onConfirm={async () => {
          await submitReopen();
        }}
      />
    </div>
  );
};

export default AdminGroupManagement;
