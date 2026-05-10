import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import {
  caretAfterNthDigit,
  countDigitsBeforeCaret,
  formatRuPhoneDisplay,
  isPhoneCompleteOrEmpty,
} from '../../../utils/ruPhoneMask';
import Modal from '../../UI/Modal/Modal';
import Button from '../../UI/Button/Button';
import '../AdminCreateUserModal/AdminCreateUserModal.scss';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Студент' },
  { value: 'teacher', label: 'Преподаватель' },
  { value: 'admin', label: 'Администратор' },
];

const Label = ({ htmlFor, required, children }) => (
  <label className="admin-create-user__label" htmlFor={htmlFor}>
    {children}
    {required ? (
      <span className="admin-create-user__required" aria-hidden="true">
        *
      </span>
    ) : null}
  </label>
);

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

const AdminEditUserModal = ({ isOpen, onClose, userRow, groups = [], onSaved }) => {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Редактирование пользователя" size="large">
      <form className="admin-create-user" onSubmit={handleSubmit} noValidate>
        {errorMessage && (
          <p className="admin-create-user__error" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="admin-create-user__grid">
          <div className="admin-create-user__field">
            <Label htmlFor="admin-edit-last-name" required>
              Фамилия
            </Label>
            <input
              id="admin-edit-last-name"
              className="admin-create-user__input"
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              aria-required
              required
            />
          </div>
          <div className="admin-create-user__field">
            <Label htmlFor="admin-edit-first-name" required>
              Имя
            </Label>
            <input
              id="admin-edit-first-name"
              className="admin-create-user__input"
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              aria-required
              required
            />
          </div>
          <div className="admin-create-user__field">
            <Label htmlFor="admin-edit-middle-name">Отчество</Label>
            <input
              id="admin-edit-middle-name"
              className="admin-create-user__input"
              value={form.middleName}
              onChange={(e) => setField('middleName', e.target.value)}
            />
          </div>
          <div className="admin-create-user__field">
            <Label htmlFor="admin-edit-email" required>
              Email
            </Label>
            <input
              id="admin-edit-email"
              type="email"
              className="admin-create-user__input"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              aria-required
              required
            />
          </div>
          <div className="admin-create-user__field">
            <span className="admin-create-user__label" id="admin-edit-login-label">
              Логин
            </span>
            <div
              id="admin-edit-login"
              className="admin-create-user__readonly-value"
              aria-labelledby="admin-edit-login-label"
            >
              {form.login || '—'}
            </div>
            <p className="admin-create-user__hint admin-create-user__hint--compact">
              Задаётся при создании, не меняется.
            </p>
          </div>
          <div className="admin-create-user__field">
            <Label htmlFor="admin-edit-phone">Телефон</Label>
            <input
              id="admin-edit-phone"
              type="tel"
              inputMode="tel"
              className="admin-create-user__input"
              value={form.phone}
              onChange={handlePhoneChange}
              onBlur={handlePhoneBlur}
              placeholder="8 (___) ___-__-__ или +7 (___) ___-__-__"
              autoComplete="tel"
            />
          </div>
          <div className="admin-create-user__field">
            <Label htmlFor="admin-edit-role" required>
              Роль
            </Label>
            <select
              id="admin-edit-role"
              className="admin-create-user__select"
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
              aria-required
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {groupRequired ? (
            <div className="admin-create-user__field">
              <Label htmlFor="admin-edit-group" required>
                Группа
              </Label>
              <select
                id="admin-edit-group"
                className="admin-create-user__select"
                value={form.groupId}
                onChange={(e) => setField('groupId', e.target.value)}
                aria-required
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
            <div className="admin-create-user__field">
              <Label htmlFor="admin-edit-department">Подразделение</Label>
              <input
                id="admin-edit-department"
                className="admin-create-user__input"
                value={form.department}
                onChange={(e) => setField('department', e.target.value)}
                placeholder="Необязательно"
                autoComplete="organization"
              />
            </div>
          )}
          <div className="admin-create-user__field admin-create-user__field--full">
            <label className="admin-create-user__checkbox-row">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
              />
              <span>Аккаунт активен (не заблокирован)</span>
            </label>
          </div>
        </div>

        <div className="admin-create-user__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit || submitting}>
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminEditUserModal;
