import React, { useState } from 'react';
import Button from '../../UI/Button/Button';
import { formatDate, validateScore, validateGradingComment } from '../../../utils';
import { useNotification } from '../../../context/NotificationContext';
import './GradingModal.scss';

const GradingModal = ({ 
  submission, 
  assignment,
  isOpen, 
  onClose, 
  gradeData, 
  onGradeDataChange, 
  onSubmit 
}) => {
  const { showError } = useNotification();
  const [errors, setErrors] = useState({});
  
  if (!isOpen || !submission) return null;

  const maxScore = submission.maxScore || assignment?.maxScore || 100;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    setErrors({});
    
    const scoreValidation = validateScore(gradeData.score, maxScore);
    if (!scoreValidation.isValid) {
      setErrors({ score: scoreValidation.error });
      showError(scoreValidation.error);
      return;
    }
    
    const commentValidation = validateGradingComment(gradeData.comment);
    if (!commentValidation.isValid) {
      setErrors({ comment: commentValidation.error });
      showError(commentValidation.error);
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Оценка работы</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <SubmissionInfo submission={submission} maxScore={maxScore} />
            
            <div className="grading-form">
              <div className="form-group">
                <label htmlFor="score">
                  Оценка (0-{maxScore} баллов): *
                </label>
                <input
                  id="score"
                  type="number"
                  min="0"
                  max={maxScore}
                  step="1"
                  value={gradeData.score}
                  onChange={(e) => {
                    onGradeDataChange({...gradeData, score: e.target.value});
                    if (errors.score) setErrors({...errors, score: null});
                  }}
                  className={`score-input ${errors.score ? 'error' : ''}`}
                  required
                />
                {errors.score && <div className="error-message">{errors.score}</div>}
                <div className="score-hint">
                  Введите целое число от 0 до {maxScore}
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="comment">Комментарий и рекомендации:</label>
                <textarea
                  id="comment"
                  value={gradeData.comment || ''}
                  onChange={(e) => {
                    onGradeDataChange({...gradeData, comment: e.target.value});
                    if (errors.comment) setErrors({...errors, comment: null});
                  }}
                  className={`comment-textarea ${errors.comment ? 'error' : ''}`}
                  placeholder="Укажите сильные стороны работы, замечания и рекомендации по улучшению..."
                  rows="6"
                  maxLength={2000}
                />
                {errors.comment && <div className="error-message">{errors.comment}</div>}
                <div className="comment-hint">
                  Этот комментарий увидят студенты (максимум 2000 символов)
                </div>
              </div>

              <div className="grading-tips">
                <h4>Критерии оценки:</h4>
                <ul>
                  <li>✅ Соответствие требованиям задания</li>
                  <li>✅ Качество выполнения работы</li>
                  <li>✅ Оригинальность и креативность</li>
                  <li>✅ Техническая реализация</li>
                  <li>✅ Документация и оформление</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" variant="primary">
              💾 Сохранить оценку
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SubmissionInfo = ({ submission, maxScore }) => (
  <div className="submission-info">
    <h4>{submission.assignmentTitle}</h4>
    <div className="info-grid">
      <div className="info-item">
        <strong>Студент:</strong>
        <span>{submission.studentName} ({submission.studentId})</span>
      </div>
      <div className="info-item">
        <strong>Группа:</strong>
        <span>{submission.group}</span>
      </div>
      <div className="info-item">
        <strong>Дата сдачи:</strong>
        <span>{formatDate(submission.submissionDate)}</span>
      </div>
      <div className="info-item">
        <strong>Файл:</strong>
        <span>{submission.fileName} ({submission.fileSize})</span>
      </div>
      <div className="info-item">
        <strong>Макс. балл:</strong>
        <span>{maxScore}</span>
      </div>
    </div>
  </div>
);

export default GradingModal;