import React from 'react';
import Modal from '../../UI/Modal/Modal';
import Button from '../../UI/Button/Button';
import { useNotification } from '../../../context/NotificationContext';
import './AdminUserCredentialsModal.scss';

const copyToClipboard = async (text) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
};

const AdminUserCredentialsModal = ({ isOpen, onClose, login, plainPassword, credentialsSent }) => {
  const { showSuccess, showError } = useNotification();

  const onCopy = async (label, value) => {
    const ok = await copyToClipboard(value);
    if (ok) showSuccess(`${label} скопирован`);
    else showError('Не удалось скопировать');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Учётные данные" size="medium">
      <div className="admin-user-credentials">
        {credentialsSent ? (
          <p className="admin-user-credentials__note admin-user-credentials__note--ok">
            Письмо с логином и паролем отправлено на указанный email (если отправка почты настроена на сервере).
          </p>
        ) : (
          <p className="admin-user-credentials__note admin-user-credentials__note--muted">
            Отправка на почту отключена при создании или email недоступен. Сохраните данные и передайте их пользователю
            вручную.
          </p>
        )}

        <div className="admin-user-credentials__row">
          <span className="admin-user-credentials__label">Логин</span>
          <div className="admin-user-credentials__value-row">
            <span className="admin-user-credentials__value">{login || '—'}</span>
            <Button
              type="button"
              size="small"
              variant="outline"
              onClick={() => onCopy('Логин', login)}
              disabled={!login}
            >
              Копировать
            </Button>
          </div>
        </div>

        <div className="admin-user-credentials__row">
          <span className="admin-user-credentials__label">Временный пароль</span>
          <div className="admin-user-credentials__value-row">
            <span className="admin-user-credentials__value">{plainPassword || '—'}</span>
            <Button
              type="button"
              size="small"
              variant="outline"
              onClick={() => onCopy('Пароль', plainPassword)}
              disabled={!plainPassword}
            >
              Копировать
            </Button>
          </div>
        </div>

        <p className="admin-user-credentials__note">
          Рекомендуется сменить пароль после первого входа. Не храните пароль в открытом виде дольше необходимого.
        </p>

        <div className="admin-user-credentials__actions">
          <Button type="button" variant="primary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AdminUserCredentialsModal;
