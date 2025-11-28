import React from 'react';
import './Badge.scss';

const Badge = ({ 
  children, 
  variant = 'default',
  size = 'medium',
  className = '',
  ...props 
}) => {
  return (
    <span 
      className={`badge badge--${variant} badge--${size} ${className}`} 
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;