import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../UI/Button/Button';
import { formatDate, getGradeLabelForScore, validateScore, validateGradingComment } from '../../../utils';
import { useAuth } from '../../../context/AuthContext';
import { useNotification } from '../../../context/NotificationContext';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import './GradingModal.scss';

const GradingModal = ({ 
  submission, 
  assignment,
  isOpen, 
  onClose, 
  onBackToDetails,
  gradeData, 
  onGradeDataChange, 
  onSubmit 
}) => {
  const { user } = useAuth();
  const { showError } = useNotification();
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !submission) return null;

  const maxScore = submission.maxScore || assignment?.maxScore || 100;
  const hasCriteria = Array.isArray(gradeData.criterionScores) && gradeData.criterionScores.length > 0;
  const useCriteriaScoring = !!gradeData.useCriteriaScoring && hasCriteria;
  const currentScore = Math.max(0, Math.min(Number(gradeData.score || 0), Number(maxScore || 0)));
  const scorePercent = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0;
  const gradeLabel = gradeData.score === '' ? null : getGradeLabelForScore(currentScore, user?.gradeScale);
  const criteriaTotal = useCriteriaScoring
    ? gradeData.criterionScores.reduce((sum, criterion) => sum + (Number(criterion.receivedPoints) || 0), 0)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErrors({});

    const scoreValidation = validateScore(gradeData.score, maxScore);
    if (!scoreValidation.isValid) {
      setErrors({ score: scoreValidation.error });
      showError(scoreValidation.error);
      return;
    }

    if (useCriteriaScoring && criteriaTotal !== Number(gradeData.score || 0)) {
      const mismatchError = 'Сумма баллов по критериям должна совпадать с итоговой оценкой.';
      setErrors({ score: mismatchError });
      showError(mismatchError);
      return;
    }

    const commentValidation = validateGradingComment(gradeData.comment);
    if (!commentValidation.isValid) {
      setErrors({ comment: commentValidation.error });
      showError(commentValidation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      await Promise.resolve(onSubmit?.());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCriterionScoreChange = (index, value, criterionMaxPoints) => {
    const digitsOnly = String(value ?? '').replace(/[^\d]/g, '');
    const normalizedDigits = digitsOnly.replace(/^0+(?=\d)/, '');
    const nextValue = Number(normalizedDigits === '' ? '0' : normalizedDigits);
    const safeValue = Number.isFinite(nextValue) ? nextValue : 0;
    const normalizedValue = Math.max(0, Math.min(safeValue, Number(criterionMaxPoints || 0)));

    const nextCriterionScores = gradeData.criterionScores.map((criterion, criterionIndex) => (
      criterionIndex === index
        ? { ...criterion, receivedPoints: normalizedValue }
        : criterion
    ));

    const nextTotal = nextCriterionScores.reduce((sum, criterion) => sum + (Number(criterion.receivedPoints) || 0), 0);
    onGradeDataChange({
      ...gradeData,
      criterionScores: nextCriterionScores,
      score: String(nextTotal),
      useCriteriaScoring: true,
    });
    if (errors.score) setErrors({ ...errors, score: null });
  };

  const handleCriteriaModeToggle = (enabled) => {
    if (!enabled) {
      onGradeDataChange({
        ...gradeData,
        useCriteriaScoring: false,
      });
      return;
    }

    const nextTotal = gradeData.criterionScores.reduce((sum, criterion) => sum + (Number(criterion.receivedPoints) || 0), 0);
    onGradeDataChange({
      ...gradeData,
      useCriteriaScoring: true,
      score: String(nextTotal),
    });
  };

  const getScoreFillStyle = (percent) => {
    const clampedPercent = Math.max(0, Math.min(percent, 100));
    const hue = Math.round((clampedPercent / 100) * 120); // 0=red, 120=green
    const endHue = Math.min(120, hue + 12);

    return {
      width: `${clampedPercent}%`,
      background: `linear-gradient(90deg, hsl(${hue} 78% 45%) 0%, hsl(${endHue} 72% 55%) 100%)`,
    };
  };

  return createPortal(
    (
      <div className="modal-overlay teacher-grading-modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header__titles">
              <h3>Оценка работы</h3>
              <p>{submission.studentName}{submission.group ? ` • ${submission.group}` : ''}</p>
            </div>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
          </div>

          <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
            <div className="modal-body">
              <SubmissionInfo submission={submission} assignment={assignment} maxScore={maxScore} />

              <div className="grading-form">
                <div className="form-group">
                  <label htmlFor="score">
                    Оценка (0-{maxScore} баллов): *
                  </label>
                  <div className="score-row">
                    <input
                      id="score"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={gradeData.score}
                      onChange={(e) => {
                        onGradeDataChange({...gradeData, score: e.target.value});
                        if (errors.score) setErrors({...errors, score: null});
                      }}
                      className={`score-input ${errors.score ? 'error' : ''}`}
                      readOnly={useCriteriaScoring}
                      required
                    />
                    <div className="score-preview">
                      <div className="score-preview__value">
                        {currentScore}/{maxScore}
                        {gradeLabel && (
                          <span className="score-preview__grade">
                            оценка {gradeLabel}
                          </span>
                        )}
                      </div>
                      <div className="score-preview__bar">
                        <div className="score-preview__fill" style={getScoreFillStyle(scorePercent)}></div>
                      </div>
                    </div>
                  </div>
                  {errors.score && <div className="error-message">{errors.score}</div>}
                  <div className="score-hint">
                    {useCriteriaScoring
                      ? `Итог считается автоматически по критериям: ${criteriaTotal}/${maxScore}`
                      : `Введите целое число от 0 до ${maxScore}`}
                  </div>
                </div>

                {hasCriteria && (
                  <div className="form-group">
                    <label className="criteria-mode-toggle">
                      <input
                        type="checkbox"
                        checked={useCriteriaScoring}
                        onChange={(e) => handleCriteriaModeToggle(e.target.checked)}
                      />
                      <span>Оценивать по критериям</span>
                    </label>
                  </div>
                )}

                {useCriteriaScoring && (
                  <div className="form-group">
                    <label>Баллы по критериям:</label>
                    <div className="criteria-score-list">
                      {gradeData.criterionScores.map((criterion, index) => (
                        <div key={`${criterion.text}-${index}`} className="criteria-score-item">
                          <div className="criteria-score-item__meta">
                            <span className="criteria-score-item__title">{criterion.text}</span>
                            <span className="criteria-score-item__max">Макс: {criterion.maxPoints}</span>
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={Number(criterion.receivedPoints || 0)}
                            onChange={(e) => handleCriterionScoreChange(index, e.target.value, criterion.maxPoints)}
                            className="criteria-score-item__input"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                    Этот комментарий увидят студенты ({(gradeData.comment || '').length}/2000)
                  </div>
                </div>

                <div className="grading-tips">
                  <h4>Критерии оценки:</h4>
                  <ul>
                    <li>Соответствие требованиям задания</li>
                    <li>Качество выполнения работы</li>
                    <li>Оригинальность и креативность</li>
                    <li>Техническая реализация</li>
                    <li>Документация и оформление</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={onBackToDetails}
              >
                ← Назад к деталям
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
                Сохранить оценку
              </Button>
            </div>
          </form>
        </div>
      </div>
    ),
    document.body,
  );
};

const SubmissionInfo = ({ submission, assignment, maxScore }) => (
  <div className="submission-info">
    <h4>{submission.assignmentTitle}</h4>
    <div className="info-grid">
      <div className="info-item">
        <strong>Студент:</strong>
        <span>{submission.studentName}</span>
      </div>
      <div className="info-item">
        <strong>Группа:</strong>
        <span>{submission.group}</span>
      </div>
      <div className="info-item">
        <strong>Максимальный балл:</strong>
        <span>{maxScore}</span>
      </div>
      <div className="info-item">
        <strong>Дата создания задания:</strong>
        <span>{assignment?.createdAt ? formatDate(assignment.createdAt) : 'Дата не указана'}</span>
      </div>
      <div className="info-item">
        <strong>Дата сдачи:</strong>
        <span>{submission.submissionDate ? formatDate(submission.submissionDate) : 'Дата не указана'}</span>
      </div>
    </div>
  </div>
);

export default GradingModal;