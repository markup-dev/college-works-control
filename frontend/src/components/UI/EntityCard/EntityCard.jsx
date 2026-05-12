import React from 'react';
import Card from '../Card/Card';
import './EntityCard.scss';

const EntityCard = ({
  children,
  className = '',
  padding = 'medium',
  interactive = true,
  as = 'div',
  ...props
}) => (
  <Card
    as={as}
    className={`ui-entity-card${interactive ? ' ui-entity-card--interactive' : ''} ${className}`.trim()}
    padding={padding}
    shadow="small"
    bordered
    {...props}
  >
    {children}
  </Card>
);

export default EntityCard;
