import React from 'react';
import './ModalDangerZone.scss';

const ModalDangerZone = ({
  title = 'Опасная зона',
  description,
  children,
  className = '',
}) => (
  <section
    className={`modal-danger-zone${className ? ` ${className}` : ''}`}
    aria-label={title}
  >
    <h3 className="modal-danger-zone__title">{title}</h3>
    {description ? (
      <p className="modal-danger-zone__description">{description}</p>
    ) : null}
    <div className="modal-danger-zone__actions">{children}</div>
  </section>
);

export default ModalDangerZone;
