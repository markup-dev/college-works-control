import React from 'react';
import './Button.scss';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  icon = null,
  fullWidth = false,
  className = '',
  ...props 
}) => {
  return (
    <button
      type={type}
      className={`
        btn 
        btn--${variant} 
        btn--${size} 
        ${loading ? 'btn--loading' : ''}
        ${fullWidth ? 'btn--full-width' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <div className="btn__spinner"></div>}
      {icon && !loading && <span className="btn__icon">{icon}</span>}
      <span className="btn__text">{children}</span>
    </button>
  );
};

export default Button;