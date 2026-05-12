import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import {
  caretAfterNthDigit,
  countDigitsBeforeCaret,
  formatRuPhoneDisplay,
  isPhoneCompleteOrEmpty,
} from '../../../utils/ruPhoneMask';
import Button from '../../UI/Button/Button';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import './AdminEditUserModal.scss';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Студент' },
  { value: 'teacher', label: 'Преподаватель' },
  { value: 'admin', label: 'Администратор' },
];

const rowToForm = (row) => {
  if (!row) {
    return {
      login: '',
      lastName: '',
      firstName: '',
      middleName: '',
      email: '',
      phone: '',
      role: 'student',
      groupId: '',
      department: '',
      isActive: true,
    };
  }
  const gid =
    row.groupId != null
      ? String(row.groupId)
      : row.studentGroup?.id != null
        ? String(row.studentGroup.id)
        : '';
  const rawPhone = row.phone ? String(row.phone) : '';
  return {
    login: row.login || '',
    lastName: row.lastName || '',
    firstName: row.firstName || '',
    middleName: row.middleName || '',
    email: row.email || '',
    phone: rawPhone ? formatRuPhoneDisplay(rawPhone.replace(/\D/g, '')) : '',
    role: row.role || 'student',
    groupId: gid,
    department: row.department || '',
    isActive: row.isActive !== false,
  };
};

const AdminEditUserModal = ({ isOpen, onClose, userRow, groups = [], onSaved, currentUserId = null }) => {
  const [form, setForm] = useState(() => rowToForm(null));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const phoneCaretDigits = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(rowToForm(userRow));
    setSubmitting(false);
    setErrorMessage(null);
    phoneCaretDigits.current = null;
  }, [isOpen, userRow]);

  useLayoutEffect(() => {
    if (phoneCaretDigits.current == null) return;
    const el = document.getElementById('admin-edit-phone');
    if (!el) {
      phoneCaretDigits.current = null;
      return;
    }
    const pos = caretAfterNthDigit(form.phone, phoneCaretDigits.current);
    el.setSelectionRange(pos, pos);
    phoneCaretDigits.current = null;
  }, [form.phone]);

  const groupRequired = form.role === 'student';
  const isEditingSelf = userRow != null && currentUserId != null && Number(userRow.id) === Number(currentUserId);

  const canSubmit = useMemo(() => {
    if (!form.lastName.trim() || !form.firstName.trim()) return false;
    if (!form.email.trim()) return false;
    if (groupRequired && !form.groupId) return false;
    return true;
  }, [form.lastName, form.firstName, form.email, form.groupId, groupRequired]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhoneChange = (e) => {
    const el = e.target;
    const selStart = el.selectionStart ?? el.value.length;
    phoneCaretDigits.current = countDigitsBeforeCaret(el.value, selStart);
    const masked = formatRuPhoneDisplay(el.value);
    setField('phone', masked);
  };

  const handlePhoneBlur = () => {
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 11) {
      setField('phone', '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || submitting || !userRow) return;

    if (!isPhoneCompleteOrEmpty(form.phone)) {
      setErrorMessage('Укажите телефон полностью или оставьте поле пустым.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (isEditingSelf && form.isActive === false) {
        setErrorMessage('Нельзя заблокировать собственную учётную запись.');
        return;
      }
      const body = {
        lastName: form.lastName.trim(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        email: form.email.trim(),
        phone: (() => {
          const p = form.phone.trim();
          if (!p || !p.replace(/\D/g, '')) return undefined;
          return p;
        })(),
        role: form.role,
        isActive: form.isActive,
      };
      if (form.role === 'student') {
        body.department = null;
      } else {
        body.department = form.department.trim() || null;
      }
      if (groupRequired && form.groupId) {
        body.groupId = Number(form.groupId);
      } else if (form.role !== 'student') {
        body.groupId = null;
      }

      const { data } = await api.put(`/admin/users/${userRow.id}`, body);
      onSaved?.(data?.user);
      onClose();
    } catch (err) {
      const msg = firstApiErrorMessage(err.response?.data) || 'Не удалось сохранить изменения';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !userRow) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Редактирование пользователя"
      subtitle={[form.lastName, form.firstName].filter(Boolean).join(' ') || 'Пользователь'}
      size="large"
      className="admin-edit-user-modal"
      contentClassName="admin-edit-user-modal__body"
      footer={(
        <div className="admin-edit-user-modal__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="admin-edit-user-form"
            variant="primary"
            loading={submitting}
            disabled={!canSubmit || submitting}
          >
            Сохранить
          </Button>
        </div>
      )}
    >
          <form id="admin-edit-user-form" onSubmit={handleSubmit} noValidate>
              {errorMessage && (
                <div className="admin-edit-user-modal__error" role="alert">
                  <span className="admin-edit-user-modal__error-icon">!</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              <ModalSection title="Данные пользователя">
              <div className="admin-edit-user-modal__grid">
                <div className="admin-edit-user-modal__field">
                  <label className="admin-edit-user-modal__label" htmlFor="admin-edit-last-name">
                    Фамилия <span className="admin-edit-user-modal__required">*</span>
                  </label>
                  <input
                    id="admin-edit-last-name"
                    type="text"
                    className="admin-edit-user-modal__input"
                    value={form.lastName}
                    onChange={(e) => setField('lastName', e.target.value)}
                    placeholder="Введите фамилию"
                    required
                  />
                </div>

                <div className="admin-edit-user-modal__field">
                  <label className="admin-edit-user-modal__label" htmlFor="admin-edit-first-name">
                    Имя <span className="admin-edit-user-modal__required">*</span>
                  </label>
                  <input
                    id="admin-edit-first-name"
                    type="text"
                    className="admin-edit-user-modal__input"
                    value={form.firstName}
                    onChange={(e) => setField('firstName', e.target.value)}
                    placeholder="Введите имя"
                    required
                  />
                </div>

                <div className="admin-edit-user-modal__field">
                  <label className="admin-edit-user-modal__label" htmlFor="admin-edit-middle-name">
                    Отчество
                  </label>
                  <input
                    id="admin-edit-middle-name"
                    type="text"
                    className="admin-edit-user-modal__input"
                    value={form.middleName}
                    onChange={(e) => setField('middleName', e.target.value)}
                    placeholder="Введите отчество"
                  />
                </div>

                <div className="admin-edit-user-modal__field">
                  <label className="admin-edit-user-modal__label" htmlFor="admin-edit-email">
                    Email <span className="admin-edit-user-modal__required">*</span>
                  </label>
                  <input
                    id="admin-edit-email"
                    type="email"
                    className="admin-edit-user-modal__input"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="example@mail.ru"
                    required
                  />
                </div>

                <div className="admin-edit-user-modal__field">
                  <label className="admin-edit-user-modal__label" htmlFor="admin-edit-phone">
                    Телефон
                  </label>
                  <input
                    id="admin-edit-phone"
                    type="tel"
                    inputMode="tel"
                    className="admin-edit-user-modal__input"
                    value={form.phone}
                    onChange={handlePhoneChange}
                    onBlur={handlePhoneBlur}
                    placeholder="+7 (___) ___-__-__"
                  />
                </div>
              </div>
              </ModalSection>

              <ModalSection title="Параметры доступа" variant="soft">
              <div className="admin-edit-user-modal__grid">
                <div className="admin-edit-user-modal__field">
                  <label className="admin-edit-user-modal__label" htmlFor="admin-edit-login-label">
                    Логин
                  </label>
                  <div className="admin-edit-user-modal__readonly" id="admin-edit-login">
                    {form.login || '—'}
                  </div>
                  <div className="admin-edit-user-modal__hint-text">Задаётся при создании, не меняется</div>
                </div>

                <div className="admin-edit-user-modal__field">
                  <label className="admin-edit-user-modal__label" htmlFor="admin-edit-role">
                    Роль <span className="admin-edit-user-modal__required">*</span>
                  </label>
                  <select
                    id="admin-edit-role"
                    className="admin-edit-user-modal__select"
                    value={form.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        role,
                        groupId: role === 'student' ? prev.groupId : '',
                        department: role === 'student' ? '' : prev.department,
                      }));
                    }}
                    required
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {groupRequired ? (
                  <div className="admin-edit-user-modal__field">
                    <label className="admin-edit-user-modal__label" htmlFor="admin-edit-group">
                      Группа <span className="admin-edit-user-modal__required">*</span>
                    </label>
                    <select
                      id="admin-edit-group"
                      className="admin-edit-user-modal__select"
                      value={form.groupId}
                      onChange={(e) => setField('groupId', e.target.value)}
                      required
                    >
                      <option value="">Выберите группу</option>
                      {groups.map((g) => (
                        <option key={g.id} value={String(g.id)}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="admin-edit-user-modal__field">
                    <label className="admin-edit-user-modal__label" htmlFor="admin-edit-department">
                      Кафедра
                    </label>
                    <input
                      id="admin-edit-department"
                      type="text"
                      className="admin-edit-user-modal__input"
                      value={form.department}
                      onChange={(e) => setField('department', e.target.value)}
                      placeholder="Необязательно"
                    />
                  </div>
                )}

                <div className="admin-edit-user-modal__field admin-edit-user-modal__field--full">
                  <label className="admin-edit-user-modal__checkbox">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      disabled={isEditingSelf && !form.isActive}
                      onChange={(e) => setField('isActive', e.target.checked)}
                    />
                    <span>Аккаунт активен (не заблокирован)</span>
                  </label>
                  {isEditingSelf && form.isActive && (
                    <div className="admin-edit-user-modal__hint-text admin-edit-user-modal__hint-text--warning">
                      Собственную учётную запись нельзя заблокировать
                    </div>
                  )}
                </div>
              </div>
              </ModalSection>
          </form>
    </Modal>
  );
};

export default AdminEditUserModal;