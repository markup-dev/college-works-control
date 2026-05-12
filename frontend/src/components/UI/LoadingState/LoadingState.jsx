import React from 'react';
import './LoadingState.scss';

const LoadingState = ({ message = 'Загрузка...', className = '' }) => (
  <div className={`ui-loading-state ${className}`.trim()} role="status" aria-live="polite">
    <span className="ui-loading-state__spinner" aria-hidden="true" />
    <p className="ui-loading-state__message">{message}</p>
  </div>
);

export default LoadingState;
