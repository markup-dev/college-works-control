import React from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import { 
  getAssignmentStatusInfo, 
  getPriorityInfo, 
  formatDate,
  calculateSubmissionStats 
} from '../../../utils';
import './AssignmentCard.scss';

const AssignmentCard = React.memo(({
  assignment,
  onViewSubmissions,
  onDeleteAssignment,
  onViewDetails
}) => {
  const {
    title,
    subject,
    description,
    status,
    priority,
    deadline,
    createdAt,
    submissions = [],
    studentGroups = [],
  } = assignment;

  const stats = calculateSubmissionStats(submissions, assignment);
  const statusInfo = getAssignmentStatusInfo(status);
  const priorityInfo = getPriorityInfo(priority);
  const canViewSubmissions = status !== 'inactive';
  const isDraft = status === 'draft';

  const handleViewSubmissions = (e) => {
    e.stopPropagation();
    onViewSubmissions(assignment.id);
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
          <div className="assignment-actions__row">
            <Button
              variant="primary"
              size="small"
              onClick={handleDeleteAssignment}
              className="assignment-card-btn--danger"
              fullWidth
            >
              Удалить
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="assignment-actions">
        <div className="assignment-actions__row">
          <Button
            variant="primary"
            size="small"
            onClick={handleViewSubmissions}
            disabled={!canViewSubmissions}
            fullWidth
          >
            Просмотр работ
          </Button>
          {onDeleteAssignment && (
            <Button
              variant="primary"
              size="small"
              onClick={handleDeleteAssignment}
              className="assignment-card-btn--danger"
              fullWidth
            >
              Удалить
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="teacher-assignment-card">
      <Card
        hoverable
        className={`assignment-card assignment-card--${status}`}
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
            <span className="subject-badge">
              {subject}
            </span>
            
            {studentGroups.length > 0 && (
              <span className="groups-info">
                {studentGroups.length} групп
              </span>
            )}
          </div>

          <div className="assignment-meta-secondary">
            <span className={`priority-info priority-info--${priority || 'medium'}`}>
              {priorityInfo.label}
            </span>
          </div>
        </div>
        
        <div className="assignment-status">
          <span className={`status-badge status-badge--${statusInfo.variant}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      <p className="assignment-description">{description}</p>

      {!isDraft && (
        <SubmissionProgress stats={stats} />
      )}

      <div className="assignment-details">
        <DetailRow 
          label="Дата создания:" 
          value={formatDate(createdAt)}
        />

        <DetailRow 
          label="Срок сдачи:"
          value={
            formatDate(deadline)
          }
        />
      </div>

        <div className="assignment-actions">
          {renderActions()}
        </div>
      </Card>
    </div>
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
          <span className="graded-count">{stats.graded} проверено</span>
        )}
        {stats.pending > 0 && (
          <span className="pending-count">{stats.pending} ожидают</span>
        )}
      </div>
    </div>
  </div>
));

const DetailRow = React.memo(({ label, value }) => (
  <div className="detail-row">
    <div className="detail-label">
      {label}
    </div>
    <div className="detail-value">
      {value}
    </div>
  </div>
));

export default AssignmentCard;