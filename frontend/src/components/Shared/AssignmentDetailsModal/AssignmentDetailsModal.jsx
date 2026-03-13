import React from 'react';
import Modal from '../../UI/Modal/Modal';
import { 
  formatDate, 
  getPriorityInfo, 
  getAssignmentStatusInfo, 
  getDaysUntilDeadline 
} from '../../../utils';
import './AssignmentDetailsModal.scss';

const AssignmentDetailsModal = ({
  assignment,
  isOpen,
  onClose,
  mode = 'student',
  stats = null,
  extraContent = null
}) => {
  if (!assignment) {
    return null;
  }

  const statusInfo = getAssignmentStatusInfo(assignment);
  const priorityInfo = getPriorityInfo(assignment.priority);
  const deadline = assignment.deadline ? formatDate(assignment.deadline) : '—';
  const createdAt = assignment.createdAt ? formatDate(assignment.createdAt) : '—';
  const maxScore = assignment.maxScore ?? '—';
  const submissionType = getSubmissionTypeLabel(assignment.submissionType);
  const allowedFormats = Array.isArray(assignment.allowedFormats) ? assignment.allowedFormats : [];
  const groups = getGroupsList(assignment);
  const teacherName = assignment.teacherName || assignment.teacher || assignment.teacherLogin || '—';
  const description = assignment.description || 'Описание отсутствует';
  const criteria = normalizeCriteria(assignment.criteria);
  const maxFileSize = assignment.maxFileSize ? `${assignment.maxFileSize} МБ` : '50 МБ';
  const daysUntilDeadline = assignment.deadline ? getDaysUntilDeadline(assignment.deadline) : null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Детали задания" 
      size="large"
    >
      <div className="assignment-details-modal">
        <header className="assignment-details-modal__header">
          <div>
            <p className="assignment-details-modal__course">{assignment.course}</p>
            <h3 className="assignment-details-modal__title">{assignment.title}</h3>
            <p className="assignment-details-modal__teacher">👩‍🏫 {teacherName}</p>
          </div>
          <div className="assignment-details-modal__badges">
            <span className={`status-badge status-badge--${statusInfo.variant}`}>
              <span className="status-icon">{statusInfo.icon}</span>
              {statusInfo.label}
            </span>
            <span className="priority-badge">
              <span className="priority-dot" style={{ backgroundColor: priorityInfo.color }}></span>
              {priorityInfo.label}
            </span>
          </div>
        </header>

        <section className="assignment-details-modal__section">
          <MetaGrid>
            <MetaItem label="Дедлайн">
              <div className="meta-deadline">
                <span>{deadline}</span>
                {typeof daysUntilDeadline === 'number' && (
                  <span className={`deadline-indicator ${daysUntilDeadline < 0 ? 'deadline-indicator--overdue' : daysUntilDeadline <= 3 ? 'deadline-indicator--urgent' : ''}`}>
                    {daysUntilDeadline < 0 
                      ? `Просрочено на ${Math.abs(daysUntilDeadline)} д.` 
                      : `Осталось ${daysUntilDeadline} д.`}
                  </span>
                )}
              </div>
            </MetaItem>
            <MetaItem label="Максимальный балл">{maxScore}</MetaItem>
            <MetaItem label="Формат сдачи">{submissionType}</MetaItem>
            <MetaItem label="Дата создания">{createdAt}</MetaItem>
            <MetaItem label="Учебные группы">
              {groups.length ? groups.join(', ') : '—'}
            </MetaItem>
            {mode === 'student' && (
              <>
                <MetaItem label="Допустимые форматы">
                  {allowedFormats.length ? allowedFormats.join(', ') : 'Любой'}
                </MetaItem>
                <MetaItem label="Макс. размер файла">{maxFileSize}</MetaItem>
              </>
            )}
          </MetaGrid>
        </section>

        <section className="assignment-details-modal__section">
          <h4>Описание задания</h4>
          <p className="assignment-details-modal__description">{description}</p>
        </section>

        {mode === 'teacher' && stats && (
          <section className="assignment-details-modal__section">
            <h4>Статистика сдачи</h4>
            <div className="assignment-details-modal__stats">
              <StatCard label="Всего сдач" value={stats.total} icon="📦" />
              <StatCard label="Ожидают проверки" value={stats.pending} icon="⏳" />
              <StatCard label="Проверено" value={stats.graded} icon="✅" />
              <StatCard label="Прогресс" value={`${stats.completionRate}%`} icon="📈" />
            </div>
          </section>
        )}

        {criteria.length > 0 && (
          <section className="assignment-details-modal__section">
            <h4>Критерии оценки</h4>
            <ul className="assignment-details-modal__criteria">
              {criteria.map((criterion, index) => (
                <li key={`${criterion.text}-${index}`}>
                  <span className="criterion-marker">•</span>
                  <span className="criterion-text">
                    {criterion.text}{criterion.maxPoints > 0 && ` — ${criterion.maxPoints} баллов`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {extraContent && (
          <section className="assignment-details-modal__section">
            {extraContent}
          </section>
        )}
      </div>
    </Modal>
  );
};

const MetaGrid = ({ children }) => (
  <div className="assignment-details-modal__meta-grid">
    {children}
  </div>
);

const MetaItem = ({ label, children }) => (
  <div className="assignment-details-modal__meta-item">
    <span className="meta-label">{label}</span>
    <span className="meta-value">{children}</span>
  </div>
);

const StatCard = ({ label, value, icon }) => (
  <div className="assignment-details-modal__stat-card">
    <div className="stat-icon">{icon}</div>
    <div>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  </div>
);

const getSubmissionTypeLabel = (type) => {
  switch (type) {
    case 'file':
      return '📎 Файл';
    case 'demo':
      return '🎤 Демонстрация';
    case 'both':
      return '📎 Файл + 🎤 Демонстрация';
    default:
      return '—';
  }
};

const getGroupsList = (assignment) => {
  if (Array.isArray(assignment.studentGroups) && assignment.studentGroups.length) {
    return assignment.studentGroups;
  }
  if (Array.isArray(assignment.groups) && assignment.groups.length) {
    return assignment.groups;
  }
  if (assignment.group) {
    return [assignment.group];
  }
  return [];
};

const normalizeCriteria = (criteria = []) => {
  if (!Array.isArray(criteria)) {
    return [];
  }

  return criteria.map((criterion) => {
    if (typeof criterion === 'string') {
      return { text: criterion, maxPoints: 0 };
    }
    return {
      text: criterion.text || '',
      maxPoints: criterion.maxPoints || 0
    };
  });
};

export default AssignmentDetailsModal;

