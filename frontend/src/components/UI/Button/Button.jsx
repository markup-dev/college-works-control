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
        ui-button
        ui-button--${variant}
        ui-button--${size}
        ${loading ? 'ui-button--loading' : ''}
        ${fullWidth ? 'ui-button--full-width' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <div className="ui-button__spinner"></div>}
      {icon && !loading && <span className="ui-button__icon">{icon}</span>}
      <span className="ui-button__text">{children}</span>
    </button>
  );
};

export default Button;