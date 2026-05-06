import React, { useEffect, useState } from 'react';
import Button from '../../UI/Button/Button';
import Badge from '../../UI/Badge/Badge';
import Card from '../../UI/Card/Card';
import Modal from '../../UI/Modal/Modal';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import FileDropzone from '../../UI/FileDropzone/FileDropzone';
import Pagination from '../../UI/Pagination/Pagination';
import { useNotification } from '../../../context/NotificationContext';
import {
  copyTextToClipboard,
  downloadCsvTemplate,
  updateAdminFilterField,
  resetAdminFilterState,
  prevAdminFilterPage,
  nextAdminFilterPage,
  handleAdminActionResult,
} from '../../../utils';
import './UserManagement.scss';

const createDefaultUserFormData = () => ({
  login: '',
  lastName: '',
  firstName: '',
  middleName: '',
  email: '',
  phone: '',
  password: '',
  role: 'student',
  groupId: '',
  department: '',
  status: 'active',
});

const createUserFormDataFromUser = (user) => ({
  login: user?.login || '',
  lastName: user?.lastName || '',
  firstName: user?.firstName || '',
  middleName: user?.middleName || '',
  email: user?.email || '',
  phone: user?.phone || '',
  password: '',
  role: user?.role || 'student',
  groupId: user?.studentGroup?.id ?? '',
  department: user?.department || '',
  status: user?.status || (user?.isActive === false ? 'inactive' : 'active'),
});

const UserManagement = ({
  users,
  paginationMeta = {},
  query = {},
  onFetchUsers,
  groups = [],
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onPreviewUsersImport,
  onImportUsers
}) => {
  const USERS_IMPORT_TEMPLATE = `login,email,password,last_name,first_name,middle_name,role,group,department,phone
ivanov01,ivanov@mail.ru,,Иванов,Иван,Иванович,student,ИСП-401,,+7 (999) 123-45-67`;
  const { showSuccess, showError, showInfo } = useNotification();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importMode, setImportMode] = useState('strict');
  const [importLoading, setImportLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [filterState, setFilterState] = useState({
    search: '',
    role: 'all',
    status: 'all',
    groupId: 'all',
    sort: query.sort || 'newest',
    page: query.page || 1,
    perPage: query.perPage || 24,
  });
  const [formData, setFormData] = useState(createDefaultUserFormData);
  const [savingUser, setSavingUser] = useState(false);

  const closeUserForm = () => {
    setShowCreateForm(false);
    setEditingUser(null);
    setFormData(createDefaultUserFormData());
  };

  const closeImportPanel = () => {
    setShowImportPanel(false);
    setImportFile(null);
    setImportPreview(null);
    setImportMode('strict');
  };

  useEffect(() => {
    onFetchUsers?.({
      search: filterState.search || undefined,
      role: filterState.role !== 'all' ? filterState.role : undefined,
      status: filterState.status !== 'all' ? filterState.status : undefined,
      groupId: filterState.groupId !== 'all' ? Number(filterState.groupId) : undefined,
      sort: filterState.sort,
      page: filterState.page,
      perPage: filterState.perPage,
    });
  }, [filterState, onFetchUsers]);

  const handleCreate = () => {
    setFormData(createDefaultUserFormData());
    setEditingUser(null);
    setShowCreateForm(true);
  };

  const handleEdit = (user) => {
    setFormData(createUserFormDataFromUser(user));
    setEditingUser(user);
    setShowCreateForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingUser) {
      return;
    }
    try {
      const submitData = { 
        ...formData,
        lastName: formData.lastName?.trim() || '',
        firstName: formData.firstName?.trim() || '',
        middleName: formData.middleName?.trim() || '',
        login: formData.login?.trim() || '',
        email: formData.email?.trim() || '',
        phone: formData.phone?.trim() || '',
        department: formData.role === 'teacher' ? (formData.department?.trim() || '') : '',
      };

      if (submitData.role === 'student') {
        const gid = typeof submitData.groupId === 'number' ? submitData.groupId : parseInt(String(submitData.groupId), 10);
        submitData.groupId = Number.isFinite(gid) && gid > 0 ? gid : '';
      } else {
        delete submitData.groupId;
      }
      delete submitData.group;

      if (!editingUser) {
        submitData.password = '';
        submitData.generatePassword = true;
        submitData.sendCredentials = true;
      } else {
        submitData.isActive = formData.status === 'active';
      }

      const { validateUserData } = await import('../../../utils/adminHelpers');
      const validation = validateUserData(submitData, !!editingUser);
      
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        showError(firstError);
        return;
      }

      setSavingUser(true);

      if (editingUser) {
        const result = await onUpdateUser(editingUser.id, submitData);
        const isSuccess = handleAdminActionResult({
          result,
          showSuccess,
          showError,
          successMessage: 'Пользователь обновлен',
          errorMessage: 'Не удалось обновить пользователя',
        });
        if (!isSuccess) {
          return;
        }
      } else {
        const result = await onCreateUser(submitData);
        const isSuccess = handleAdminActionResult({
          result,
          showSuccess,
          showError,
          successMessage: 'Пользователь создан',
          errorMessage: 'Не удалось создать пользователя',
        });
        if (!isSuccess) {
          return;
        }
      }
      closeUserForm();
    } catch (error) {
      showError(error.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDelete = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      const result = await onDeleteUser(userToDelete.id);
      const isSuccess = handleAdminActionResult({
        result,
        showSuccess,
        showError,
        successMessage: 'Пользователь удален',
        errorMessage: 'Не удалось удалить пользователя',
      });
      if (!isSuccess) {
        return;
      }
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const handlePreviewImport = async () => {
    if (!importFile) {
      showError('Сначала выберите CSV файл');
      return;
    }

    setImportLoading(true);
    const result = await onPreviewUsersImport?.(importFile);
    setImportLoading(false);

    const isSuccess = handleAdminActionResult({
      result,
      showSuccess,
      showError,
      errorMessage: 'Не удалось проверить файл',
    });
    if (!isSuccess) {
      return;
    }

    setImportPreview(result.data?.data || result.data);
    showInfo(
      `Проверка завершена: валидных строк ${(result.data?.data || result.data)?.summary?.validRows ?? 0}, с ошибками ${(result.data?.data || result.data)?.summary?.errorRows ?? 0}`
    );
  };

  const handleCommitImport = async () => {
    if (!importPreview?.validRows?.length) {
      showError('Нет валидных строк для импорта');
      return;
    }

    setImportLoading(true);
    const result = await onImportUsers?.(importPreview.validRows, importMode, true);
    setImportLoading(false);

    const isSuccess = handleAdminActionResult({
      result,
      showSuccess,
      showError,
      errorMessage: 'Импорт завершился с ошибкой',
    });
    if (!isSuccess) {
      if (result?.data?.rows) {
        setImportPreview((prev) => ({ ...(prev || {}), rows: result.data.rows, summary: result.data.summary }));
      }
      return;
    }

    const payload = result.data?.data || result.data;
    showSuccess(`Импорт завершен: создано ${payload?.summary?.created ?? 0} пользователей`);
    setImportFile(null);
    setImportPreview(null);
  };

  const roleLabels = {
    student: 'Студент',
    teacher: 'Преподаватель',
    admin: 'Администратор',
  };

  const onFilterChange = (field, value) => {
    setFilterState((prev) => updateAdminFilterField(prev, field, value));
  };

  const copyTemplate = async (content) => {
    try {
      await copyTextToClipboard(content);
      showSuccess('Шаблон скопирован в буфер обмена');
    } catch {
      showError('Не удалось скопировать шаблон');
    }
  };

  return (
    <div className="user-management">
      <div className="section-header">
        <h2>Управление пользователями</h2>
        <div className="user-actions">
          <Button variant="secondary" onClick={() => setShowImportPanel(true)}>
            ⬆️ Импорт CSV
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            + Добавить пользователя
          </Button>
        </div>
      </div>

      <Card className="user-management__filters">
        <div className="user-management__filters-grid">
          <div className="user-management__filter-field user-management__filter-field--search">
            <label>Поиск</label>
            <input
              type="text"
              placeholder="По ФИО, логину, email"
              value={filterState.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
            />
          </div>
          <div className="user-management__filter-field">
            <label>Роль</label>
            <select value={filterState.role} onChange={(e) => onFilterChange('role', e.target.value)}>
              <option value="all">Все роли</option>
              <option value="student">Студенты</option>
              <option value="teacher">Преподаватели</option>
              <option value="admin">Админы</option>
            </select>
          </div>
          <div className="user-management__filter-field">
            <label>Статус</label>
            <select value={filterState.status} onChange={(e) => onFilterChange('status', e.target.value)}>
              <option value="all">Любой статус</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
          </div>
          <div className="user-management__filter-field">
            <label>Группа</label>
            <select value={filterState.groupId} onChange={(e) => onFilterChange('groupId', e.target.value)}>
              <option value="all">Все группы</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="user-management__filter-field">
            <label>Сортировка</label>
            <select value={filterState.sort} onChange={(e) => onFilterChange('sort', e.target.value)}>
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
              <option value="name_asc">ФИО А-Я</option>
              <option value="name_desc">ФИО Я-А</option>
              <option value="last_login_desc">Последний вход: новые</option>
              <option value="last_login_asc">Последний вход: старые</option>
            </select>
          </div>
          <div className="user-management__filter-field user-management__filter-field--action">
            <label>Действия</label>
            <Button
              variant="outline"
              onClick={() =>
                setFilterState((prev) => resetAdminFilterState(prev, {
                  search: '',
                  role: 'all',
                  status: 'all',
                  groupId: 'all',
                  sort: 'newest',
                  page: 1,
                }))
              }
            >
              Сбросить
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showImportPanel}
        onClose={closeImportPanel}
        title="Массовый импорт пользователей"
        size="large"
        className="admin-form-modal"
      >
        <div className="user-form user-form--modal">
          <div className="admin-modal-help">
            <p className="admin-modal-help__title">Как подготовить файл</p>
            <p>CSV в кодировке UTF-8. Первая строка может быть заголовком.</p>
            <p className="admin-modal-help__sample">
              login,email,password,last_name,first_name,middle_name,role,group,department,phone
            </p>
            <p className="admin-modal-help__sample">
              ivanov01,ivanov@mail.ru,,Иванов,Иван,Иванович,student,ИСП-401,,+7 (999) 123-45-67
            </p>
            <div className="admin-modal-help__actions">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => downloadCsvTemplate('users-import-template.csv', USERS_IMPORT_TEMPLATE)}
              >
                Скачать шаблон CSV
              </Button>
              <Button
                type="button"
                variant="warning"
                size="small"
                onClick={() => copyTemplate(USERS_IMPORT_TEMPLATE)}
              >
                Скопировать шаблон
              </Button>
            </div>
          </div>
          <p>Поддерживаемые колонки: login,email,password,last_name,first_name,middle_name,role,group,department,phone</p>
          <div className="form-row form-row--single">
            <div className="form-group">
              <label>CSV файл</label>
              <FileDropzone
                accept=".csv,.txt"
                selectedFiles={importFile ? [importFile] : []}
                buttonText="Выбрать CSV файл"
                hint="Можно выбрать файл или перетащить его сюда."
                onFilesSelected={(files) => {
                  setImportFile(files[0] || null);
                  setImportPreview(null);
                }}
              />
              <div className="form-actions">
                <Button type="button" variant="primary" onClick={handlePreviewImport} loading={importLoading}>
                  Проверить файл
                </Button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Режим импорта</label>
              <select value={importMode} onChange={(e) => setImportMode(e.target.value)}>
                <option value="strict">Strict (если есть ошибки — ничего не создавать)</option>
                <option value="partial">Partial (создавать только валидные строки)</option>
              </select>
            </div>
          </div>

          {importPreview?.summary && (
            <div className="form-row">
              <div className="form-group">
                <p>
                  Всего строк: {importPreview.summary.totalRows} | Валидных: {importPreview.summary.validRows} | С ошибками:{' '}
                  {importPreview.summary.errorRows}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCommitImport}
                  loading={importLoading}
                  disabled={!importPreview.validRows?.length}
                >
                  Импортировать пользователей
                </Button>
              </div>
            </div>
          )}

          {Array.isArray(importPreview?.rows) && importPreview.rows.some((row) => row.status === 'error') && (
            <div className="form-row">
              <div className="form-group">
                <h4>Ошибки в файле</h4>
                <ul>
                  {importPreview.rows
                    .filter((row) => row.status === 'error')
                    .slice(0, 15)
                    .map((row) => (
                      <li key={`row-${row.row}`}>
                        Строка {row.row}: {row.errors?.join(' | ')}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showCreateForm}
        onClose={closeUserForm}
        title={editingUser ? 'Редактировать пользователя' : 'Создать пользователя'}
        size="large"
        className="admin-form-modal"
      >
        <div className="user-form user-form--modal">
          <form onSubmit={handleSubmit} aria-busy={savingUser}>
            <div className="form-row">
              <div className="form-group">
                <label>Логин *</label>
                <input
                  type="text"
                  value={formData.login}
                  onChange={(e) => setFormData(prev => ({ ...prev, login: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Фамилия *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Имя *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Отчество</label>
                <input
                  type="text"
                  value={formData.middleName}
                  onChange={(e) => setFormData(prev => ({ ...prev, middleName: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Телефон</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
            </div>
            {editingUser && (
              <div className="form-row">
                <div className="form-group">
                  <label>Статус пользователя</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="active">Активен</option>
                    <option value="inactive">Неактивен</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Пароль (оставьте пустым, чтобы не менять)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label>Роль *</label>
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const nextRole = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      role: nextRole,
                      groupId: nextRole === 'student' ? prev.groupId : '',
                      department: nextRole === 'teacher' ? prev.department : '',
                    }));
                  }}
                >
                  <option value="student">Студент</option>
                  <option value="teacher">Преподаватель</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              {formData.role === 'student' ? (
                <div className="form-group">
                  <label>Группа *</label>
                  <select
                    value={
                      formData.groupId === '' || formData.groupId === null ? '' : String(formData.groupId)
                    }
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        groupId: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    required
                  >
                    <option value="">Выберите группу</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <small className="form-hint">Чтобы перевести студента в другую группу, выберите нужную здесь и сохраните.</small>
                </div>
              ) : formData.role === 'teacher' ? (
                <div className="form-group">
                  <label>Кафедра</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  />
                </div>
              ) : null}
            </div>
            <div className="form-actions">
              <Button type="submit" variant="primary" loading={savingUser} disabled={savingUser}>
                {editingUser ? 'Сохранить' : 'Создать'}
              </Button>
              <Button 
                type="button" 
                variant="secondary"
                onClick={closeUserForm}
              >
                Отмена
              </Button>
            </div>
          </form>
        </div>
      </Modal>
      <div className="user-management__cards">
        {users.length === 0 ? (
          <Card className="user-management__empty">
            <p>Пользователи не найдены.</p>
          </Card>
        ) : (
          users.map((user) => (
            <Card className="user-card" key={user.id} padding="small">
              <div className="user-card__top">
                <h3>{user.fullName || `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.login}</h3>
                <div className="user-card__badges">
                  <Badge size="small" variant="secondary">{roleLabels[user.role] || user.role}</Badge>
                  <Badge size="small" variant={user.status === 'active' ? 'success' : 'danger'}>
                    {user.status === 'active' ? 'Активен' : 'Неактивен'}
                  </Badge>
                </div>
              </div>
              <p className="user-card__meta">
                {user.login} · {user.email || 'email не указан'} ·{' '}
                {user.role === 'student' ? `Группа: ${user.group || '—'}` : user.role === 'teacher' ? `Кафедра: ${user.department || '—'}` : 'Администратор системы'} ·{' '}
                Последний вход: {user.lastLogin ? new Date(user.lastLogin).toLocaleString('ru-RU') : '—'}
              </p>
              <div className="user-card__actions">
                <Button size="small" variant="secondary" onClick={() => handleEdit(user)}>
                  Изменить
                </Button>
                <Button
                  size="small"
                  variant="danger"
                  onClick={() => handleDelete(user)}
                  disabled={user.role === 'admin'}
                >
                  Удалить
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Pagination
        className="user-management__pagination"
        currentPage={paginationMeta.currentPage}
        lastPage={paginationMeta.lastPage}
        total={paginationMeta.total}
        fallbackCount={users.length}
        onPrev={() => setFilterState((prev) => prevAdminFilterPage(prev, paginationMeta.currentPage))}
        onNext={() => setFilterState((prev) => nextAdminFilterPage(prev, paginationMeta.currentPage))}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Удаление пользователя"
        message={userToDelete ? `Удалить пользователя ${userToDelete.fullName}?` : ''}
        confirmText="Удалить"
        cancelText="Отмена"
        danger={true}
      />
    </div>
  );
};

export default UserManagement;
