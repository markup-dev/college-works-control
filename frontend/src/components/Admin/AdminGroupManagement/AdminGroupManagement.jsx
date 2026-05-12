import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import { formatDateLong } from '../../../utils/dateHelpers';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import EmptyState from '../../UI/EmptyState/EmptyState';
import EntityCard from '../../UI/EntityCard/EntityCard';
import ErrorBanner from '../../UI/ErrorBanner/ErrorBanner';
import LoadingState from '../../UI/LoadingState/LoadingState';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import './AdminGroupManagement.scss';

const PER_PAGE = 18;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'active', label: 'Активна' },
  { value: 'inactive', label: 'Закрыта' },
];

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
      showError(firstApiErrorMessage(e?.response?.data) || 'Не удалось создать группу');
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
      showError(firstApiErrorMessage(e?.response?.data) || 'Не удалось сохранить');
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
      showError(firstApiErrorMessage(e?.response?.data) || 'Не удалось закрыть группу');
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
      showError(firstApiErrorMessage(e?.response?.data) || 'Не удалось открыть группу');
      throw e;
    }
  };

  return (
    <div className="admin-group-management">
      <div className="admin-group-management__header">
        <h1 className="admin-group-management__title">Управление группами</h1>
      </div>
      <DashboardFilterToolbar
        className="admin-group-management__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по названию группы..."
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        popoverAlign="end"
        popoverAriaLabel="Фильтры групп"
      >
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-group-specialty-filter">
            Специальность
          </label>
          <select
            id="admin-group-specialty-filter"
            className="filter-select"
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
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-group-status-filter">
            Статус
          </label>
          <select
            id="admin-group-status-filter"
            className="filter-select"
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
      <div className="admin-group-management__actions">
        <Button type="button" variant="primary" onClick={openCreate}>
          + Новая группа
        </Button>
      </div>
      {error && (
        <ErrorBanner
          className="admin-group-management__error"
          title="Ошибка загрузки групп"
          message={error}
          actionLabel="Повторить"
          onAction={() => void fetchGroups()}
        />
      )}
      <div className={`groups-grid-wrapper ${loading ? 'groups-grid-wrapper--loading' : ''}`}>
        {loading && groups.length === 0 ? (
          <LoadingState message="Загрузка групп..." className="admin-group-management__state" />
        ) : groups.length === 0 ? (
          <EmptyState
            title="Группы не найдены"
            message="Попробуйте изменить параметры поиска или фильтрации"
            className="admin-group-management__state"
          />
        ) : (
          <div className="groups-grid">
            {groups.map((row) => {
              const stud = row.studentsCount ?? 0;
              const teach = row.teachersCount ?? 0;
              const isActive = row.status === 'active';
              return (
                <EntityCard
                  key={row.id}
                  className="group-card"
                  padding="medium"
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
                  <div className="group-card__header">
                    <div className="group-card__title">{row.name}</div>
                  </div>
                  <div className="group-card__specialty">{row.specialty || 'Специальность не указана'}</div>
                  <div className="group-card__stats">
                    <div className="group-card__stat">
                      <span className="group-card__stat-label">Студентов</span>
                      <span className="group-card__stat-value">{stud}</span>
                    </div>
                    <div className="group-card__stat">
                      <span className="group-card__stat-label">Преподавателей</span>
                      <span className="group-card__stat-value">{teach}</span>
                    </div>
                  </div>
                  <StatusBadge tone={isActive ? 'success' : 'neutral'} className="group-card__status">
                    {isActive ? 'Активна' : 'Закрыта'}
                  </StatusBadge>
                  <div className="group-card__actions" onClick={(e) => e.stopPropagation()}>
                    <Button type="button" variant="outline" size="small" onClick={() => openEdit(row)}>
                      Редактировать
                    </Button>
                    {isActive ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="small"
                        onClick={() => {
                          setCloseTarget(row);
                          setCloseConfirmName('');
                        }}
                      >
                        Закрыть
                      </Button>
                    ) : (
                      <Button type="button" variant="primary" size="small" onClick={() => setReopenTarget(row)}>
                        Открыть
                      </Button>
                    )}
                  </div>
                </EntityCard>
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

      <Modal
        isOpen={createOpen}
        onClose={() => !createSubmitting && setCreateOpen(false)}
        title="Новая группа"
        size="medium"
        contentClassName="admin-group-modal__body"
        footer={(
          <>
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
          </>
        )}
      >
        <ModalSection title="Данные группы">
          <div className="admin-group-modal__field">
            <label className="admin-group-modal__label">
              Название группы <span className="admin-group-modal__required">*</span>
            </label>
            <input
              className="admin-group-modal__input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Например: ИС-31"
              autoComplete="off"
            />
          </div>
          <div className="admin-group-modal__field">
            <label className="admin-group-modal__label">
              Специальность <span className="admin-group-modal__required">*</span>
            </label>
            <input
              className="admin-group-modal__input"
              list="admin-group-specialty-datalist"
              value={createSpecialty}
              onChange={(e) => setCreateSpecialty(e.target.value)}
              placeholder="Выберите или введите новую"
              autoComplete="off"
            />
            <datalist id="admin-group-specialty-datalist">
              {specialtyOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </ModalSection>
          <ModalSection title="Примечание" variant="soft">
          <div className="admin-group-modal__hint">
            <p>По умолчанию группа создаётся со статусом «Активна».</p>
            <p>Назначения преподавателей задаются в разделе «Назначения».</p>
          </div>
          </ModalSection>
      </Modal>

      <Modal
        isOpen={!!editRow}
        onClose={() => !editSubmitting && setEditRow(null)}
        title={editRow?.name ? `Редактирование: ${editRow.name}` : 'Редактирование группы'}
        size="medium"
        contentClassName="admin-group-modal__body"
        footer={(
          <>
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
          </>
        )}
      >
        <ModalSection title="Данные группы">
          <div className="admin-group-modal__field">
            <label className="admin-group-modal__label">
              Название группы <span className="admin-group-modal__required">*</span>
            </label>
            <input
              className="admin-group-modal__input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="admin-group-modal__field">
            <label className="admin-group-modal__label">
              Специальность <span className="admin-group-modal__required">*</span>
            </label>
            <input
              className="admin-group-modal__input"
              list="admin-group-specialty-datalist-edit"
              value={editSpecialty}
              onChange={(e) => setEditSpecialty(e.target.value)}
              autoComplete="off"
            />
            <datalist id="admin-group-specialty-datalist-edit">
              {specialtyOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </ModalSection>
          {editRow && (
            <ModalSection title="Текущий статус" variant="soft">
            <div className="admin-group-modal__hint">
              <p>
                Статус: <strong>{editRow.status === 'active' ? 'Активна' : 'Закрыта'}</strong>
              </p>
            </div>
            </ModalSection>
          )}
      </Modal>

      <Modal
        isOpen={!!closeTarget}
        onClose={() => !closeSubmitting && setCloseTarget(null)}
        title={closeTarget?.name ? `Закрыть группу ${closeTarget.name}` : 'Закрыть группу'}
        size="medium"
        contentClassName="admin-group-modal__body"
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={() => setCloseTarget(null)} disabled={closeSubmitting}>
              Отмена
            </Button>
            <Button type="button" variant="danger" loading={closeSubmitting} onClick={() => void submitClose()}>
              Закрыть группу
            </Button>
          </>
        )}
      >
        <ModalSection title="Подтверждение закрытия" variant="warning">
          <div className="warning-card">
            <div className="warning-card__icon">!</div>
            <div className="warning-card__content">
              <p>После закрытия группа станет неактивной.</p>
            </div>
          </div>
          <div className="admin-group-modal__field">
            <label className="admin-group-modal__label">
              Введите название группы для подтверждения <span className="admin-group-modal__required">*</span>
            </label>
            <input
              className="admin-group-modal__input"
              value={closeConfirmName}
              onChange={(e) => setCloseConfirmName(e.target.value)}
              placeholder={closeTarget?.name}
              autoComplete="off"
            />
          </div>
        </ModalSection>
      </Modal>

      <Modal
        isOpen={!!viewId}
        onClose={() => setViewId(null)}
        title={viewData?.group ? `Группа ${viewData.group.name}` : 'Группа'}
        size="large"
        contentClassName="admin-group-modal__body"
        footer={viewData?.group ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const g = viewData?.group;
                setViewId(null);
                const row = groups.find((x) => x.id === g?.id);
                openEdit(row || { id: g?.id, name: g?.name, specialty: g?.specialty, status: g?.status });
              }}
            >
              Редактировать
            </Button>
            {viewData.group.status === 'active' ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  const g = viewData?.group;
                  setViewId(null);
                  setCloseTarget({ id: g?.id, name: g?.name });
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
                  const g = viewData?.group;
                  setViewId(null);
                  setReopenTarget({ id: g?.id, name: g?.name });
                }}
              >
                Открыть группу
              </Button>
            )}
          </>
        ) : null}
      >
          {viewLoading && (
            <LoadingState message="Загрузка..." className="admin-group-modal__state" />
          )}
          {!viewLoading && viewData?.group && (
            <div className="group-view">
              {/* Информация о группе */}
              <ModalSection title="Основная информация">
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-item__label">Название</span>
                    <span className="info-item__value">{viewData.group.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-item__label">Специальность</span>
                    <span className="info-item__value">{viewData.group.specialty || '—'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-item__label">Статус</span>
                    <StatusBadge tone={viewData.group.status === 'active' ? 'success' : 'neutral'}>
                      {viewData.group.status === 'active' ? 'Активна' : 'Закрыта'}
                    </StatusBadge>
                  </div>
                  <div className="info-item">
                    <span className="info-item__label">Создана</span>
                    <span className="info-item__value">{formatDateLong(viewData.group.createdAt)}</span>
                  </div>
                </div>
              </ModalSection>

              {/* Студенты */}
              <ModalSection title={`Студенты (${viewData.group.studentsCount ?? 0})`}>
                {(!viewData.students || viewData.students.length === 0) && (
                  <div className="admin-group-modal__empty-note">Студентов пока нет</div>
                )}
                {viewData.students?.length > 0 && (
                  <>
                    <div className="students-grid">
                      {viewData.students.slice(0, 12).map((s) => (
                        <div key={s.id} className="student-card">
                          <div className="student-card__name">{shortName(s.lastName, s.firstName, s.middleName)}</div>
                          <div className="student-card__avg">
                            {s.avgScore != null ? `Средний балл: ${s.avgScore}` : 'Нет оценок'}
                          </div>
                          {(s.overdueAssignments ?? 0) > 0 && (
                            <div className="student-card__warning">Просрочено заданий: {s.overdueAssignments}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    {(viewData.group.studentsCount ?? 0) > 12 && (
                      <div className="view-all-link">
                        <Button
                          type="button"
                          variant="secondary"
                          size="small"
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
              </ModalSection>

              {/* Преподаватели и предметы */}
              <ModalSection title="Преподаватели и предметы">
                {(!viewData.subjectBlocks || viewData.subjectBlocks.length === 0) && (
                  <div className="admin-group-modal__empty-note">Нет активных назначений</div>
                )}
                {viewData.subjectBlocks?.length > 0 && (
                  <div className="subjects-list">
                    {viewData.subjectBlocks.map((block, idx) => (
                      <div key={`${block.subject?.id}-${block.teacher?.id}-${idx}`} className="subject-card">
                        <div className="subject-card__name">{block.subject?.name || '—'}</div>
                        <div className="subject-card__teacher">
                          {block.teacher
                            ? shortName(block.teacher.lastName, block.teacher.firstName, block.teacher.middleName)
                            : 'Преподаватель не назначен'}
                        </div>
                        <div className="subject-card__count">
                          Активных заданий: {block.activeAssignmentsCount ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ModalSection>
            </div>
          )}
      </Modal>

      <ConfirmModal
        isOpen={!!reopenTarget}
        onClose={() => setReopenTarget(null)}
        title={reopenTarget ? `Открыть группу ${reopenTarget.name}` : 'Открыть группу'}
        message="Группа снова станет активной. После открытия проверьте назначения преподавателей."
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