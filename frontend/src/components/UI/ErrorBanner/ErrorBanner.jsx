import React from 'react';
import Button from '../Button/Button';
import './ErrorBanner.scss';

const ErrorBanner = ({
  title = 'Ошибка',
  message,
  actionLabel = '',
  onAction,
  className = '',
}) => (
  <section className={`ui-error-banner ${className}`.trim()} role="alert">
    <div className="ui-error-banner__indicator" aria-hidden="true">!</div>
    <div className="ui-error-banner__body">
      <h3 className="ui-error-banner__title">{title}</h3>
      {message ? <p className="ui-error-banner__message">{message}</p> : null}
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  </section>
);

export default ErrorBanner;
