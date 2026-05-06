import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from '../Button/Button';
import TextArea from '../TextArea/TextArea';
import './InputModal.scss';

const InputModal = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  multiline = false,
  rows = 3
}) => {
  const [value, setValue] = useState(defaultValue);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setSubmitting(false);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      if (onSubmit) {
        await Promise.resolve(onSubmit(value));
      }
    } finally {
      setSubmitting(false);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      if (!submitting) {
        void handleSubmit();
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="medium">
      <div className="input-modal">
        {message && <p className="input-modal__message">{message}</p>}
        <div className="input-modal__input">
          {multiline ? (
            <TextArea
              value={value}
              onChange={setValue}
              placeholder={placeholder}
              rows={rows}
              className="input-modal__textarea"
            />
          ) : (
            <input
              type="text"
              className="input-modal__input-field"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          )}
        </div>
        <div className="input-modal__actions">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting} disabled={submitting}>
            Подтвердить
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default InputModal;

