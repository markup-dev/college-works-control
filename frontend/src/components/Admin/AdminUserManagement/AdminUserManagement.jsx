import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
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
import AdminCreateUserModal from '../AdminCreateUserModal/AdminCreateUserModal';
import AdminEditUserModal from '../AdminEditUserModal/AdminEditUserModal';
import AdminUserCredentialsModal from '../AdminUserCredentialsModal/AdminUserCredentialsModal';
import AdminUserPasswordResetModal from '../AdminUserPasswordResetModal/AdminUserPasswordResetModal';
import AdminUserViewModal from '../AdminUserViewModal/AdminUserViewModal';
import AdminUserWarningsModal from '../AdminUserWarningsModal/AdminUserWarningsModal';
import AdminUsersImportModal from '../AdminUsersImportModal/AdminUsersImportModal';
import './AdminUserManagement.scss';

const PER_PAGE = 12;

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
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [role, setRole] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [groupId, setGroupId] = useState('');
  const [sort, setSort] = useState('newest');
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
    if (st.filterGroupId != null && st.filterGroupId !== '') {
      setRole('student');
      setGroupId(String(st.filterGroupId));
      consumed = true;
    }
    if (consumed) navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

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

  useEffect(() => {
    setGroupId((prev) => {
      if (role === 'teacher' || role === 'admin') {
        return '';
      }
      if (role !== 'student' && prev === 'none') {
        return '';
      }
      return prev;
    });
  }, [role]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: PER_PAGE,
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
      setMeta({
        currentPage: m?.currentPage ?? page,
        lastPage: m?.lastPage ?? 1,
        total: m?.total ?? 0,
      });
    } catch (e) {
      setUsers([]);
      setError(e.response?.data?.message || 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, role, accountStatus, groupId, sort]);

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
        showError(firstApiErrorMessage(e.response?.data) || 'Не удалось загрузить предупреждения');
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
    setRole('');
    setAccountStatus('');
    setGroupId('');
    setSort('newest');
    setPage(1);
  }, []);

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

  const handleViewModalToggleBlock = useCallback(async () => {
    if (!viewUserRow) return;
    if (currentUserId != null && Number(viewUserRow.id) === currentUserId && viewUserRow.isActive) {
      showError('Нельзя заблокировать собственную учётную запись.');
      return;
    }
    try {
      await api.put(`/admin/users/${viewUserRow.id}`, { isActive: !viewUserRow.isActive });
      showSuccess(viewUserRow.isActive ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
      await fetchUsers();
      setViewUserRow(null);
    } catch (e) {
      showError(firstApiErrorMessage(e.response?.data) || 'Не удалось изменить статус');
    }
  }, [viewUserRow, currentUserId, fetchUsers, showError, showSuccess]);

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
    (_data, created) => {
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
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
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
              onChange={(e) => {
                setGroupId(e.target.value);
                setPage(1);
              }}
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
            onChange={(e) => {
              setAccountStatus(e.target.value);
              setPage(1);
            }}
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
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
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

                    <StatusBadge tone={st.tone} className="admin-user-card__status">
                      {st.label}
                    </StatusBadge>

                    {warnings.length > 0 && (
                      <div className="admin-user-card__warnings">
                        <button
                          type="button"
                          className="admin-user-card__warn-summary"
                          onClick={() => setWarningsUser(row)}
                          aria-label={`Предупреждения: ${warnings.map((w) => w.text).join(', ')}`}
                        >
                          <span className="admin-user-card__warn-icon" aria-hidden>
                            !
                          </span>
                          <span className="admin-user-card__warn-summary-text">
                            <span className="admin-user-card__warn-summary-title">
                              {warnings.length === 1 ? 'Предупреждение' : `Предупреждения (${warnings.length})`}
                            </span>
                            <span className="admin-user-card__warn-summary-hint">
                              {warnings.map((w) => w.text).join(' · ')}
                            </span>
                          </span>
                        </button>
                      </div>
                    )}

                  </div>
                </EntityCard>
              );
            })}
          </div>
        )}
      </div>

      {users.length > 0 && (
        <Pagination
          className="admin-user-management__pagination"
          currentPage={meta.currentPage}
          lastPage={meta.lastPage}
          total={meta.total}
          fallbackCount={users.length}
          disabled={loading}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}

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
            showError(firstApiErrorMessage(e.response?.data) || 'Не удалось удалить пользователя');
            throw e;
          }
        }}
      />
    </div>
  );
};

export default AdminUserManagement;