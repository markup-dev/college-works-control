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
  danger = false,
  loading: externalLoading = false,
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading || internalLoading;

  useEffect(() => {
    if (isOpen) setInternalLoading(false);
  }, [isOpen]);

  const handleConfirm = async () => {
    if (loading) return;
    try {
      const ret = onConfirm?.();
      if (ret != null && typeof ret.then === 'function') {
        setInternalLoading(true);
        await ret;
      }
      onClose();
    } catch {
      /* Ошибки обрабатывает вызывающий код (toast и т.д.). */
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      closeDisabled={loading}
      footer={(
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => void handleConfirm()}
          loading={loading}
          disabled={loading}
        >
          {confirmText}
        </Button>
      )}
    >
      <div className="confirm-modal">
        {message && <p className="confirm-modal__message">{message}</p>}
      </div>
    </Modal>
  );
};

export default ConfirmModal;
