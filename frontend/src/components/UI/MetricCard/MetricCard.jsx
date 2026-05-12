import React from 'react';
import { Link } from 'react-router-dom';
import './MetricCard.scss';

const MetricCard = ({
  to,
  value,
  label,
  delta = '',
  hint = '',
  description = '',
  tone = 'blue',
  className = '',
}) => {
  const content = (
    <>
      <div className="ui-metric-card__value">{value}</div>
      <div className="ui-metric-card__label">{label}</div>
      {delta ? <div className="ui-metric-card__delta">{delta}</div> : null}
      {hint ? <div className="ui-metric-card__hint">{hint}</div> : null}
      {description ? <div className="ui-metric-card__description">{description}</div> : null}
    </>
  );
  const classes = `ui-metric-card ui-metric-card--${tone} ${className}`.trim();

  if (to) {
    return (
      <Link className={classes} to={to}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
};

export default MetricCard;
