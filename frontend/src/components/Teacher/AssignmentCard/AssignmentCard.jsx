import React from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import { 
  getAssignmentStatusInfo, 
  getPriorityInfo, 
  getDaysUntilDeadline, 
  formatDate,
  calculateSubmissionStats 
} from '../../../utils';
import './AssignmentCard.scss';

const AssignmentCard = React.memo(({
  assignment,
  onViewSubmissions,
  onEditAssignment,
  onViewAnalytics,
  onDeleteAssignment,
  onViewDetails
}) => {
  const {
    title,
    course,
    description,
    criteria,
    status,
    priority,
    deadline,
    maxScore,
    submissionType,
    submissions = [],
    studentGroups = [],
    createdAt
  } = assignment;

  const stats = calculateSubmissionStats(submissions);
  const statusInfo = getAssignmentStatusInfo(status);
  const priorityInfo = getPriorityInfo(priority);
  const daysUntilDeadline = getDaysUntilDeadline(deadline);
  const isUrgent = daysUntilDeadline <= 3;
  const isOverdue = daysUntilDeadline < 0;
  const isActive = status === 'active';
  const isDraft = status === 'draft';

  const handleViewSubmissions = (e) => {
    e.stopPropagation();
    onViewSubmissions(assignment.id);
  };
  const handleEditAssignment = (e) => {
    e.stopPropagation();
    onEditAssignment(assignment);
  };
  const handleViewAnalytics = (e) => {
    e.stopPropagation();
    onViewAnalytics(assignment);
  };
  const handleDeleteAssignment = (e) => {
    e.stopPropagation();
    onDeleteAssignment && onDeleteAssignment(assignment);
  };
  const handleViewDetails = (e) => {
    e.stopPropagation();
    onViewDetails && onViewDetails(assignment);
  };

  const renderActions = () => {
    if (isDraft) {
      return (
        <div className="assignment-actions">
          <Button
            variant="primary"
            size="medium"
            onClick={handleEditAssignment}
            icon="✏️"
            fullWidth
          >
            Редактировать
          </Button>
          <div className="assignment-actions__secondary">
            <Button
              variant="danger"
              size="small"
              onClick={handleDeleteAssignment}
              icon="🗑️"
            >
              Удалить
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="assignment-actions">
        <Button
          variant="primary"
          size="medium"
          onClick={handleViewSubmissions}
          icon="📋"
          disabled={!isActive}
          fullWidth
        >
          Просмотр работ ({stats.total})
        </Button>
        <div className="assignment-actions__secondary">
          <Button
            variant="outline"
            size="small"
            onClick={handleEditAssignment}
            icon="✏️"
          >
            Редактировать
          </Button>
          <Button
            variant="outline"
            size="small"
            onClick={handleViewAnalytics}
            icon="📊"
          >
            Аналитика
          </Button>
          {onDeleteAssignment && (
            <Button
              variant="danger"
              size="small"
              onClick={handleDeleteAssignment}
              icon="🗑️"
            >
              Удалить
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card
      hoverable
      className={`assignment-card assignment-card--${status} ${isUrgent ? 'assignment-card--urgent' : ''}`}
      onClick={handleViewDetails}
      style={{ cursor: 'pointer' }}
    >
      <div className="assignment-header">
        <div className="assignment-title-section">
          <div className="assignment-title-wrapper">
            <h3 className="assignment-title">{title}</h3>
            {isDraft && (
              <span className="draft-badge">Черновик</span>
            )}
          </div>
          
          <div className="assignment-meta">
            <span className="course-badge">
              <span className="meta-icon">📚</span>
              {course}
            </span>
            
            {studentGroups.length > 0 && (
              <span className="groups-info">
                <span className="meta-icon">👥</span>
                {studentGroups.length} групп
              </span>
            )}
            
            <span className="priority-info">
              <span className="meta-icon">{priorityInfo.icon}</span>
              {priorityInfo.label}
            </span>
          </div>
        </div>
        
        <div className="assignment-status">
          <span className={`status-badge status-badge--${statusInfo.variant}`}>
            <span className="status-icon">{statusInfo.icon}</span>
            {statusInfo.label}
          </span>
          
          {isUrgent && !isOverdue && (
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

      <p className="assignment-description">{description}</p>

      {!isDraft && (
        <SubmissionProgress stats={stats} />
      )}

      <div className="assignment-details">
        <DetailRow 
          icon="📅"
          label="Срок сдачи:" 
          value={
            <div className="deadline-info">
              <span className="deadline-date">{formatDate(deadline)}</span>
              <span className={`days-left ${isOverdue ? 'days-left--overdue' : isUrgent ? 'days-left--urgent' : ''}`}>
                {isOverdue ? `${Math.abs(daysUntilDeadline)} д. назад` : `${daysUntilDeadline} д.`}
              </span>
            </div>
          }
        />
        
        <DetailRow 
          icon="📊"
          label="Макс. балл:" 
          value={<span className="max-score">{maxScore}</span>} 
        />

        <DetailRow 
          icon="📤"
          label="Формат сдачи:" 
          value={
            submissionType === 'file' ? 
            <span className="submission-type">📎 Файл</span> : 
            <span className="submission-type">🎤 Демонстрация</span>
          } 
        />
        
        <DetailRow 
          icon="📝"
          label="Создано:" 
          value={formatDate(createdAt)} 
        />
      </div>

      {criteria && criteria.length > 0 && (
        <CriteriaSection criteria={criteria} />
      )}
      
      <div className="assignment-actions">
        {renderActions()}
      </div>
    </Card>
  );
});

const SubmissionProgress = React.memo(({ stats }) => (
  <div className="submissions-progress">
    <div className="progress-header">
      <span className="progress-title">Прогресс сдачи:</span>
      <span className="completion-rate">{stats.completionRate}%</span>
    </div>
    
    <div className="progress-bar">
      <div 
        className="progress-fill" 
        style={{ width: `${stats.completionRate}%` }}
      ></div>
    </div>
    
    <div className="progress-stats">
      <div className="progress-numbers">
        <span className="submitted-count">{stats.submitted}</span>
        <span className="progress-separator">/</span>
        <span className="total-count">{stats.total}</span>
        <span className="progress-label">студентов</span>
      </div>
      
      <div className="progress-details">
        {stats.graded > 0 && (
          <span className="graded-count">✓ {stats.graded} проверено</span>
        )}
        {stats.pending > 0 && (
          <span className="pending-count">⏳ {stats.pending} ожидают</span>
        )}
      </div>
    </div>
  </div>
));

const DetailRow = React.memo(({ icon, label, value }) => (
  <div className="detail-row">
    <div className="detail-label">
      <span className="detail-icon">{icon}</span>
      {label}
    </div>
    <div className="detail-value">
      {value}
    </div>
  </div>
));

const CriteriaSection = React.memo(({ criteria }) => (
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
));

export default AssignmentCard;