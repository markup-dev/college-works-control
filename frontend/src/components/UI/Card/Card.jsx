import React from 'react';
import './Card.scss';

const Card = ({ 
  children, 
  className = '',
  padding = 'medium',
  hoverable = false,
  bordered = true,
  shadow = 'medium',
  ...props 
}) => {
  return (
    <div 
      className={`
        card 
        card--${padding} 
        ${hoverable ? 'card--hoverable' : ''}
        ${bordered ? 'card--bordered' : ''}
        card--shadow-${shadow}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;