import React from 'react';
import './StatusBadge.scss';

const toneAlias = {
  active: 'success',
  inactive: 'neutral',
  blocked: 'danger',
  password: 'warning',
  error: 'danger',
  completed: 'neutral',
  draft: 'default',
};

const StatusBadge = ({
  children,
  tone = 'default',
  withDot = true,
  className = '',
  ...props
}) => {
  const normalizedTone = toneAlias[tone] || tone || 'default';

  return (
    <span
      className={`ui-status-badge ui-status-badge--${normalizedTone} ${className}`.trim()}
      {...props}
    >
      {withDot && <span className="ui-status-badge__dot" aria-hidden="true" />}
      <span className="ui-status-badge__text">{children}</span>
    </span>
  );
};

export default StatusBadge;
