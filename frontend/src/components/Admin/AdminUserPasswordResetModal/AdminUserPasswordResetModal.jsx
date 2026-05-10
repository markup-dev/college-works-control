import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import Modal from '../../UI/Modal/Modal';
import Button from '../../UI/Button/Button';
import '../AdminCreateUserModal/AdminCreateUserModal.scss';

const AdminUserPasswordResetModal = ({ isOpen, onClose, userRow, variant = 'reset', onSuccess }) => {
  const isResend = variant === 'resend';
  const [sendCredentials, setSendCredentials] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setSendCredentials(true);
    setSubmitting(false);
    setErrorMessage(null);
  }, [isOpen, variant]);

  const handleSubmit = async () => {
    if (!userRow?.id) return;
    if (isResend && !String(userRow.email || '').trim()) {
      setErrorMessage('У пользователя не указан email.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const { data } = await api.post(`/admin/users/${userRow.id}/reset-credentials`, {
        sendCredentials: isResend ? true : sendCredentials,
      });
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setErrorMessage(firstApiErrorMessage(err.response?.data) || 'Не удалось выполнить операцию');
    } finally {
      setSubmitting(false);
    }
  };

  const title = isResend ? 'Повторная отправка доступа' : 'Сброс пароля';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="medium">
      <div className="admin-create-user">
        {errorMessage && (
          <p className="admin-create-user__error" role="alert">
            {errorMessage}
          </p>
        )}
        <p className="admin-create-user__hint" style={{ marginBottom: '0.5rem' }}>
          {isResend
            ? `Будет сгенерирован новый временный пароль и отправлен на ${userRow?.email || 'email'}. После операции покажем пароль на экране.`
            : 'Будет создан новый временный пароль. Пользователю потребуется сменить его при следующем входе. После операции вы сможете скопировать пароль.'}
        </p>

        {!isResend && (
          <label className="admin-create-user__checkbox-row">
            <input
              type="checkbox"
              checked={sendCredentials}
              onChange={(e) => setSendCredentials(e.target.checked)}
              disabled={!String(userRow?.email || '').trim()}
            />
            <span>Отправить логин и пароль на email</span>
          </label>
        )}
        {!isResend && !String(userRow?.email || '').trim() ? (
          <p className="admin-create-user__hint">У пользователя нет email — письмо отправить нельзя; пароль будет только на экране.</p>
        ) : null}

        <div className="admin-create-user__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="button" variant="primary" loading={submitting} disabled={submitting} onClick={() => void handleSubmit()}>
            Продолжить
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AdminUserPasswordResetModal;
