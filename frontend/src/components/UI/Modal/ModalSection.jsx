import React from 'react';
import './ModalSection.scss';

const ModalSection = ({
  children,
  title = '',
  className = '',
  variant = 'default',
}) => (
  <section className={`ui-modal-section ui-modal-section--${variant} ${className}`.trim()}>
    {title ? <h3 className="ui-modal-section__title">{title}</h3> : null}
    <div className="ui-modal-section__content">{children}</div>
  </section>
);

export default ModalSection;
