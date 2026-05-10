import React from 'react';
import Modal from '../../UI/Modal/Modal';
import Button from '../../UI/Button/Button';
import './AdminUserViewModal.scss';

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

const groupLine = (row) => {
  if (row.role === 'teacher') {
    const list = row.teacherGroups;
    if (Array.isArray(list) && list.length) return list.join(', ');
    return '—';
  }
  if (row.role === 'student') {
    return row.studentGroup?.name || 'Без группы';
  }
  return '—';
};

const formatWhen = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusPresentation = (row) => {
  if (!row.isActive) {
    return { label: 'Заблокирован', tone: 'blocked' };
  }
  if (row.mustChangePassword) {
    return { label: 'Требуется смена пароля', tone: 'password' };
  }
  return { label: 'Активен', tone: 'active' };
};

const AdminUserViewModal = ({ isOpen, onClose, user: row }) => {
  if (!isOpen || !row) return null;

  const showDepartment = row.role === 'teacher' || row.role === 'admin';
  const st = statusPresentation(row);
  const dept = row.department?.trim();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Профиль пользователя" size="medium">
      <div className="admin-user-view">
        <div className="admin-user-view__grid">
          <div className="admin-user-view__field admin-user-view__field--full">
            <span className="admin-user-view__label">Логин</span>
            <span className="admin-user-view__value">{row.login || '—'}</span>
          </div>

          <div className="admin-user-view__field">
            <span className="admin-user-view__label">Фамилия</span>
            <span className="admin-user-view__value">{row.lastName || '—'}</span>
          </div>
          <div className="admin-user-view__field">
            <span className="admin-user-view__label">Имя</span>
            <span className="admin-user-view__value">{row.firstName || '—'}</span>
          </div>

          <div className="admin-user-view__field admin-user-view__field--full">
            <span className="admin-user-view__label">Отчество</span>
            <span className={`admin-user-view__value ${!row.middleName?.trim() ? 'admin-user-view__value--muted' : ''}`}>
              {row.middleName?.trim() || '—'}
            </span>
          </div>

          <div className="admin-user-view__field">
            <span className="admin-user-view__label">Роль</span>
            <span className="admin-user-view__value">{roleLabel(row.role)}</span>
          </div>
          <div className="admin-user-view__field">
            <span className="admin-user-view__label">Статус</span>
            <div className={`admin-user-view__status admin-user-view__status--${st.tone}`}>
              <span className="admin-user-view__status-dot" aria-hidden />
              <span>{st.label}</span>
            </div>
          </div>

          <div className="admin-user-view__field admin-user-view__field--full">
            <span className="admin-user-view__label">Группа</span>
            <span className="admin-user-view__value">{groupLine(row)}</span>
          </div>

          <div className="admin-user-view__field">
            <span className="admin-user-view__label">Email</span>
            <span className="admin-user-view__value">{row.email || '—'}</span>
          </div>
          <div className="admin-user-view__field">
            <span className="admin-user-view__label">Телефон</span>
            <span className={`admin-user-view__value ${!row.phone?.trim() ? 'admin-user-view__value--muted' : ''}`}>
              {row.phone?.trim() || '—'}
            </span>
          </div>

          {showDepartment && (
            <div className="admin-user-view__field admin-user-view__field--full">
              <span className="admin-user-view__label">Подразделение</span>
              <span className={`admin-user-view__value ${!dept ? 'admin-user-view__value--muted' : ''}`}>
                {dept || '—'}
              </span>
            </div>
          )}

          <div className="admin-user-view__field admin-user-view__field--full">
            <span className="admin-user-view__label">Последний вход</span>
            <span className={`admin-user-view__value ${!row.lastLogin ? 'admin-user-view__value--muted' : ''}`}>
              {formatWhen(row.lastLogin)}
            </span>
          </div>
        </div>

        <div className="admin-user-view__actions">
          <Button type="button" variant="primary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AdminUserViewModal;
