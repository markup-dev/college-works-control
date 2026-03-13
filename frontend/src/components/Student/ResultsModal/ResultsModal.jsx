import React from 'react';
import Button from '../../UI/Button/Button';
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
  const percentage = score !== null && score !== undefined 
    ? Math.round((score / maxScore) * 100) 
    : 0;

  const getScoreColor = () => {
    if (score === null || score === undefined) return 'default';
    const percent = percentage;
    if (percent >= 90) return 'excellent';
    if (percent >= 75) return 'good';
    if (percent >= 60) return 'satisfactory';
    return 'poor';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content results-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Результаты проверки работы</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="results-section">
            <h4 className="section-title">📝 Задание</h4>
            <div className="info-grid">
              <div className="info-item">
                <strong>Название:</strong>
                <span>{assignment.title}</span>
              </div>
              {assignment.course && (
                <div className="info-item">
                  <strong>Дисциплина:</strong>
                  <span>{assignment.course}</span>
                </div>
              )}
              {assignment.teacher && (
                <div className="info-item">
                  <strong>Преподаватель:</strong>
                  <span>{assignment.teacher}</span>
                </div>
              )}
              {assignment.deadline && (
                <div className="info-item">
                  <strong>Срок сдачи:</strong>
                  <span>{formatDate(assignment.deadline)}</span>
                </div>
              )}
              {assignment.submittedAt && (
                <div className="info-item">
                  <strong>Дата сдачи:</strong>
                  <span>{formatDate(assignment.submittedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {score !== null && score !== undefined && (
            <div className="results-section">
              <h4 className="section-title">✅ Оценка</h4>
              <div className={`score-display score-display--${getScoreColor()}`}>
                <div className="score-main">
                  <span className="score-value">{score}</span>
                  <span className="score-separator">/</span>
                  <span className="score-max">{maxScore}</span>
                </div>
                <div className="score-percentage">
                  {percentage}%
                </div>
              </div>
              
              <div className="score-indicator">
                <div 
                  className="score-bar" 
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          )}

          {assignment.feedback && (
            <div className="results-section">
              <h4 className="section-title">💬 Комментарий преподавателя</h4>
              <div className="feedback-text">
                {assignment.feedback}
              </div>
            </div>
          )}

          {assignment.criteria && assignment.criteria.length > 0 && (
            <div className="results-section">
              <h4 className="section-title">📊 Критерии оценки</h4>
              <ul className="criteria-list">
                {assignment.criteria.map((criterion, index) => {
                  const text = typeof criterion === 'string' ? criterion : criterion.text;
                  const points = typeof criterion === 'object' ? criterion.maxPoints : 0;
                  return (
                    <li key={index} className="criterion-item">
                      <span className="criterion-marker">•</span>
                      <span className="criterion-text">
                        {text}{points > 0 && ` — ${points} баллов`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {assignment.description && (
            <div className="results-section">
              <h4 className="section-title">📋 Описание задания</h4>
              <div className="description-text">{assignment.description}</div>
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
  );
};

export default ResultsModal;

