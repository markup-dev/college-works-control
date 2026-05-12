import React from 'react';
import './Card.scss';

const Card = ({ 
  children, 
  className = '',
  padding = 'medium',
  hoverable = false,
  bordered = true,
  shadow = 'medium',
  as: Component = 'div',
  ...props 
}) => {
  return (
    <Component
      className={`
        ui-card
        ui-card--${padding}
        ${hoverable ? 'ui-card--hoverable' : ''}
        ${bordered ? 'ui-card--bordered' : ''}
        ui-card--shadow-${shadow}
        ${className}
      `}
      {...props}
    >
      {children}
    </Component>
  );
};

export default Card;