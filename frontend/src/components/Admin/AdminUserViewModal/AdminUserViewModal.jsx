import React from 'react';
import { formatDateRelative, formatDateTime } from '../../../utils/dateHelpers';
import Button from '../../UI/Button/Button';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
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

const roleVariant = (role) => {
  switch (role) {
    case 'student':
      return 'student';
    case 'teacher':
      return 'teacher';
    case 'admin':
      return 'admin';
    default:
      return 'default';
  }
};

const thirdKeyField = (row) => {
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

const statusPresentation = (row) => {
  if (!row.isActive) {
    return { label: 'Заблокирован', tone: 'blocked', description: 'Доступ к системе запрещён' };
  }
  if (row.mustChangePassword) {
    return { label: 'Требуется смена пароля', tone: 'password', description: 'Пользователь должен сменить пароль при следующем входе' };
  }
  return { label: 'Активен', tone: 'active', description: 'Полный доступ к системе' };
};

const AdminUserViewModal = ({
  isOpen,
  onClose,
  user: row,
  currentUserId,
  onEdit,
  onResetPassword,
  onToggleBlock,
  onDelete,
}) => {
  if (!isOpen || !row) return null;

  const st = statusPresentation(row);
  const canDelete = currentUserId == null || Number(row.id) !== Number(currentUserId);
  const isSelf = currentUserId != null && Number(row.id) === Number(currentUserId);
  const showBlockToggle = !isSelf || row.isActive === false;
  const keyThird = thirdKeyField(row);
  const relativeLastLogin = formatDateRelative(row.lastLogin);
  const fullName = [row.lastName, row.firstName, row.middleName].filter(Boolean).join(' ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Профиль пользователя"
      size="large"
      className="admin-user-view-modal"
      contentClassName="admin-user-view-modal__body"
      footer={(
        <div className="admin-user-view-modal__actions">
          <div className="admin-user-view-modal__actions-primary">
            <Button type="button" variant="primary" size="small" onClick={onEdit}>
              Редактировать
            </Button>
            <Button type="button" variant="outline" size="small" onClick={onResetPassword}>
              Сбросить пароль
            </Button>
          </div>
          <div className="admin-user-view-modal__actions-danger">
            {showBlockToggle && (
              <Button
                type="button"
                variant="warning"
                size="small"
                onClick={onToggleBlock}
              >
                {row.isActive ? 'Заблокировать' : 'Разблокировать'}
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="danger"
                size="small"
                onClick={onDelete}
              >
                Удалить
              </Button>
            )}
          </div>
        </div>
      )}
    >
            {/* Шапка с аватаром и статусом */}
            <div className="profile-header">
              <div className="profile-header__avatar">
                {fullName.charAt(0) || row.login?.charAt(0) || '?'}
              </div>
              <div className="profile-header__info">
                <div className="profile-header__identity">
                  <h4>{fullName || row.login || 'Пользователь'}</h4>
                  <p>{row.email || row.login || '—'}</p>
                </div>
                <div className="profile-header__badges">
                  <div className={`role-badge role-badge--${roleVariant(row.role)}`}>
                    {roleLabel(row.role)}
                  </div>
                  <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                </div>
              </div>
            </div>

            {/* Статусная карточка с описанием */}
            <div className={`status-card status-card--${st.tone}`}>
              <div className="status-card__icon">
                {st.tone === 'active' && 'A'}
                {st.tone === 'password' && 'P'}
                {st.tone === 'blocked' && '!'}
              </div>
              <div className="status-card__content">
                <div className="status-card__title">{st.label}</div>
                <div className="status-card__description">{st.description}</div>
              </div>
            </div>

            {/* Три ключевых поля в ряд */}
            <div className={`key-fields${row.role === 'admin' ? ' key-fields--two' : ''}`}>
              <div className="key-field">
                <span className="key-field__label">Логин</span>
                <span className="key-field__value">{row.login || '—'}</span>
              </div>
              <div className="key-field">
                <span className="key-field__label">Роль</span>
                <span className="key-field__value">{roleLabel(row.role)}</span>
              </div>
              {keyThird && (
                <div className="key-field">
                  <span className="key-field__label">{keyThird.label}</span>
                  <span className="key-field__value">{keyThird.value}</span>
                </div>
              )}
            </div>

            <ModalSection title="Личные данные">
              <div className="info-grid">
                <div className="info-item">
                  <strong>Фамилия</strong>
                  <span>{row.lastName || '—'}</span>
                </div>
                <div className="info-item">
                  <strong>Имя</strong>
                  <span>{row.firstName || '—'}</span>
                </div>
                <div className="info-item">
                  <strong>Отчество</strong>
                  <span className={!row.middleName?.trim() ? 'muted' : ''}>
                    {row.middleName?.trim() || '—'}
                  </span>
                </div>
              </div>
            </ModalSection>

            <ModalSection title="Контакты">
              <div className="info-grid">
                <div className="info-item">
                  <strong>Email</strong>
                  <span>{row.email || '—'}</span>
                </div>
                <div className="info-item">
                  <strong>Телефон</strong>
                  <span className={!row.phone?.trim() ? 'muted' : ''}>
                    {row.phone?.trim() || '—'}
                  </span>
                </div>
              </div>
            </ModalSection>

            {/* Информация о последнем входе */}
            <div className="last-login">
              <div className="last-login__content">
                <span className="last-login__label">Последний вход</span>
                <span className="last-login__date">{formatDateTime(row.lastLogin)}</span>
                {relativeLastLogin && (
                  <span className="last-login__relative">({relativeLastLogin})</span>
                )}
              </div>
            </div>

            {/* Мета информация о создании */}
            {row.createdAt && (
              <div className="meta-info">
                <span>Создан: {formatDateTime(row.createdAt)}</span>
                {row.createdBy && <span>Создал: {row.createdBy}</span>}
              </div>
            )}
    </Modal>
  );
};

export default AdminUserViewModal;