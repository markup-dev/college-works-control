import React, { useEffect } from 'react';
import './Toast.scss';

const Toast = ({ id, message, type = 'info', duration = 5000, onClose }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  return (
    <div className={`toast toast--${type}`} onClick={() => onClose(id)}>
      <div className="toast__icon">{icons[type] || icons.info}</div>
      <div className="toast__message">{message}</div>
      <button className="toast__close" onClick={(e) => {
        e.stopPropagation();
        onClose(id);
      }}>×</button>
    </div>
  );
};

export default Toast;

