import React from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import './AssignmentBankCard.scss';

const AssignmentBankCard = ({ template, onOpenTemplate, onDelete, onPublish }) => {
  const subject = template.subject?.name || '—';
  const critCount = Array.isArray(template.criteria) ? template.criteria.length : 0;
  const matCount = Array.isArray(template.materialFiles) ? template.materialFiles.length : 0;
  const preview =
    (template.description || '').trim().slice(0, 160) + ((template.description || '').length > 160 ? '…' : '');

  return (
    <div className="assignment-bank-card-wrap">
      <Card className="assignment-bank-card" hoverable>
        <div
          className="assignment-bank-card__main"
          onClick={() => onOpenTemplate?.(template)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenTemplate?.(template);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Открыть заготовку: ${template.title}`}
        >
          <div className="assignment-bank-card__head">
            <h3 className="assignment-bank-card__title">{template.title}</h3>
            <span className="assignment-bank-card__subject">{subject}</span>
          </div>
          {preview ? <p className="assignment-bank-card__desc">{preview}</p> : null}
          <p className="assignment-bank-card__stats">
            Критериев: <strong>{critCount}</strong>
            <span aria-hidden> · </span>
            Материалов: <strong>{matCount}</strong>
          </p>
        </div>
        <div className="assignment-bank-card__actions">
          <Button type="button" variant="primary" size="small" onClick={() => onPublish?.(template)}>
            Выдать задание
          </Button>
          <Button
            type="button"
            variant="primary"
            size="small"
            className="assignment-bank-card__delete"
            onClick={() => onDelete?.(template)}
          >
            Удалить из банка
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AssignmentBankCard;
