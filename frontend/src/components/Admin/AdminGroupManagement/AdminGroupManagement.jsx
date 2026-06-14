import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { getApiErrorMessage } from '../../../utils/adminApiErrors';
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
import { ADMIN_CARD_GRID_PAGE_SIZE } from '../../../config/adminPagination';
import usePaginationClamp from '../../../hooks/usePaginationClamp';
import { parsePaginationMeta } from '../../../utils/pagination';
import AdminGroupsImportModal from '../AdminGroupsImportModal/AdminGroupsImportModal';
import SearchableSelect from '../../UI/SearchableSelect/SearchableSelect';
import { toSpecialtySelectOptions } from '../../../utils/selectOptions';
import './AdminGroupManagement.scss';

const groupStatusPresentation = (row) => {
  if (row.status === 'graduated') {
    return { label: 'Выпущена', tone: 'neutral' };
  }
  if (row.status === 'active') {
    return { label: 'Активна', tone: 'success' };
  }
  return { label: 'Закрыта', tone: 'neutral' };
};

const formatStudyYears = (row) => {
  const from = row.admissionYear;
  const to = row.graduationYear;
  if (from && to) return `${from}–${to}`;
  if (from && row.studyYears) return `${from}–${from + row.studyYears}`;
  if (from) return String(from);
  return '—';
};

const formatCourseLabel = (row) => {
  const course = row.currentCourse;
  if (!course) return '—';
  const total = row.studyYears || row.specialtyRef?.studyYears;
  if (total) return `${course} из ${total}`;
  return `${course} курс`;
};

const parsePositiveId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'active', label: 'Активна' },
  { value: 'inactive', label: 'Закрыта' },
];

const COURSE_PROMOTION_CONFIRM_TEXT = 'ПЕРЕВЕСТИ ГРУППЫ';

const AdminGroupManagement = () => {
  const { showSuccess, showError } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('');
  const specialty = useMemo(() => parsePositiveId(searchParams.get('specialty_id')), [searchParams]);
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
  const [importOpen, setImportOpen] = useState(false);

  const [closeTarget, setCloseTarget] = useState(null);
  const [closeConfirmName, setCloseConfirmName] = useState('');
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  const [reopenTarget, setReopenTarget] = useState(null);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionActiveCount, setPromotionActiveCount] = useState(null);
  const [promotionConfirmText, setPromotionConfirmText] = useState('');
  const [promotionSubmitting, setPromotionSubmitting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [searchParams]);

  const applySpecialtyFilter = useCallback((value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('specialty_id', String(value));
      else next.delete('specialty_id');
      return next;
    }, { replace: true });
    setPage(1);
  }, [setSearchParams]);

  useEffect(() => {
    const st = location.state;
    if (!st || typeof st !== 'object') return;
    let consumed = false;
    let nextSearch = location.search || '';

    if (st.openCreateGroup) {
      setCreateOpen(true);
      consumed = true;
    }
    if (st.openImportGroups) {
      setImportOpen(true);
      consumed = true;
    }
    if (st.filterSpecialtyId != null && st.filterSpecialtyId !== '') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('specialty_id', String(st.filterSpecialtyId));
      nextSearch = `?${nextParams.toString()}`;
      consumed = true;
    }

    if (consumed) {
      navigate(`${location.pathname}${nextSearch}`, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, location.search, navigate, searchParams]);

  const refreshSpecialtyOptions = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/groups/specialties');
      const options = Array.isArray(data?.data) ? data.data : [];
      setSpecialtyOptions(options);
    } catch {
      setSpecialtyOptions([]);
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
        per_page: ADMIN_CARD_GRID_PAGE_SIZE,
        sort: 'name_asc',
      };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (status) params.status = status;
      if (specialty) params.specialty_id = Number(specialty);

      const { data } = await api.get('/admin/groups', { params });
      setGroups(Array.isArray(data?.data) ? data.data : []);
      const m = data?.meta;
      setMeta(parsePaginationMeta(m, page));
    } catch (e) {
      setGroups([]);
      setMeta({ currentPage: 1, lastPage: 1, total: 0 });
      setError(getApiErrorMessage(e, 'Не удалось загрузить группы'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, specialty]);

  usePaginationClamp(page, meta.lastPage, setPage);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, specialty]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatus('');
    setPage(1);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const resetDisabled = useMemo(
    () => !search.trim() && !status && !specialty,
    [search, status, specialty],
  );

  const specialtyFilterOptions = useMemo(
    () => toSpecialtySelectOptions(specialtyOptions),
    [specialtyOptions],
  );

  const specialtyCreateOptions = useMemo(
    () => toSpecialtySelectOptions(specialtyOptions),
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
        specialtyId: Number(createSpecialty),
      });
      showSuccess('Группа создана. Она закрыта — добавьте студентов, чтобы открыть.');
      setCreateOpen(false);
      void refreshSpecialtyOptions();
      void fetchGroups();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось создать группу'));
    } finally {
      setCreateSubmitting(false);
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
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось закрыть группу'));
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
      showError(getApiErrorMessage(e, 'Не удалось открыть группу'));
      throw e;
    }
  };

  const handleGroupsImported = useCallback(
    (data) => {
      const created = data?.summary?.created ?? 0;
      showSuccess(`Импорт завершён: создано групп — ${created}.`);
      void refreshSpecialtyOptions();
      void fetchGroups();
    },
    [fetchGroups, refreshSpecialtyOptions, showSuccess],
  );

  const isAugust = new Date().getMonth() === 7;

  const openPromotionModal = async () => {
    setPromotionConfirmText('');
    setPromotionActiveCount(null);
    setPromotionOpen(true);
    try {
      const { data } = await api.get('/admin/groups', {
        params: { status: 'active', per_page: 1 },
      });
      setPromotionActiveCount(data?.meta?.total ?? 0);
    } catch {
      setPromotionActiveCount(null);
    }
  };

  const closePromotionModal = () => {
    if (promotionSubmitting) return;
    setPromotionOpen(false);
    setPromotionConfirmText('');
  };

  const submitPromotion = async () => {
    if (promotionConfirmText.trim() !== COURSE_PROMOTION_CONFIRM_TEXT) {
      showError('Введите точный текст подтверждения');
      return;
    }
    setPromotionSubmitting(true);
    try {
      const { data } = await api.post('/admin/groups/promote');
      const updatedCount = Array.isArray(data?.groups) ? data.groups.length : 0;
      showSuccess(`Перевод завершён: обновлено групп — ${updatedCount}.`);
      setPromotionOpen(false);
      setPromotionConfirmText('');
      void fetchGroups();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось перевести группы'));
    } finally {
      setPromotionSubmitting(false);
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
        searchPlaceholder="Поиск по названию группы…"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        popoverAlign="end"
        popoverAriaLabel="Фильтры групп"
      >
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-group-specialty-filter">
            Специальность
          </label>
          <SearchableSelect
            value={specialty}
            onChange={applySpecialtyFilter}
            options={specialtyFilterOptions}
            placeholder="Все специальности"
            searchPlaceholder="Найти специальность…"
            ariaLabel="Фильтр по специальности"
          />
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
        <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
          Импорт CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!isAugust}
          title={isAugust ? undefined : 'Перевод групп доступен только в августе'}
          onClick={() => void openPromotionModal()}
        >
          Перевести группы на новый курс
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
            {groups.map((row, index) => {
              const stud = row.studentsCount ?? 0;
              const teach = row.teachersCount ?? 0;
              const isActive = row.status === 'active';
              const st = groupStatusPresentation(row);
              const specialtyName = row.specialtyRef?.name || row.specialty || 'Специальность не указана';
              const specialtyCode = row.specialtyRef?.code || '';

              return (
                <EntityCard
                  key={row.id}
                  className="group-card app-reveal-item"
                  style={{ animationDelay: `${index * 0.03}s` }}
                  padding="small"
                  role="button"
                  tabIndex={0}
                  interactive
                  onClick={() => navigate(`/admin/groups/${row.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/admin/groups/${row.id}`);
                    }
                  }}
                >
                  <div className="group-card__body">
                    <div className="group-card__top">
                      <div className="group-card__title-block">
                        <div className="group-card__name">{row.name}</div>
                        <div className="group-card__specialty" title={specialtyName}>
                          {specialtyName}
                        </div>
                        {specialtyCode && (
                          <span className="group-card__code">{specialtyCode}</span>
                        )}
                      </div>
                      <StatusBadge tone={st.tone} className="group-card__status">
                        {st.label}
                      </StatusBadge>
                    </div>

                    <div className="group-card__fields">
                      <div className="group-card__row group-card__row--labeled">
                        <span className="group-card__label">Курс</span>
                        <span className="group-card__value">{formatCourseLabel(row)}</span>
                      </div>
                      <div className="group-card__row group-card__row--labeled">
                        <span className="group-card__label">Годы</span>
                        <span className="group-card__value">{formatStudyYears(row)}</span>
                      </div>
                      <div className="group-card__row group-card__row--labeled">
                        <span className="group-card__label">Студентов</span>
                        <span className="group-card__value">{stud}</span>
                      </div>
                      <div className="group-card__row group-card__row--labeled">
                        <span className="group-card__label">Преподавателей</span>
                        <span className="group-card__value">{teach}</span>
                      </div>
                    </div>

                    <div className="group-card__actions" onClick={(e) => e.stopPropagation()}>
                      <Button type="button" variant="outline" size="small" onClick={() => navigate(`/admin/groups/${row.id}?edit=1`)}>
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
                      ) : row.status !== 'graduated' ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="small"
                          disabled={stud < 1}
                          title={stud < 1 ? 'Сначала добавьте хотя бы одного студента' : undefined}
                          onClick={() => setReopenTarget(row)}
                        >
                          Открыть
                        </Button>
                      ) : null}
                    </div>
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
        hideWhenSinglePage
        onPageChange={setPage}
      />

      <Modal
        isOpen={createOpen}
        onClose={() => !createSubmitting && setCreateOpen(false)}
        title="Новая группа"
        size="medium"
        contentClassName="admin-group-modal__body"
        footer={(
          <>
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
            <SearchableSelect
              value={createSpecialty}
              onChange={setCreateSpecialty}
              options={specialtyCreateOptions}
              placeholder="Выберите специальность"
              searchPlaceholder="Найти специальность…"
              ariaLabel="Специальность группы"
            />
          </div>
          <p className="admin-group-modal__hint">
            Новая группа создаётся закрытой — открыть её можно после добавления хотя бы одного студента.
          </p>
        </ModalSection>
      </Modal>

      <Modal
        isOpen={!!closeTarget}
        onClose={() => !closeSubmitting && setCloseTarget(null)}
        title={closeTarget?.name ? `Закрыть группу ${closeTarget.name}` : 'Закрыть группу'}
        size="medium"
        contentClassName="admin-group-modal__body"
        footer={(
          <Button
            type="button"
            variant="danger"
            loading={closeSubmitting}
            disabled={closeSubmitting || closeConfirmName.trim() !== (closeTarget?.name ?? '')}
            onClick={() => void submitClose()}
          >
            Закрыть группу
          </Button>
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

      <ConfirmModal
        isOpen={!!reopenTarget}
        onClose={() => setReopenTarget(null)}
        title={reopenTarget ? `Открыть группу ${reopenTarget.name}` : 'Открыть группу'}
        message={
          (reopenTarget?.studentsCount ?? 0) < 1
            ? 'В группе нет студентов — открыть её нельзя. Добавьте студентов и попробуйте снова.'
            : 'Группа снова станет активной. После открытия проверьте назначения преподавателей.'
        }
        confirmText="Открыть"
        onConfirm={async () => {
          await submitReopen();
        }}
      />
      <Modal
        isOpen={promotionOpen}
        onClose={closePromotionModal}
        title="Перевести группы на новый курс"
        size="medium"
        contentClassName="admin-group-modal__body"
        closeDisabled={promotionSubmitting}
        footer={(
          <Button
            type="button"
            variant="danger"
            loading={promotionSubmitting}
            disabled={promotionSubmitting || promotionConfirmText.trim() !== COURSE_PROMOTION_CONFIRM_TEXT}
            onClick={() => void submitPromotion()}
          >
            Перевести группы
          </Button>
        )}
      >
        <ModalSection title="Годовой перевод" variant="warning">
          <p className="admin-group-modal__hint">
            Операция переводит все активные группы на следующий курс. Группы последнего курса будут выпущены.
          </p>
          <p className="admin-group-modal__hint">
            Сейчас будет обработано активных групп: {promotionActiveCount ?? 'загрузка...'}.
          </p>
          <div className="admin-group-modal__field">
            <label className="admin-group-modal__label">
              Введите «{COURSE_PROMOTION_CONFIRM_TEXT}» для подтверждения
            </label>
            <input
              className="admin-group-modal__input"
              value={promotionConfirmText}
              onChange={(event) => setPromotionConfirmText(event.target.value)}
              autoComplete="off"
            />
          </div>
        </ModalSection>
      </Modal>
      <AdminGroupsImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleGroupsImported}
      />
    </div>
  );
};

export default AdminGroupManagement;