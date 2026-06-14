import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { formatDateRelative, formatDateTime } from '../../../utils/dateHelpers';
import { toSubjectSelectOptions } from '../../../utils/selectOptions';
import Button from '../../UI/Button/Button';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import Modal from '../../UI/Modal/Modal';
import ModalDangerZone from '../../UI/Modal/ModalDangerZone';
import ModalSection from '../../UI/Modal/ModalSection';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import SearchableSelect from '../../UI/SearchableSelect/SearchableSelect';
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
  const [teacherDisciplines, setTeacherDisciplines] = useState([]);
  const [disciplineOptions, setDisciplineOptions] = useState([]);
  const [newDisciplineId, setNewDisciplineId] = useState('');
  const [disciplineToRemove, setDisciplineToRemove] = useState(null);
  const [disciplineRemoveSubmitting, setDisciplineRemoveSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || row?.role !== 'teacher' || !row?.id) {
      setTeacherDisciplines([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [disciplinesRes, subjectsRes] = await Promise.all([
          api.get(`/admin/teachers/${row.id}/disciplines`),
          api.get('/admin/subjects', { params: { per_page: 100, sort: 'name_asc', status: 'active' } }),
        ]);
        if (cancelled) return;
        setTeacherDisciplines(Array.isArray(disciplinesRes.data?.data) ? disciplinesRes.data.data : []);
        setDisciplineOptions(Array.isArray(subjectsRes.data?.data) ? subjectsRes.data.data : []);
      } catch {
        if (!cancelled) {
          setTeacherDisciplines([]);
          setDisciplineOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, row?.id, row?.role]);

  const availableDisciplineOptions = useMemo(() => {
    const activeIds = new Set(
      teacherDisciplines
        .filter((item) => item.status === 'active')
        .map((item) => Number(item.subjectId ?? item.subject?.id)),
    );
    return toSubjectSelectOptions(
      disciplineOptions.filter((subject) => !activeIds.has(Number(subject.id))),
    );
  }, [disciplineOptions, teacherDisciplines]);

  const addTeacherDiscipline = async () => {
    if (!row?.id || !newDisciplineId) return;
    const { data } = await api.post(`/admin/teachers/${row.id}/disciplines`, { subjectId: Number(newDisciplineId) });
    const next = data?.teacherSubject || data?.teacher_subject;
    if (next) {
      setTeacherDisciplines((prev) => [...prev.filter((item) => Number(item.subjectId) !== Number(next.subjectId)), next]);
    }
    setNewDisciplineId('');
  };

  const submitRemoveTeacherDiscipline = async () => {
    if (!disciplineToRemove) return;
    setDisciplineRemoveSubmitting(true);
    try {
      await api.delete(`/admin/teacher-disciplines/${disciplineToRemove.id}`);
      setTeacherDisciplines((prev) => prev.map((rowItem) => (
        rowItem.id === disciplineToRemove.id ? { ...rowItem, status: 'inactive' } : rowItem
      )));
      setDisciplineToRemove(null);
    } finally {
      setDisciplineRemoveSubmitting(false);
    }
  };

  if (!isOpen || !row) {
    return (
      <ConfirmModal
        isOpen={Boolean(disciplineToRemove)}
        onClose={() => !disciplineRemoveSubmitting && setDisciplineToRemove(null)}
        onConfirm={submitRemoveTeacherDiscipline}
        title="Убрать допуск к дисциплине?"
        message={disciplineToRemove
          ? `Преподаватель потеряет допуск к дисциплине «${disciplineToRemove.subject?.name || 'Дисциплина'}». Существующие назначения и задания сохранятся.`
          : ''}
        confirmText="Убрать"
        danger
        loading={disciplineRemoveSubmitting}
      />
    );
  }

  const st = statusPresentation(row);
  const canDelete = currentUserId == null || Number(row.id) !== Number(currentUserId);
  const isSelf = currentUserId != null && Number(row.id) === Number(currentUserId);
  const teacherBlocked = row.role === 'teacher' && row.isActive === false;
  const showBlockToggle = !isSelf || row.isActive === false;
  const keyThird = thirdKeyField(row);
  const relativeLastLogin = formatDateRelative(row.lastLogin);
  const fullName = [row.lastName, row.firstName, row.middleName].filter(Boolean).join(' ');

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Профиль пользователя"
      size="large"
      className="admin-user-view-modal"
      contentClassName="admin-user-view-modal__body"
      footer={(
        <>
          <Button type="button" variant="primary" size="small" onClick={onEdit}>
            Редактировать
          </Button>
          <Button type="button" variant="outline" size="small" onClick={onResetPassword}>
            Сбросить пароль
          </Button>
        </>
      )}
    >
            {/* Шапка: ФИО и бейджи */}
            <div className="profile-header">
              <div className="profile-header__avatar">
                {fullName.charAt(0) || row.login?.charAt(0) || '?'}
              </div>
              <div className="profile-header__info">
                <div className="profile-header__identity">
                  <h4>{fullName || row.login || 'Пользователь'}</h4>
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

            {/* Роль и группа / кафедра */}
            <div
              className={`key-fields${
                row.role === 'admin' ? ' key-fields--one' : ' key-fields--two'
              }`}
            >
              <div className="key-field">
                <span className="key-field__label">Роль</span>
                <span className="key-field__value">{roleLabel(row.role)}</span>
              </div>
              {keyThird ? (
                <div className="key-field">
                  <span className="key-field__label">{keyThird.label}</span>
                  <span className="key-field__value">{keyThird.value}</span>
                </div>
              ) : null}
            </div>

            <ModalSection title="Личные данные">
              <div className="admin-user-view-modal__personal-grid">
                <div className="admin-user-view-modal__personal-cell">
                  <span className="admin-user-view-modal__personal-label">Фамилия</span>
                  <span className="admin-user-view-modal__personal-value">{row.lastName || '—'}</span>
                </div>
                <div className="admin-user-view-modal__personal-cell">
                  <span className="admin-user-view-modal__personal-label">Имя</span>
                  <span className="admin-user-view-modal__personal-value">{row.firstName || '—'}</span>
                </div>
                <div className="admin-user-view-modal__personal-cell">
                  <span className="admin-user-view-modal__personal-label">Отчество</span>
                  <span className={`admin-user-view-modal__personal-value${!row.middleName?.trim() ? ' admin-user-view-modal__personal-value--muted' : ''}`}>
                    {row.middleName?.trim() || '—'}
                  </span>
                </div>
                <div className="admin-user-view-modal__personal-cell">
                  <span className="admin-user-view-modal__personal-label">Логин</span>
                  <span className="admin-user-view-modal__personal-value">{row.login || '—'}</span>
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

            {row.role === 'teacher' && (
              <ModalSection title="Допуск к дисциплинам" variant="soft">
                {teacherBlocked && (
                  <p className="muted admin-user-view-modal__blocked-hint">
                    Преподаватель заблокирован — добавлять и убирать дисциплины нельзя. Существующие допуски сохранены для истории назначений.
                  </p>
                )}
                <div className="info-grid">
                  {teacherDisciplines.filter((item) => item.status === 'active').map((item) => (
                    <div key={item.id} className="info-item">
                      <strong>{item.subject?.name || 'Дисциплина'}</strong>
                      <span>{item.subject?.code || '—'}</span>
                      {!teacherBlocked && (
                        <Button type="button" size="small" variant="outline" onClick={() => setDisciplineToRemove(item)}>
                          Убрать
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {teacherDisciplines.filter((item) => item.status === 'active').length === 0 && (
                  <p className="muted">Активных дисциплин пока нет</p>
                )}
                {!teacherBlocked && (
                  <div className="admin-user-view-modal__inline-form">
                    <SearchableSelect
                      value={newDisciplineId}
                      onChange={setNewDisciplineId}
                      options={availableDisciplineOptions}
                      placeholder="Добавить дисциплину"
                      searchPlaceholder="Найти дисциплину…"
                      emptyMessage="Все дисциплины уже добавлены"
                      ariaLabel="Дисциплина для допуска"
                    />
                    <Button type="button" size="small" variant="primary" disabled={!newDisciplineId} onClick={() => void addTeacherDiscipline()}>
                      Добавить
                    </Button>
                  </div>
                )}
              </ModalSection>
            )}

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

            {(showBlockToggle || canDelete) && (
              <ModalDangerZone
                title="Доступ и удаление"
                description="Блокировка запрещает вход в систему. Удаление пользователя необратимо."
              >
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
                    Удалить пользователя
                  </Button>
                )}
              </ModalDangerZone>
            )}
    </Modal>

    <ConfirmModal
      isOpen={Boolean(disciplineToRemove)}
      onClose={() => !disciplineRemoveSubmitting && setDisciplineToRemove(null)}
      onConfirm={submitRemoveTeacherDiscipline}
      title="Убрать допуск к дисциплине?"
      message={disciplineToRemove
        ? `Преподаватель потеряет допуск к дисциплине «${disciplineToRemove.subject?.name || 'Дисциплина'}». Существующие назначения и задания сохранятся.`
        : ''}
      confirmText="Убрать"
      danger
      loading={disciplineRemoveSubmitting}
    />
    </>
  );
};

export default AdminUserViewModal;