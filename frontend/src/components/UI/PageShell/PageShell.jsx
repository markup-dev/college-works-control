import React from 'react';
import './PageShell.scss';

const PageShell = ({
  children,
  className = '',
  contentClassName = '',
  maxWidth = 'wide',
}) => (
  <main className={`ui-page-shell ui-page-shell--${maxWidth} ${className}`.trim()}>
    <div className={`ui-page-shell__content ${contentClassName}`.trim()}>
      {children}
    </div>
  </main>
);

export default PageShell;
