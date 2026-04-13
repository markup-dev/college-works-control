import React from 'react';
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal modal--${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal__content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;