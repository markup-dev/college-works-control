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

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(value);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Подтвердить
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default InputModal;

