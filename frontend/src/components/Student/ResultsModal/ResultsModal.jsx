import React from 'react';
import { createPortal } from 'react-dom';
import Button from '../../UI/Button/Button';
import { formatDate } from '../../../utils';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import './ResultsModal.scss';

const ResultsModal = ({ 
  assignment, 
  isOpen, 
  onClose 
}) => {
  useBodyScrollLock(isOpen);

  if (!isOpen || !assignment) return null;

  const maxScore = assignment.maxScore || 100;
  const score = assignment.score;
  const percentage = score !== null && score !== undefined 
    ? Math.round((score / maxScore) * 100) 
    : 0;
  const criteria = normalizeCriteria(assignment.criteria);
  const hasCriteriaEvaluation = criteria.some(
    (criterion) => criterion.receivedPoints !== null && criterion.receivedPoints !== undefined && Number.isFinite(criterion.receivedPoints)
  );
  const shouldShowTeacherFeedback =
    Boolean(assignment.feedback) &&
    assignment.status !== 'submitted' &&
    assignment.status !== 'not_submitted';
  const resultStatus = getResultStatusInfo(assignment.status);

  const getScoreColor = () => {
    if (score === null || score === undefined) return 'default';
    const percent = percentage;
    if (percent >= 90) return 'excellent';
    if (percent >= 75) return 'good';
    if (percent >= 60) return 'satisfactory';
    return 'poor';
  };

  return createPortal(
    (
      <div className="modal-overlay student-results-modal" onClick={onClose}>
        <div className="modal-content results-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Результаты проверки работы</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          
          <div className="modal-body">
          <div className={`result-overview result-overview--${resultStatus.variant}`}>
            <span className="result-overview__label">{resultStatus.label}</span>
            {assignment.submittedAt && (
              <span className="result-overview__meta">
                Сдано: {formatDate(assignment.submittedAt)}
              </span>
            )}
          </div>

          {score !== null && score !== undefined && (
            <div className="results-section results-section--compact">
              <h4 className="section-title">Оценка</h4>
              <div className={`score-display score-display--${getScoreColor()}`}>
                <div className="score-main">
                  <span className="score-value">{score}</span>
                  <span className="score-separator">/</span>
                  <span className="score-max">{maxScore}</span>
                </div>
                <div className="score-percentage">
                  {percentage}%
                </div>
                <div
                  className="score-display__fill"
                  style={{ width: `${percentage}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          )}

          <div className="results-section results-section--panel">
            <h4 className="section-title">Задание</h4>
            <div className="info-grid info-grid--two-columns">
              <div className="info-item">
                <strong>Название:</strong>
                <span>{assignment.title || '—'}</span>
              </div>
              <div className="info-item">
                <strong>Предмет:</strong>
                <span>{assignment.subject || '—'}</span>
              </div>
              <div className="info-item">
                <strong>Преподаватель:</strong>
                <span>{assignment.teacher || '—'}</span>
              </div>
              <div className="info-item">
                <strong>Срок сдачи:</strong>
                <span>{assignment.deadline ? formatDate(assignment.deadline) : '—'}</span>
              </div>
            </div>
            {assignment.submittedAt && (
              <p className="submitted-at-note">
                Дата сдачи: <strong>{formatDate(assignment.submittedAt)}</strong>
              </p>
            )}
          </div>

          {shouldShowTeacherFeedback && (
            <div className="results-section results-section--panel">
              <h4 className="section-title">Комментарий преподавателя</h4>
              <div className="feedback-text">
                {assignment.feedback}
              </div>
            </div>
          )}

          {assignment.description && (
            <div className="results-section results-section--panel">
              <h4 className="section-title">Описание задания</h4>
              <div className="description-text">{assignment.description}</div>
            </div>
          )}

          {criteria.length > 0 && hasCriteriaEvaluation && (
            <div className="results-section results-section--panel">
              <h4 className="section-title">Критерии оценки</h4>
              <ul className="criteria-list">
                {criteria.map((criterion, index) => (
                  <li key={`${criterion.text}-${index}`} className="criterion-item">
                    <span className="criterion-text">{criterion.text}</span>
                    <div className="criterion-points">
                      <span className="criterion-max">Макс: {criterion.maxPoints}</span>
                      <span className="criterion-got">
                        Получено: {criterion.receivedPoints ?? 'не указано'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          <Button variant="primary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
    ),
    document.body,
  );
};

const normalizeCriteria = (criteria = []) => {
  if (!Array.isArray(criteria)) {
    return [];
  }

  return criteria
    .map((criterion) => {
      if (typeof criterion === 'string') {
        return { text: criterion, maxPoints: 0, receivedPoints: null };
      }

      if (!criterion || typeof criterion !== 'object') {
        return null;
      }

      const text = (criterion.text || '').trim();
      if (!text) {
        return null;
      }

      const maxPoints = Number(criterion.maxPoints ?? criterion.max_points ?? 0);
      const receivedRaw = criterion.receivedPoints
        ?? criterion.received_points
        ?? criterion.score
        ?? criterion.points
        ?? null;

      return {
        text,
        maxPoints: Number.isFinite(maxPoints) ? maxPoints : 0,
        receivedPoints: receivedRaw === null || receivedRaw === undefined
          ? null
          : Number(receivedRaw),
      };
    })
    .filter(Boolean);
};

const getResultStatusInfo = (status) => {
  switch (status) {
    case 'graded':
      return { label: 'Работа проверена', variant: 'success' };
    case 'returned':
      return { label: 'Возвращено на доработку', variant: 'warning' };
    case 'submitted':
      return { label: 'Ожидает проверки', variant: 'default' };
    default:
      return { label: 'Статус не определен', variant: 'default' };
  }
};

export default ResultsModal;

