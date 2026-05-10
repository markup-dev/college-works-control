import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import Card from '../../UI/Card/Card';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import AdminCreateUserModal from '../AdminCreateUserModal/AdminCreateUserModal';
import AdminEditUserModal from '../AdminEditUserModal/AdminEditUserModal';
import AdminUserCredentialsModal from '../AdminUserCredentialsModal/AdminUserCredentialsModal';
import AdminUserPasswordResetModal from '../AdminUserPasswordResetModal/AdminUserPasswordResetModal';
import AdminUserViewModal from '../AdminUserViewModal/AdminUserViewModal';
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

const groupLineForUser = (row) => {
  if (row.role === 'teacher') {
    const list = row.teacherGroups;
    if (Array.isArray(list) && list.length) {
      return list.join(', ');
    }
    return '—';
  }
  if (row.role === 'student') {
    return row.studentGroup?.name || 'Без группы';
  }
  return '—';
};

const cardMenuItems = (row, currentUserId) => {
  const items = [
    { type: 'action', id: 'view', label: 'Просмотр профиля' },
    { type: 'action', id: 'edit', label: 'Редактировать' },
    { type: 'action', id: 'reset', label: 'Сбросить пароль' },
    { type: 'action', id: 'resend', label: 'Отправить доступ повторно на почту' },
    { type: 'sep' },
    { type: 'action', id: 'block', label: row.isActive ? 'Заблокировать' : 'Разблокировать' },
    { type: 'sep' },
  ];
  if (currentUserId == null || Number(row.id) !== Number(currentUserId)) {
    items.push({ type: 'action', id: 'delete', label: 'Удалить', danger: true });
  }
  return items;
};

const AdminUserManagement = () => {
  const { showInfo, showSuccess, showError } = useNotification();
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
  const [openMenuId, setOpenMenuId] = useState(null);

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
    if (openMenuId == null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.admin-user-card__menu-root')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenuId]);

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
    fetchUsers();
  }, [fetchUsers]);

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

  const handleCardMenuAction = useCallback(
    async (actionId, row) => {
      setOpenMenuId(null);
      switch (actionId) {
        case 'view':
          setViewUserRow(row);
          break;
        case 'edit':
          setEditUserRow(row);
          break;
        case 'reset':
          setResetModal({ row, variant: 'reset' });
          break;
        case 'resend':
          setResetModal({ row, variant: 'resend' });
          break;
        case 'block':
          try {
            await api.put(`/admin/users/${row.id}`, { isActive: !row.isActive });
            showSuccess(row.isActive ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
            await fetchUsers();
          } catch (e) {
            showError(firstApiErrorMessage(e.response?.data) || 'Не удалось изменить статус');
          }
          break;
        case 'delete':
          if (currentUserId != null && Number(row.id) === currentUserId) {
            showError('Нельзя удалить собственную учётную запись.');
            return;
          }
          setDeleteTargetRow(row);
          break;
        default:
          break;
      }
    },
    [currentUserId, fetchUsers, showError, showSuccess]
  );

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
        <div className="admin-user-management__banner admin-user-management__banner--error" role="alert">
          {error}
          <Button type="button" size="small" variant="outline" className="admin-user-management__retry" onClick={fetchUsers}>
            Повторить
          </Button>
        </div>
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
            <option value="none">Без группы</option>
            {groups.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
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
        <Button type="button" size="small" onClick={() => setCreateUserOpen(true)}>
          + Новый пользователь
        </Button>
        <Button type="button" size="small" variant="outline" onClick={() => setImportOpen(true)}>
          Импорт CSV
        </Button>
      </div>

      <div className={`admin-user-management__grid-wrap ${loading ? 'admin-user-management__grid-wrap--loading' : ''}`}>
        {loading && users.length === 0 ? (
          <p className="admin-user-management__hint">Загрузка…</p>
        ) : users.length === 0 ? (
          <p className="admin-user-management__hint">Пользователи не найдены</p>
        ) : (
          <div className="admin-user-management__card-grid" role="list">
            {users.map((row) => {
              const st = accountStatusPresentation(row);
              const phone = formatPhoneDisplay(row.phone);
              const warnings = Array.isArray(row.adminWarnings) ? row.adminWarnings : [];
              return (
                <Card
                  key={row.id}
                  className="admin-user-card"
                  padding="small"
                  shadow="small"
                  role="listitem"
                >
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

                  <div className="admin-user-card__row admin-user-card__row--labeled">
                    <span className="admin-user-card__label">Группа</span>
                    <span className="admin-user-card__value admin-user-card__multiline">{groupLineForUser(row)}</span>
                  </div>

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

                  <div className={`admin-user-card__status admin-user-card__status--${st.tone}`}>
                    <span className="admin-user-card__status-dot" aria-hidden />
                    <span>{st.label}</span>
                  </div>

                  {warnings.length > 0 && (
                    <div className="admin-user-card__warnings">
                      {warnings.map((w) => (
                        <button
                          key={`${row.id}-${w.key}-${w.text}`}
                          type="button"
                          className="admin-user-card__warn-line"
                          onClick={() =>
                            showInfo('Детали предупреждения — модалка 2.10 в следующем этапе.')
                          }
                        >
                          {w.text}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="admin-user-card__menu-root">
                    <button
                      type="button"
                      className="admin-user-card__kebab"
                      aria-label="Меню действий"
                      aria-expanded={openMenuId === row.id}
                      onClick={() => setOpenMenuId((id) => (id === row.id ? null : row.id))}
                    >
                      <span className="admin-user-card__kebab-dot" />
                      <span className="admin-user-card__kebab-dot" />
                      <span className="admin-user-card__kebab-dot" />
                    </button>
                    {openMenuId === row.id && (
                      <ul className="admin-user-card__menu" role="menu">
                        {cardMenuItems(row, currentUserId).map((item, idx) =>
                          item.type === 'sep' ? (
                            <li key={`sep-${row.id}-${idx}`} role="separator" className="admin-user-card__menu-sep" />
                          ) : (
                            <li key={item.id} role="none">
                              <button
                                type="button"
                                role="menuitem"
                                className={`admin-user-card__menu-item ${item.danger ? 'admin-user-card__menu-item--danger' : ''}`}
                                onClick={() => void handleCardMenuAction(item.id, row)}
                              >
                                {item.label}
                              </button>
                            </li>
                          )
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
        className="admin-user-management__pagination"
        currentPage={meta.currentPage}
        lastPage={meta.lastPage}
        total={meta.total}
        fallbackCount={users.length}
        disabled={loading}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
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

      <AdminUserViewModal isOpen={viewUserRow != null} onClose={() => setViewUserRow(null)} user={viewUserRow} />

      <AdminEditUserModal
        isOpen={editUserRow != null}
        onClose={() => setEditUserRow(null)}
        userRow={editUserRow}
        groups={groups}
        onSaved={() => {
          showSuccess('Данные пользователя сохранены');
          void fetchUsers();
        }}
      />

      <AdminUserPasswordResetModal
        isOpen={resetModal != null}
        onClose={() => setResetModal(null)}
        userRow={resetModal?.row}
        variant={resetModal?.variant ?? 'reset'}
        onSuccess={handleResetCredentialsSuccess}
      />

      <AdminUsersImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={handleUsersImported} />

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
