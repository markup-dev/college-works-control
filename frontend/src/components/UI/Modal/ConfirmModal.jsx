import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from '../Button/Button';
import './ConfirmModal.scss';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  danger = false,
}) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setLoading(false);
  }, [isOpen]);

  const handleConfirm = async () => {
    if (loading) return;
    try {
      const ret = onConfirm?.();
      if (ret != null && typeof ret.then === 'function') {
        setLoading(true);
        await ret;
      }
      onClose();
    } catch {
      /* Ошибки обрабатывает вызывающий код (toast и т.д.). */
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <div className="confirm-modal">
        {message && <p className="confirm-modal__message">{message}</p>}
        <div className="confirm-modal__actions">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => void handleConfirm()}
            loading={loading}
            disabled={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
