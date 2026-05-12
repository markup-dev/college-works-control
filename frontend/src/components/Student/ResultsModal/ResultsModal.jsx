import React from 'react';
import Button from '../../UI/Button/Button';
import Modal from '../../UI/Modal/Modal';
import { formatDate } from '../../../utils';
import './ResultsModal.scss';

const ResultsModal = ({ 
  assignment, 
  isOpen, 
  onClose 
}) => {
  if (!isOpen || !assignment) return null;

  const maxScore = assignment.maxScore || 100;
  const score = assignment.score;
  const gradeLabel = assignment.gradeLabel || assignment.grade_label || null;
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
  const submissionStatuses = ['not_submitted', 'submitted', 'graded', 'returned'];
  const resolveResultsStatus = () => {
    const s = assignment.status;
    if (submissionStatuses.includes(s)) {
      return s;
    }
    if (assignment.score != null && assignment.score !== '') {
      return 'graded';
    }
    if (assignment.submittedAt) {
      return 'submitted';
    }
    return 'not_submitted';
  };
  const resultStatus = getResultStatusInfo(resolveResultsStatus());

  const getScoreColor = () => {
    if (score === null || score === undefined) return 'default';
    const percent = percentage;
    if (percent >= 90) return 'excellent';
    if (percent >= 75) return 'good';
    if (percent >= 60) return 'satisfactory';
    return 'poor';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Результаты проверки работы"
      size="large"
      className="student-results-modal"
      contentClassName="student-results-modal__body"
      footer={(
        <div className="student-results-modal__actions">
          <Button variant="primary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      )}
    >
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
                {gradeLabel && (
                  <div className="score-grade-label">
                    Оценка по шкале: {gradeLabel}
                  </div>
                )}
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
    </Modal>
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

