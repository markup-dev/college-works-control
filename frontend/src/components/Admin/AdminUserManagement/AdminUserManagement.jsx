import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useNotification } from '../../../context/NotificationContext';
import { getApiErrorMessage } from '../../../utils/adminApiErrors';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import EmptyState from '../../UI/EmptyState/EmptyState';
import EntityCard from '../../UI/EntityCard/EntityCard';
import ErrorBanner from '../../UI/ErrorBanner/ErrorBanner';
import LoadingState from '../../UI/LoadingState/LoadingState';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import { ADMIN_USERS_PAGE_SIZE } from '../../../config/adminPagination';
import usePaginationClamp from '../../../hooks/usePaginationClamp';
import { parsePaginationMeta } from '../../../utils/pagination';
import AdminCreateUserModal from '../AdminCreateUserModal/AdminCreateUserModal';
import AdminEditUserModal from '../AdminEditUserModal/AdminEditUserModal';
import AdminUserCredentialsModal from '../AdminUserCredentialsModal/AdminUserCredentialsModal';
import AdminUserPasswordResetModal from '../AdminUserPasswordResetModal/AdminUserPasswordResetModal';
import AdminUserViewModal from '../AdminUserViewModal/AdminUserViewModal';
import AdminUserWarningsModal from '../AdminUserWarningsModal/AdminUserWarningsModal';
import AdminUsersImportModal from '../AdminUsersImportModal/AdminUsersImportModal';
import './AdminUserManagement.scss';


const ROLE_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'student', label: 'Студент' },
  { value: 'teacher', label: 'Преподаватель' },
  { value: 'admin', label: 'Администратор' },
];

const ACCOUNT_STATUS_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'active', label: 'Активен' },
  { value: 'must_change_password', label: 'Требуется смена пароля' },
  { value: 'blocked', label: 'Заблокирован' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'По дате создания (новые)' },
  { value: 'oldest', label: 'По дате создания (старые)' },
  { value: 'name_asc', label: 'По ФИО (А-Я)' },
  { value: 'name_desc', label: 'По ФИО (Я-А)' },
  { value: 'last_login_desc', label: 'По последнему входу' },
];

const ROLE_VALUES = new Set(ROLE_OPTIONS.map((option) => option.value));
const ACCOUNT_STATUS_VALUES = new Set(ACCOUNT_STATUS_OPTIONS.map((option) => option.value));
const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value));

const parsePositiveId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
};

const getFiltersFromSearchParams = (params) => {
  const roleParam = params.get('role') || '';
  const accountStatusParam = params.get('account_status') || '';
  const sortParam = params.get('sort') || 'newest';
  const withoutGroup = params.get('without_group') === '1';

  return {
    search: params.get('search') || '',
    role: ROLE_VALUES.has(roleParam) ? roleParam : '',
    accountStatus: ACCOUNT_STATUS_VALUES.has(accountStatusParam) ? accountStatusParam : '',
    groupId: withoutGroup ? 'none' : parsePositiveId(params.get('group_id')),
    sort: SORT_VALUES.has(sortParam) ? sortParam : 'newest',
  };
};

const roleLabel = (role) => {
  switch (role) {
    case 'student':
      return 'Студент';
    case 'teacher':
      return 'Преподаватель';
    case 'admin':
      return 'Администратор';
    default:
      return role || '—';
  }
};

const formatPhoneDisplay = (phone) => {
  if (!phone || !String(phone).trim()) return null;
  return String(phone).trim();
};

const userInitials = (row) => {
  const a = (row.lastName || '').trim()[0] || '';
  const b = (row.firstName || '').trim()[0] || '';
  const s = `${a}${b}`.toUpperCase();
  return s || '?';
};

const accountStatusPresentation = (row) => {
  if (!row.isActive) {
    return { label: 'Заблокирован', tone: 'blocked' };
  }
  if (row.mustChangePassword) {
    return { label: 'Требуется смена пароля', tone: 'password' };
  }
  return { label: 'Активен', tone: 'active' };
};

const warningTone = (key) => (
  key === 'overdue_assignments' || key === 'stale_reviews' ? 'danger' : 'warning'
);

const secondLineOnUserCard = (row) => {
  if (row.role === 'admin') {
    return null;
  }
  if (row.role === 'teacher') {
    const d = (row.department || '').trim();
    return { label: 'Кафедра', value: d || '—' };
  }
  return {
    label: 'Группа',
    value: row.studentGroup?.name || 'Без группы',
  };
};

const AdminUserManagement = () => {
  const { showSuccess, showError } = useNotification();
  const { user: authUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = useMemo(() => getFiltersFromSearchParams(searchParams), [searchParams]);
  const { role, accountStatus, groupId, sort } = urlFilters;
  const [search, setSearch] = useState(() => getFiltersFromSearchParams(searchParams).search);
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);

  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [credentialsPayload, setCredentialsPayload] = useState(null);

  const [viewUserRow, setViewUserRow] = useState(null);
  const [editUserRow, setEditUserRow] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const [deleteTargetRow, setDeleteTargetRow] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const [warningsUser, setWarningsUser] = useState(null);
  const [warningsDetail, setWarningsDetail] = useState(null);
  const [warningsLoading, setWarningsLoading] = useState(false);

  const currentUserId = authUser?.id != null ? Number(authUser.id) : null;
  const pendingViewUserIdRef = useRef(null);

  useEffect(() => {
    setSearch(urlFilters.search);
    setPage(1);
  }, [urlFilters.search, searchParams]);

  const applyUserFilter = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if ('role' in patch) {
        if (patch.role) next.set('role', patch.role);
        else next.delete('role');
        if (patch.role !== 'student') {
          next.delete('group_id');
          next.delete('without_group');
        }
      }
      if ('groupId' in patch) {
        next.delete('without_group');
        next.delete('group_id');
        if (patch.groupId === 'none') next.set('without_group', '1');
        else if (patch.groupId) next.set('group_id', patch.groupId);
      }
      if ('accountStatus' in patch) {
        if (patch.accountStatus) next.set('account_status', patch.accountStatus);
        else next.delete('account_status');
      }
      if ('sort' in patch) {
        if (patch.sort && patch.sort !== 'newest') next.set('sort', patch.sort);
        else next.delete('sort');
      }
      return next;
    }, { replace: true });
    setPage(1);
  }, [setSearchParams]);

  useEffect(() => {
    const st = location.state;
    if (!st || typeof st !== 'object') return;
    let consumed = false;
    if (st.openCreateUser) {
      setCreateUserOpen(true);
      consumed = true;
    }
    if (st.openImportUsers) {
      setImportOpen(true);
      consumed = true;
    }
    let nextSearch = location.search || '';
    if (st.filterGroupId != null && st.filterGroupId !== '') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('role', 'student');
      nextParams.set('group_id', String(st.filterGroupId));
      nextSearch = `?${nextParams.toString()}`;
      consumed = true;
    }
    if (st.viewUserId != null && st.viewUserId !== '') {
      pendingViewUserIdRef.current = Number(st.viewUserId);
      consumed = true;
    }
    if (consumed) navigate(`${location.pathname}${nextSearch}`, { replace: true, state: {} });
  }, [location.state, location.pathname, location.search, navigate, searchParams]);

  useEffect(() => {
    const pendingId = pendingViewUserIdRef.current;
    if (!pendingId || loading) return;
    const row = users.find((user) => Number(user.id) === pendingId);
    if (row) {
      setViewUserRow(row);
      pendingViewUserIdRef.current = null;
    }
  }, [users, loading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/groups', {
          params: { per_page: 100, sort: 'name_asc', status: 'active' },
        });
        if (!cancelled) {
          setGroups(Array.isArray(data?.data) ? data.data : []);
        }
      } catch {
        if (!cancelled) setGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, role, accountStatus, groupId, sort]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: ADMIN_USERS_PAGE_SIZE,
        sort: sort || 'newest',
      };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (role) params.role = role;
      if (accountStatus) params.account_status = accountStatus;
      if (groupId === 'none') {
        params.without_group = 1;
      } else if (groupId) {
        params.group_id = Number(groupId);
      }

      const { data } = await api.get('/admin/users', { params });
      setUsers(Array.isArray(data?.data) ? data.data : []);
      const m = data?.meta;
      setMeta(parsePaginationMeta(m, page));
    } catch (e) {
      setUsers([]);
      setError(getApiErrorMessage(e, 'Не удалось загрузить пользователей'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, role, accountStatus, groupId, sort]);

  usePaginationClamp(page, meta.lastPage, setPage);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!warningsUser) {
      setWarningsDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setWarningsLoading(true);
      setWarningsDetail(null);
      try {
        const { data } = await api.get(`/admin/users/${warningsUser.id}/warnings-detail`);
        if (!cancelled) {
          setWarningsDetail(data);
        }
      } catch (e) {
        showError(getApiErrorMessage(e, 'Не удалось загрузить предупреждения'));
        if (!cancelled) {
          setWarningsUser(null);
        }
      } finally {
        if (!cancelled) {
          setWarningsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [warningsUser, showError]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setPage(1);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const resetDisabled = useMemo(
    () =>
      !search.trim() &&
      !role &&
      !accountStatus &&
      !groupId &&
      sort === 'newest',
    [search, role, accountStatus, groupId, sort]
  );

  const handleViewModalEdit = useCallback(() => {
    if (!viewUserRow) return;
    setEditUserRow(viewUserRow);
    setViewUserRow(null);
  }, [viewUserRow]);

  const handleViewModalReset = useCallback(() => {
    if (!viewUserRow) return;
    setResetModal(viewUserRow);
  }, [viewUserRow]);

  const [blockConfirmRow, setBlockConfirmRow] = useState(null);

  const handleViewModalToggleBlock = useCallback(() => {
    if (!viewUserRow) return;
    if (currentUserId != null && Number(viewUserRow.id) === currentUserId && viewUserRow.isActive) {
      showError('Нельзя заблокировать собственную учётную запись.');
      return;
    }
    setBlockConfirmRow(viewUserRow);
  }, [viewUserRow, currentUserId, showError]);

  const executeToggleBlock = useCallback(async () => {
    if (!blockConfirmRow) return;
    try {
      await api.put(`/admin/users/${blockConfirmRow.id}`, { isActive: !blockConfirmRow.isActive });
      showSuccess(blockConfirmRow.isActive ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
      await fetchUsers();
      setViewUserRow((prev) => (
        prev && Number(prev.id) === Number(blockConfirmRow.id) ? null : prev
      ));
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось изменить статус'));
      throw e;
    }
  }, [blockConfirmRow, fetchUsers, showError, showSuccess]);

  const handleViewModalDelete = useCallback(() => {
    if (!viewUserRow) return;
    if (currentUserId != null && Number(viewUserRow.id) === currentUserId) {
      showError('Нельзя удалить собственную учётную запись.');
      return;
    }
    setDeleteTargetRow(viewUserRow);
  }, [viewUserRow, currentUserId, showError]);

  const handleResetCredentialsSuccess = useCallback(
    (data) => {
      void fetchUsers();
      setCredentialsPayload({
        login: data?.user?.login ?? '',
        plainPassword: data?.plainPassword ?? '',
        credentialsSent: Boolean(data?.credentialsSent),
      });
      setCredentialsOpen(true);
    },
    [fetchUsers]
  );

  const handleUsersImported = useCallback(
    (data) => {
      const created = data?.summary?.created ?? 0;
      showSuccess(`Импорт завершён: создано пользователей — ${created}.`);
      void fetchUsers();
    },
    [fetchUsers, showSuccess]
  );

  const handleUserCreated = useCallback(
    ({ user, plainPassword, credentialsSent }) => {
      void fetchUsers();
      setCredentialsPayload({
        login: user?.login ?? '',
        plainPassword: plainPassword ?? '',
        credentialsSent: Boolean(credentialsSent),
      });
      setCredentialsOpen(true);
    },
    [fetchUsers]
  );

  return (
    <div className="admin-user-management">
      <div className="admin-user-management__head">
        <h1 className="admin-user-management__title">Пользователи</h1>
      </div>

      {error && (
        <ErrorBanner
          className="admin-user-management__error"
          title="Ошибка загрузки пользователей"
          message={error}
          actionLabel="Повторить"
          onAction={fetchUsers}
        />
      )}

      <DashboardFilterToolbar
        className="admin-user-management__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по ФИО, логину, email…"
        popoverAlign="end"
        popoverAriaLabel="Фильтры списка пользователей"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
      >
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-users-role">
            Роль
          </label>
          <select
            id="admin-users-role"
            className="filter-select"
            value={role}
            onChange={(e) => applyUserFilter({ role: e.target.value })}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {(role === '' || role === 'student') && (
          <div className="filter-popover__field">
            <label className="filter-popover__label" htmlFor="admin-users-group">
              Группа
            </label>
            <select
              id="admin-users-group"
              className="filter-select"
              value={groupId}
              onChange={(e) => applyUserFilter({ groupId: e.target.value })}
            >
              <option value="">Все группы</option>
              {role === 'student' && <option value="none">Без группы</option>}
              {groups.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-users-acc-status">
            Статус
          </label>
          <select
            id="admin-users-acc-status"
            className="filter-select"
            value={accountStatus}
            onChange={(e) => applyUserFilter({ accountStatus: e.target.value })}
          >
            {ACCOUNT_STATUS_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="admin-users-sort">
            Сортировка
          </label>
          <select
            id="admin-users-sort"
            className="filter-select"
            value={sort}
            onChange={(e) => applyUserFilter({ sort: e.target.value })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </DashboardFilterToolbar>

      <div className="admin-user-management__actions-row">
        <Button type="button" size="small" variant="primary" onClick={() => setCreateUserOpen(true)}>
          + Новый пользователь
        </Button>
        <Button type="button" size="small" variant="secondary" onClick={() => setImportOpen(true)}>
          Импорт CSV
        </Button>
      </div>

      <div className={`admin-user-management__grid-wrap ${loading && users.length === 0 ? 'admin-user-management__grid-wrap--loading' : ''}`}>
        {loading && users.length === 0 ? (
          <LoadingState message="Загрузка пользователей..." className="admin-user-management__state" />
        ) : users.length === 0 ? (
          <EmptyState
            title="Пользователи не найдены"
            message="Попробуйте изменить параметры поиска или фильтрации"
            className="admin-user-management__state"
          />
        ) : (
          <div className="admin-user-management__card-grid" role="list">
            {users.map((row, index) => {
              const st = accountStatusPresentation(row);
              const phone = formatPhoneDisplay(row.phone);
              const warnings = Array.isArray(row.adminWarnings) ? row.adminWarnings : [];
              const cardSecondLine = secondLineOnUserCard(row);
              return (
                <EntityCard
                  key={row.id}
                  className="admin-user-card app-reveal-item"
                  style={{ animationDelay: `${index * 0.03}s` }}
                  padding="small"
                  role="listitem"
                  interactive
                >
                  <button
                    type="button"
                    className="admin-user-card__open-profile-hit"
                    tabIndex={-1}
                    aria-label={`Открыть профиль: ${[row.lastName, row.firstName].filter(Boolean).join(' ')}`}
                    onClick={() => setViewUserRow(row)}
                  />
                  <div className="admin-user-card__body">
                    <div className="admin-user-card__top">
                      <div className="admin-user-card__top-main">
                        <div className="admin-user-card__avatar" aria-hidden>
                          {userInitials(row)}
                        </div>
                        <div className="admin-user-card__title-block">
                          <div className="admin-user-card__lastname">{row.lastName || '—'}</div>
                          <div className="admin-user-card__first-middle">
                            {[row.firstName, row.middleName].filter(Boolean).join(' ') || '—'}
                          </div>
                        </div>
                      </div>
                      <StatusBadge tone={st.tone} className="admin-user-card__status">
                        {st.label}
                      </StatusBadge>
                    </div>

                    <div className="admin-user-card__fields">
                      <div className="admin-user-card__row admin-user-card__row--labeled">
                        <span className="admin-user-card__label">Роль</span>
                        <span className="admin-user-card__value">{roleLabel(row.role)}</span>
                      </div>

                      {cardSecondLine && (
                        <div className="admin-user-card__row admin-user-card__row--labeled">
                          <span className="admin-user-card__label">{cardSecondLine.label}</span>
                          <span className="admin-user-card__value admin-user-card__multiline">{cardSecondLine.value}</span>
                        </div>
                      )}

                      <div className="admin-user-card__row admin-user-card__row--labeled">
                        <span className="admin-user-card__label">Email</span>
                        <span className="admin-user-card__value admin-user-card__ellipsis" title={row.email || ''}>
                          {row.email || '—'}
                        </span>
                      </div>

                      <div className="admin-user-card__row admin-user-card__row--labeled">
                        <span className="admin-user-card__label">Телефон</span>
                        <span className="admin-user-card__value">{phone || 'Не указан'}</span>
                      </div>
                    </div>

                    {warnings.length > 0 && (
                      <div className="admin-user-card__warnings">
                        <div className="admin-user-card__warnings-head">
                          <span className="admin-user-card__warnings-label">Внимание</span>
                          <button
                            type="button"
                            className="admin-user-card__warnings-link"
                            onClick={() => setWarningsUser(row)}
                            aria-label={`Подробнее о предупреждениях: ${warnings.map((w) => w.text).join(', ')}`}
                          >
                            Подробнее
                          </button>
                        </div>
                        <ul className="admin-user-card__warnings-list">
                          {warnings.map((warning, warningIndex) => (
                            <li key={`${warning.key}-${warningIndex}`}>
                              <StatusBadge tone={warningTone(warning.key)}>
                                {warning.text}
                              </StatusBadge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  </div>
                </EntityCard>
              );
            })}
          </div>
        )}
      </div>

      <Pagination
        className="admin-user-management__pagination"
        currentPage={meta.currentPage}
        lastPage={meta.lastPage}
        total={meta.total}
        fallbackCount={users.length}
        disabled={loading}
        hideWhenSinglePage
        onPageChange={setPage}
      />

      <AdminCreateUserModal
        isOpen={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        groups={groups}
        onCreated={handleUserCreated}
      />

      <AdminUserCredentialsModal
        isOpen={credentialsOpen}
        onClose={() => {
          setCredentialsOpen(false);
          setCredentialsPayload(null);
        }}
        login={credentialsPayload?.login}
        plainPassword={credentialsPayload?.plainPassword}
        credentialsSent={credentialsPayload?.credentialsSent}
      />

      <AdminUserViewModal
        isOpen={viewUserRow != null}
        onClose={() => setViewUserRow(null)}
        user={viewUserRow}
        currentUserId={currentUserId}
        onEdit={handleViewModalEdit}
        onResetPassword={handleViewModalReset}
        onToggleBlock={handleViewModalToggleBlock}
        onDelete={handleViewModalDelete}
      />

      <AdminEditUserModal
        isOpen={editUserRow != null}
        onClose={() => setEditUserRow(null)}
        userRow={editUserRow}
        currentUserId={currentUserId}
        groups={groups}
        onSaved={() => {
          showSuccess('Данные пользователя сохранены');
          void fetchUsers();
        }}
      />

      <AdminUserPasswordResetModal
        isOpen={resetModal != null}
        onClose={() => setResetModal(null)}
        userRow={resetModal}
        onSuccess={handleResetCredentialsSuccess}
      />

      <AdminUsersImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={handleUsersImported} />

      <AdminUserWarningsModal
        isOpen={warningsUser != null}
        onClose={() => {
          setWarningsUser(null);
          setWarningsDetail(null);
        }}
        loading={warningsLoading}
        detail={warningsDetail}
        userRow={warningsUser}
      />

      <ConfirmModal
        isOpen={blockConfirmRow != null}
        onClose={() => setBlockConfirmRow(null)}
        title={blockConfirmRow?.isActive ? 'Заблокировать пользователя?' : 'Разблокировать пользователя?'}
        message={
          blockConfirmRow
            ? blockConfirmRow.isActive
              ? `${[blockConfirmRow.lastName, blockConfirmRow.firstName].filter(Boolean).join(' ') || blockConfirmRow.login} потеряет доступ к системе. Активные сессии будут недоступны.`
              : `${[blockConfirmRow.lastName, blockConfirmRow.firstName].filter(Boolean).join(' ') || blockConfirmRow.login} снова получит доступ к системе.`
            : ''
        }
        confirmText={blockConfirmRow?.isActive ? 'Заблокировать' : 'Разблокировать'}
        danger={Boolean(blockConfirmRow?.isActive)}
        onConfirm={executeToggleBlock}
      />

      <ConfirmModal
        isOpen={deleteTargetRow != null}
        onClose={() => setDeleteTargetRow(null)}
        title="Удалить пользователя?"
        message={
          deleteTargetRow
            ? `Будет удалён пользователь ${[deleteTargetRow.lastName, deleteTargetRow.firstName].filter(Boolean).join(' ')}. Действие необратимо.`
            : ''
        }
        danger
        confirmText="Удалить"
        onConfirm={async () => {
          if (!deleteTargetRow) return;
          try {
            await api.delete(`/admin/users/${deleteTargetRow.id}`);
            showSuccess('Пользователь удалён');
            setViewUserRow((v) => (v && Number(v.id) === Number(deleteTargetRow.id) ? null : v));
            await fetchUsers();
          } catch (e) {
            showError(getApiErrorMessage(e, 'Не удалось удалить пользователя'));
            throw e;
          }
        }}
      />
    </div>
  );
};

export default AdminUserManagement;