import React from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import { 
  getAssignmentStatusInfo, 
  formatDate,
  calculateSubmissionStats,
  getDaysUntilDeadline,
} from '../../../utils';
import './AssignmentCard.scss';

const getDeadlineUrgencyBadge = (deadline, assignmentStatus) => {
  if (!deadline || !['active', 'inactive'].includes(assignmentStatus)) {
    return null;
  }
  const days = getDaysUntilDeadline(deadline);
  if (days === null) {
    return null;
  }
  if (days < 0) {
    return { label: 'Дедлайн прошёл', tone: 'overdue' };
  }
  if (days === 0) {
    return { label: 'Дедлайн сегодня', tone: 'today' };
  }
  if (days === 1) {
    return { label: 'Остался 1 день', tone: 'soon' };
  }
  if (days === 2 || days === 3) {
    return { label: `Осталось ${days} дня`, tone: 'soon' };
  }
  return null;
};

const AssignmentCard = React.memo(({
  assignment,
  onViewSubmissions,
  onDeleteAssignment,
  onViewDetails,
}) => {
  const {
    title,
    subject,
    description,
    status,
    deadline,
    createdAt,
    submissions = [],
    studentGroups = [],
  } = assignment;

  const stats = calculateSubmissionStats(submissions, assignment);
  const statusInfo = getAssignmentStatusInfo(status);
  const deadlineUrgency = getDeadlineUrgencyBadge(deadline, status);
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
        </div>
        
        <div className="assignment-status">
          <span className={`status-badge status-badge--${statusInfo.variant}`}>
            {statusInfo.label}
          </span>
          {deadlineUrgency ? (
            <span className={`deadline-urgency-badge deadline-urgency-badge--${deadlineUrgency.tone}`}>
              {deadlineUrgency.label}
            </span>
          ) : null}
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
      <span>Прогресс сдачи</span>
      <span className="progress-percentage">{stats.completionRate}%</span>
    </div>
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${stats.completionRate}%` }}
        aria-hidden="true"
      />
    </div>
    <div className={`assignment-state-line${stats.pending > 0 ? ' has-pending' : ''}`}>
      <span className="assignment-state-line__submitted">
        <strong>{stats.submitted}/{stats.total}</strong> сдали
      </span>
      <span aria-hidden="true">·</span>
      <span className="assignment-state-line__pending">
        <strong>{stats.pending}</strong> ждут проверки
      </span>
      <span aria-hidden="true">·</span>
      <span className="assignment-state-line__graded">
        <strong>{stats.graded}</strong> проверено
      </span>
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