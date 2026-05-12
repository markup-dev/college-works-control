import React from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import { getAssignmentStatusInfo, getDaysUntilDeadline, formatDate } from '../../../utils';
import iconDeadline from '../../../assets/assignment/assignment-deadline.svg';
import iconMaxScore from '../../../assets/assignment/assignment-max-score.svg';
import iconSubmissionFormat from '../../../assets/assignment/assignment-submission-format.svg';
import iconSubmitted from '../../../assets/assignment/assignment-submitted.svg';
import iconGrade from '../../../assets/assignment/assignment-grade.svg';
import iconSubmissionFile from '../../../assets/assignment/submission-type-file.svg';
import iconSubmissionDemo from '../../../assets/assignment/submission-type-demonstration.svg';
import './AssignmentCard.scss';

const AssignmentCard = ({ 
  assignment, 
  onSubmitWork, 
  onViewResults, 
  onResubmit,
  onViewDetails,
  className = "" 
}) => {
  const statusInfo = getAssignmentStatusInfo(assignment);
  const daysUntilDeadline = getDaysUntilDeadline(assignment.deadline);
  const isUrgent = daysUntilDeadline >= 0 && daysUntilDeadline <= 3 && assignment.status === 'not_submitted';
  const isOverdue = daysUntilDeadline < 0 && assignment.status === 'not_submitted';
  const canSubmitRetake = assignment.canSubmitRetake ?? (assignment.status === 'returned');
  const retakeUsed = Boolean(assignment.retakeUsed);
  const isRetakeAssignment = assignment.status === 'returned' || canSubmitRetake || retakeUsed;
  const gradeLabel = assignment.gradeLabel || assignment.grade_label || null;

  const renderActions = () => {
    switch (assignment.status) {
    case 'not_submitted':
      if (assignment?.is_completed) {
        return (
          <Button variant="secondary" disabled fullWidth>
            Приём работ завершён
          </Button>
        );
      }
      return (
        <Button
          variant={isOverdue ? "danger" : "primary"}
            size="medium"
            className={isUrgent && !isOverdue ? 'assignment-submit-btn--urgent' : ''}
            onClick={(e) => { e.stopPropagation(); onSubmitWork(assignment); }}
            fullWidth
          >
            {isOverdue ?
              (assignment.submissionType === 'demo' ? "Сообщить о готовности (просрочено)" : "Сдать просроченную работу") :
              (assignment.submissionType === 'demo' ? "Сообщить о готовности" : "Сдать работу")
            }
          </Button>
        );
      
      case 'submitted':
        return (
          <Button 
            variant="secondary" 
            size="medium"
            disabled 
            fullWidth
          >
            Ожидает проверки
          </Button>
        );
      
      case 'graded':
        return (
          <Button
            variant="success"
            size="medium"
            onClick={(e) => { e.stopPropagation(); onViewResults(assignment); }}
            fullWidth
          >
            Результаты
          </Button>
        );
      
      case 'returned':
        if (!canSubmitRetake) {
          return (
            <div className="assignment-actions__group">
              <Button
                variant="secondary"
                size="medium"
                disabled
              >
                {retakeUsed ? 'Пересдача использована' : 'Пересдача недоступна'}
              </Button>
              <Button
                variant="outline"
                size="small"
                onClick={(e) => { e.stopPropagation(); onViewResults(assignment); }}
              >
                Комментарий
              </Button>
            </div>
          );
        }

        return (
          <div className="assignment-actions__group">
            <Button
              variant="warning"
              size="medium"
              onClick={(e) => { e.stopPropagation(); onResubmit(assignment); }}
              fullWidth
            >
              Пересдать
            </Button>
            <Button
              variant="secondary"
              size="medium"
              onClick={(e) => { e.stopPropagation(); onViewResults(assignment); }}
              fullWidth
            >
              Комментарий
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="student-assignment-card">
      <Card
        key={assignment.id}
        hoverable
        className={`assignment-card ${className} ${isUrgent ? 'assignment-card--urgent' : ''} ${isOverdue ? 'assignment-card--overdue' : ''}`}
        onClick={() => onViewDetails(assignment)}
        style={{ cursor: 'pointer' }}
      >
      {isOverdue && (
        <div className="overdue-alert-banner">
          <span className="overdue-alert-banner__icon" aria-hidden="true">!</span>
          <span>Дедлайн просрочен на {Math.abs(daysUntilDeadline)} дн.</span>
        </div>
      )}
      <div className="assignment-header">
        <div className="assignment-title-section">
          <h3 className="assignment-title">{assignment.title}</h3>
          <div className="assignment-meta">
            <span className="subject-badge">
              {assignment.subject}
            </span>
            <span className="teacher-info">
              {assignment.teacher}
            </span>
          </div>
        </div>
        <div className="assignment-status">
          <StatusBadge tone={statusInfo.variant}>
            {statusInfo.label}
          </StatusBadge>
          {isRetakeAssignment && (
            <span className={`retake-badge ${retakeUsed ? 'retake-badge--used' : ''}`}>
              {retakeUsed ? 'Пересдача использована' : 'Пересдача'}
            </span>
          )}
        </div>
      </div>
      
      <p className="assignment-description">{assignment.description}</p>
      
      <div className="assignment-details">
        <DetailRow 
          iconSrc={iconDeadline}
          label="Срок сдачи:" 
          value={
            <div className="deadline-info">
              <span className="deadline-date">{formatDate(assignment.deadline)}</span>
              {assignment.status === 'not_submitted' && (
                <span className={`days-left ${isOverdue ? 'days-left--overdue' : isUrgent ? 'days-left--urgent' : ''}`}>
                  {isOverdue ? `${Math.abs(daysUntilDeadline)} д. назад` : `${daysUntilDeadline} д.`}
                </span>
              )}
            </div>
          }
        />
        
        <DetailRow 
          iconSrc={iconMaxScore}
          label="Макс. балл:" 
          value={<span className="max-score">{assignment.maxScore}</span>} 
        />

        <DetailRow 
          iconSrc={iconSubmissionFormat}
          label="Формат сдачи:" 
          value={
            <span className="submission-format-value">
              <img
                className="submission-format-value__icon"
                src={assignment.submissionType === 'file' ? iconSubmissionFile : iconSubmissionDemo}
                alt=""
                aria-hidden
              />
              {assignment.submissionType === 'file' ? 'Файл' : 'Демонстрация'}
            </span>
          } 
        />
        
        {assignment.submittedAt && (
          <DetailRow 
            iconSrc={iconSubmitted}
            label="Сдано:" 
            value={formatDate(assignment.submittedAt)} 
          />
        )}
        
        {assignment.score !== null && assignment.score !== undefined && (
          <DetailRow 
            iconSrc={iconGrade}
            label="Оценка:" 
            value={
              <div className="score-info">
                <span className="score-value">
                  {assignment.score}<span className="score-separator">/</span>{assignment.maxScore}
                </span>
                {gradeLabel && (
                  <span className="score-grade-label">
                    {gradeLabel}
                  </span>
                )}
                <span className="score-percent">
                  {Math.round((Number(assignment.score) / Number(assignment.maxScore)) * 100)}%
                </span>
              </div>
            } 
          />
        )}
      </div>

        <div className="assignment-actions">
          {renderActions()}
        </div>
      </Card>
    </div>
  );
};

const DetailRow = ({ iconSrc, label, value }) => (
  <div className="detail-row">
    <div className="detail-label">
      {iconSrc ? (
        <img className="detail-icon" src={iconSrc} alt="" aria-hidden />
      ) : null}
      {label}
    </div>
    <div className="detail-value">
      {value}
    </div>
  </div>
);

export default AssignmentCard;