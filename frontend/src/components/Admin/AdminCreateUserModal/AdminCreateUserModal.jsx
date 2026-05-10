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
import './AdminCreateUserModal.scss';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Студент' },
  { value: 'teacher', label: 'Преподаватель' },
  { value: 'admin', label: 'Администратор' },
];

const emptyForm = () => ({
  lastName: '',
  firstName: '',
  middleName: '',
  email: '',
  phone: '',
  role: 'student',
  groupId: '',
  sendCredentials: true,
});

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

const AdminCreateUserModal = ({ isOpen, onClose, groups = [], onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const phoneCaretDigits = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyForm());
    setSubmitting(false);
    setErrorMessage(null);
    phoneCaretDigits.current = null;
  }, [isOpen]);

  useLayoutEffect(() => {
    if (phoneCaretDigits.current == null) return;
    const el = document.getElementById('admin-create-phone');
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
    if (!canSubmit || submitting) return;

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
        sendCredentials: form.sendCredentials,
      };
      if (groupRequired && form.groupId) {
        body.groupId = Number(form.groupId);
      }
      const { data } = await api.post('/admin/users', body);
      if (onCreated) {
        onCreated({
          user: data?.user,
          plainPassword: data?.plainPassword,
          credentialsSent: data?.credentialsSent,
        });
      }
      onClose();
    } catch (err) {
      const msg = firstApiErrorMessage(err.response?.data) || 'Не удалось создать пользователя';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Новый пользователь" size="large">
      <form className="admin-create-user" onSubmit={handleSubmit} noValidate>
        {errorMessage && (
          <p className="admin-create-user__error" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="admin-create-user__grid">
          <div className="admin-create-user__field">
            <Label htmlFor="admin-create-last-name" required>
              Фамилия
            </Label>
            <input
              id="admin-create-last-name"
              className="admin-create-user__input"
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              autoComplete="family-name"
              aria-required
              required
            />
          </div>
          <div className="admin-create-user__field">
            <Label htmlFor="admin-create-first-name" required>
              Имя
            </Label>
            <input
              id="admin-create-first-name"
              className="admin-create-user__input"
              value={form.firstName}
              onChange={(e) => setField('firstName', e.target.value)}
              autoComplete="given-name"
              aria-required
              required
            />
          </div>
          <div className="admin-create-user__field">
            <Label htmlFor="admin-create-middle-name">Отчество</Label>
            <input
              id="admin-create-middle-name"
              className="admin-create-user__input"
              value={form.middleName}
              onChange={(e) => setField('middleName', e.target.value)}
              autoComplete="additional-name"
            />
          </div>
          <div className="admin-create-user__field">
            <Label htmlFor="admin-create-email" required>
              Email
            </Label>
            <input
              id="admin-create-email"
              type="email"
              className="admin-create-user__input"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              autoComplete="email"
              aria-required
              required
            />
          </div>
          <div className="admin-create-user__field">
            <Label htmlFor="admin-create-phone">Телефон</Label>
            <input
              id="admin-create-phone"
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
            <Label htmlFor="admin-create-role" required>
              Роль
            </Label>
            <select
              id="admin-create-role"
              className="admin-create-user__select"
              value={form.role}
              onChange={(e) => {
                const role = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  role,
                  groupId: role === 'student' ? prev.groupId : '',
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
          {groupRequired && (
            <div className="admin-create-user__field">
              <Label htmlFor="admin-create-group" required>
                Группа
              </Label>
              <select
                id="admin-create-group"
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
          )}
        </div>

        <label className="admin-create-user__checkbox-row">
          <input
            type="checkbox"
            checked={form.sendCredentials}
            onChange={(e) => setField('sendCredentials', e.target.checked)}
          />
          <span>Отправить логин и пароль на email</span>
        </label>

        <p className="admin-create-user__hint">
          Логин формируется автоматически из имени и фамилии. Пароль будет сгенерирован; пользователю может
          потребоваться смена пароля при первом входе.
        </p>

        <div className="admin-create-user__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit || submitting}>
            Создать
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminCreateUserModal;
