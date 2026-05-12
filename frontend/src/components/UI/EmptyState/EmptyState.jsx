import React from 'react';
import Card from '../Card/Card';
import './EmptyState.scss';

const EmptyState = ({
  title,
  message = '',
  children = null,
  className = '',
  asCard = true,
}) => {
  const content = (
    <div className="ui-empty-state__content">
      {title ? <h3 className="ui-empty-state__title">{title}</h3> : null}
      {message ? <p className="ui-empty-state__message">{message}</p> : null}
      {children ? <div className="ui-empty-state__actions">{children}</div> : null}
    </div>
  );

  if (!asCard) {
    return <div className={`ui-empty-state ${className}`.trim()}>{content}</div>;
  }

  return <Card className={`ui-empty-state ${className}`.trim()}>{content}</Card>;
};

export default EmptyState;
