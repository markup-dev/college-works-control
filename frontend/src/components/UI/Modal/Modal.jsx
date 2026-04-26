import React from 'react';
import { createPortal } from 'react-dom';
import './Modal.scss';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'medium',
  className = '' 
}) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return createPortal(
    (
      <div className="modal-overlay" onClick={onClose}>
        <div 
          className={`modal modal--${size} ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal__header">
            <h2 className="modal__title">{title}</h2>
            <button type="button" className="modal__close" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="modal__content">
            {children}
          </div>
        </div>
      </div>
    ),
    document.body,
  );
};

export default Modal;