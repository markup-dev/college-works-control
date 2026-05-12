import React from 'react';
import EntityCard from '../EntityCard/EntityCard';

const InfoCard = ({
  children,
  className = '',
  padding = 'medium',
  ...props
}) => (
  <EntityCard
    className={`ui-info-card ${className}`.trim()}
    padding={padding}
    interactive={false}
    {...props}
  >
    {children}
  </EntityCard>
);

export default InfoCard;
