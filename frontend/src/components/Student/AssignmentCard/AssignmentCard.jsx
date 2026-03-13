import React from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import { getAssignmentStatusInfo, getPriorityInfo, getDaysUntilDeadline, formatDate } from '../../../utils';
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
  const priorityInfo = getPriorityInfo(assignment.priority);
  const daysUntilDeadline = getDaysUntilDeadline(assignment.deadline);
  const isUrgent = daysUntilDeadline <= 3 && assignment.status === 'not_submitted';
  const isOverdue = daysUntilDeadline < 0 && assignment.status === 'not_submitted';
  const isHighPriority = assignment.priority === 'high';

  const renderActions = () => {
    switch (assignment.status) {
      case 'not_submitted':
        return (
          <Button
            variant={isOverdue ? "danger" : isUrgent ? "warning" : "primary"}
            size="medium"
            onClick={(e) => { e.stopPropagation(); onSubmitWork(assignment); }}
            icon={assignment.submissionType === 'demo' ? "🎤" : "📤"}
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
            icon="⏳"
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
            icon="👁"
            fullWidth
          >
            Результаты
          </Button>
        );
      
      case 'returned':
        return (
          <div className="assignment-actions__group">
            <Button
              variant="warning"
              size="medium"
              onClick={(e) => { e.stopPropagation(); onResubmit(assignment); }}
              icon="↩️"
            >
              Пересдать
            </Button>
            <Button
              variant="outline"
              size="small"
              onClick={(e) => { e.stopPropagation(); onViewResults(assignment); }}
              icon="👁"
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
    <Card
      key={assignment.id}
      hoverable
      className={`assignment-card ${className} ${isUrgent ? 'assignment-card--urgent' : ''} ${isOverdue ? 'assignment-card--overdue' : ''}`}
      onClick={() => onViewDetails(assignment)}
      style={{ cursor: 'pointer' }}
    >
      {isHighPriority && (
        <div className="assignment-priority-badge">
          <span className="priority-dot"></span>
          Высокий приоритет
        </div>
      )}

      <div className="assignment-header">
        <div className="assignment-title-section">
          <h3 className="assignment-title">{assignment.title}</h3>
          <div className="assignment-meta">
            <span className="course-badge">
              <span className="meta-icon">📚</span>
              {assignment.course}
            </span>
            <span className="teacher-info">
              <span className="meta-icon">👨‍🏫</span>
              {assignment.teacher}
            </span>
          </div>
        </div>
        <div className="assignment-status">
          <span className={`status-badge status-badge--${statusInfo.variant}`}>
            <span className="status-icon">{statusInfo.icon}</span>
            {statusInfo.label}
          </span>
          {isUrgent && (
            <span className="urgency-badge urgency-badge--warning">
              <span className="urgency-icon">🔥</span>
              Срочно!
            </span>
          )}
          {isOverdue && (
            <span className="urgency-badge urgency-badge--danger">
              <span className="urgency-icon">⚠️</span>
              Просрочено
            </span>
          )}
        </div>
      </div>
      
      <p className="assignment-description">{assignment.description}</p>
      
      <div className="assignment-details">
        <DetailRow 
          icon="📅"
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
          icon="🎯"
          label="Приоритет:" 
          value={
            <span className="priority-info">
              <span className="priority-icon">{priorityInfo.icon}</span>
              {priorityInfo.label}
            </span>
          } 
        />
        
        <DetailRow 
          icon="📊"
          label="Макс. балл:" 
          value={<span className="max-score">{assignment.maxScore}</span>} 
        />

        <DetailRow 
          icon="📤"
          label="Формат сдачи:" 
          value={
            assignment.submissionType === 'file' ? 
            '📎 Файл' : 
            '🎤 Демонстрация'
          } 
        />
        
        {assignment.submittedAt && (
          <DetailRow 
            icon="📨"
            label="Сдано:" 
            value={formatDate(assignment.submittedAt)} 
          />
        )}
        
        {assignment.score !== null && assignment.score !== undefined && (
          <DetailRow 
            icon="⭐"
            label="Оценка:" 
            value={
              <div className="score-info">
                <span className="score-value">
                  {assignment.score}<span className="score-separator">/</span>{assignment.maxScore}
                </span>
                <span className="score-percent">
                  {Math.round((Number(assignment.score) / Number(assignment.maxScore)) * 100)}%
                </span>
              </div>
            } 
          />
        )}
      </div>

      {assignment.criteria && assignment.criteria.length > 0 && (
        <CriteriaSection criteria={assignment.criteria} />
      )}
      
      <div className="assignment-actions">
        {renderActions()}
      </div>
    </Card>
  );
};

const DetailRow = ({ icon, label, value }) => (
  <div className="detail-row">
    <div className="detail-label">
      <span className="detail-icon">{icon}</span>
      {label}
    </div>
    <div className="detail-value">
      {value}
    </div>
  </div>
);

const CriteriaSection = ({ criteria }) => (
  <div className="criteria-section">
    <div className="criteria-header">
      <span className="criteria-icon">📋</span>
      <h4>Критерии оценки:</h4>
    </div>
    <ul className="criteria-list">
      {criteria.map((criterion, index) => {
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
);

export default AssignmentCard;