import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import Button from '../../UI/Button/Button';
import './AdminUserPasswordResetModal.scss';

const AdminUserPasswordResetModal = ({ isOpen, onClose, userRow, onSuccess }) => {
  const [sendCredentials, setSendCredentials] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setSendCredentials(true);
    setSubmitting(false);
    setErrorMessage(null);
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!userRow?.id) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const { data } = await api.post(`/admin/users/${userRow.id}/reset-credentials`, {
        sendCredentials,
      });
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setErrorMessage(firstApiErrorMessage(err.response?.data) || 'Не удалось выполнить операцию');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Сброс пароля"
      size="medium"
      contentClassName="admin-user-password-reset-modal"
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="button" variant="primary" loading={submitting} disabled={submitting} onClick={() => void handleSubmit()}>
            Продолжить
          </Button>
        </>
      )}
    >
        {errorMessage && (
          <p className="admin-user-password-reset-modal__error" role="alert">
            {errorMessage}
          </p>
        )}
        <ModalSection title="Что произойдёт" variant="soft">
          <p className="admin-user-password-reset-modal__notice-text">
            Будет создан новый временный пароль. Пользователю потребуется сменить его при следующем входе.
          </p>
          <p className="admin-user-password-reset-modal__notice-text">
            После операции пароль можно скопировать из окна с учётными данными.
          </p>
        </ModalSection>

        <ModalSection title="Отправка данных">
          <label className="admin-user-password-reset-modal__checkbox-row">
            <input
              type="checkbox"
              checked={sendCredentials}
              onChange={(e) => setSendCredentials(e.target.checked)}
              disabled={!String(userRow?.email || '').trim()}
            />
            <span>Также отправить логин и пароль на email пользователя</span>
          </label>
          {!String(userRow?.email || '').trim() ? (
            <p className="admin-user-password-reset-modal__hint">У пользователя не указан email — письмо отправить нельзя.</p>
          ) : null}
        </ModalSection>
    </Modal>
  );
};

export default AdminUserPasswordResetModal;
