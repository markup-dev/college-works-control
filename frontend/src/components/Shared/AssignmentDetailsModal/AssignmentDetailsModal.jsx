import React from 'react';
import Modal from '../../UI/Modal/Modal';
import Button from '../../UI/Button/Button';
import { 
  formatDate, 
  getAssignmentStatusInfo, 
  getDaysUntilDeadline,
  getAllowedFormatsFromAssignment,
} from '../../../utils';
import './AssignmentDetailsModal.scss';

const resolveMaterialFiles = (assignment) => {
  const directFiles = Array.isArray(assignment?.materialFiles) ? assignment.materialFiles : [];
  const relationFiles = Array.isArray(assignment?.materialItems) ? assignment.materialItems : [];

  return [...directFiles, ...relationFiles]
    .map((file) => ({
      id: file?.id,
      fileName: file?.fileName || file?.file_name || '',
      fileSize: file?.fileSize || file?.file_size || '',
    }))
    .filter((file) => file.id && file.fileName)
    .filter((file, index, array) => array.findIndex((item) => item.id === file.id) === index);
};

const AssignmentDetailsModal = ({
  assignment,
  isOpen,
  onClose,
  mode = 'student',
  stats = null,
  extraContent = null,
  onEdit = null,
  onDownloadMaterial = null,
  onSubmitWork = null,
  onViewResults = null,
  onResubmit = null,
  onViewSubmissions = null,
}) => {
  if (!assignment) {
    return null;
  }

  const statusInfo = getAssignmentStatusInfo(assignment);
  const deadline = assignment.deadline ? formatDate(assignment.deadline) : '—';
  const createdAt = assignment.createdAt ? formatDate(assignment.createdAt) : '—';
  const updatedAtRaw = assignment.updatedAt || assignment.updated_at || null;
  const updatedAt = updatedAtRaw ? formatDate(updatedAtRaw) : '';
  const maxScore = assignment.maxScore ?? '—';
  const submissionType = getSubmissionTypeLabel(assignment.submissionType);
  const allowedFormats = getAllowedFormatsFromAssignment(assignment);
  const groups = getGroupsList(assignment);
  const description = assignment.description || 'Описание отсутствует';
  const criteria = normalizeCriteria(assignment.criteria);
  const maxFileSize = assignment.maxFileSize ? `${assignment.maxFileSize} МБ` : '50 МБ';
  const daysUntilDeadline = assignment.deadline ? getDaysUntilDeadline(assignment.deadline) : null;
  const materialFiles = resolveMaterialFiles(assignment);
  const canSubmitRetake = assignment?.canSubmitRetake ?? (assignment?.status === 'returned');
  const retakeUsed = Boolean(assignment?.retakeUsed);
  const isRetakeAssignment = assignment?.status === 'returned' || canSubmitRetake || retakeUsed;
  const isOverdue = typeof daysUntilDeadline === 'number'
    && daysUntilDeadline < 0
    && assignment?.status === 'not_submitted';
  const isUrgent = typeof daysUntilDeadline === 'number'
    && daysUntilDeadline >= 0
    && daysUntilDeadline <= 3
    && assignment?.status === 'not_submitted';

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
            <p className="assignment-details-modal__subject">{assignment.subject}</p>
            <h3 className="assignment-details-modal__title">{assignment.title}</h3>
            {mode === 'student' && (
              <p className="assignment-details-modal__teacher">
                {assignment.teacherName || assignment.teacher || assignment.teacherLogin || '—'}
              </p>
            )}
          </div>
          <div className="assignment-details-modal__badges">
            <span className={`status-badge status-badge--${statusInfo.variant}`}>
              {statusInfo.label}
            </span>
            {mode === 'student' && isRetakeAssignment && (
              <span className={`retake-badge ${retakeUsed ? 'retake-badge--used' : ''}`}>
                {retakeUsed ? 'Пересдача использована' : 'Пересдача'}
              </span>
            )}
          </div>
        </header>

        <section className="assignment-details-modal__section">
          <MetaGrid>
            <MetaItem label="Дата создания" icon="calendar">
              {createdAt}
            </MetaItem>
            <MetaItem label="Дедлайн" icon="deadline">
              <div className="meta-deadline">
                <span>{deadline}</span>
                {mode === 'student' && typeof daysUntilDeadline === 'number' && (
                  <span className={`deadline-indicator ${daysUntilDeadline < 0 ? 'deadline-indicator--overdue' : daysUntilDeadline <= 3 ? 'deadline-indicator--urgent' : ''}`}>
                    {daysUntilDeadline < 0 
                      ? `Просрочено на ${Math.abs(daysUntilDeadline)} д.` 
                      : `Осталось ${daysUntilDeadline} д.`}
                  </span>
                )}
              </div>
            </MetaItem>
            <MetaItem label="Максимальный балл" icon="score">{maxScore}</MetaItem>
            <MetaItem label="Формат сдачи" icon="format">{submissionType}</MetaItem>
            {mode !== 'student' && (
              <MetaItem label="Допустимые форматы" icon="format">
                {submissionType === 'Файл' ? allowedFormats.join(', ') : 'Не требуется'}
              </MetaItem>
            )}
            {mode !== 'student' && (
              <MetaItem label="Учебные группы" icon="group">
                {groups.length ? (
                  <div className="group-chips">
                    {groups.map((group) => (
                      <span className="group-chip" key={group}>{group}</span>
                    ))}
                  </div>
                ) : '—'}
              </MetaItem>
            )}
            {mode === 'student' && (
              <>
                <MetaItem label="Допустимые форматы" icon="format">
                  {submissionType === 'Файл' ? allowedFormats.join(', ') : 'Не требуется'}
                </MetaItem>
                {submissionType === 'Файл' && (
                  <MetaItem label="Макс. размер файла" icon="size">{maxFileSize}</MetaItem>
                )}
              </>
            )}
          </MetaGrid>
          {updatedAt && (
            <p className="assignment-details-modal__meta-updated">Обновлено: {updatedAt}</p>
          )}
        </section>

        <section className="assignment-details-modal__section">
          <h4>Описание задания</h4>
          <p className="assignment-details-modal__description">{description}</p>
        </section>

        {materialFiles.length > 0 && (
          <section className="assignment-details-modal__section">
            <h4>Материалы от преподавателя</h4>
            <div className="assignment-details-modal__materials">
              {materialFiles.map((file) => (
                <button
                  type="button"
                  key={file.id}
                  className="assignment-details-modal__material"
                  disabled={typeof onDownloadMaterial !== 'function'}
                  onClick={() => onDownloadMaterial && onDownloadMaterial(assignment, file)}
                >
                  <span className="material-name">{file.fileName}</span>
                  {file.fileSize && <span className="material-size">{file.fileSize}</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {mode === 'teacher' && stats && (
          <section className="assignment-details-modal__section">
            <h4>Статистика сдачи</h4>
            <div className="assignment-details-modal__stats">
              <StatCard label="Сдали из группы" value={`${stats.submitted}/${stats.total}`} tone="total" />
              <StatCard label="Ожидают проверки" value={stats.pending} tone="pending" />
              <StatCard label="Проверено" value={stats.graded} tone="graded" />
            </div>
            <SubmissionProgress stats={stats} />
          </section>
        )}

        {criteria.length > 0 && (
          <section className="assignment-details-modal__section">
            <h4>Критерии оценки</h4>
            <ul className="assignment-details-modal__criteria">
              {criteria.map((criterion, index) => (
                <li key={`${criterion.text}-${index}`}>
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

        {mode === 'student' && (
          <div className="assignment-details-modal__actions">
            {renderStudentActions({
              assignment,
              isOverdue,
              isUrgent,
              canSubmitRetake,
              retakeUsed,
              onSubmitWork,
              onViewResults,
              onResubmit,
            })}
          </div>
        )}

        {mode === 'teacher' && (typeof onEdit === 'function' || typeof onViewSubmissions === 'function') && (
          <div className="assignment-details-modal__actions">
            <div className="assignment-details-modal__actions-group">
              {typeof onViewSubmissions === 'function' && (
                <Button
                  variant="secondary"
                  onClick={() => onViewSubmissions(assignment)}
                >
                  Просмотреть работы
                </Button>
              )}
              {typeof onEdit === 'function' && (
                <Button
                  variant="primary"
                  onClick={() => onEdit(assignment)}
                >
                  Редактировать задание
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

const renderStudentActions = ({
  assignment,
  isOverdue,
  isUrgent,
  canSubmitRetake,
  retakeUsed,
  onSubmitWork,
  onViewResults,
  onResubmit,
}) => {
  switch (assignment?.status) {
    case 'not_submitted':
      if (assignment?.is_completed) {
        return (
          <Button variant="secondary" disabled>
            Приём работ завершён
          </Button>
        );
      }
      return (
        <Button
          variant={isOverdue ? 'danger' : 'primary'}
          className={isUrgent && !isOverdue ? 'assignment-submit-btn--urgent' : ''}
          onClick={() => typeof onSubmitWork === 'function' && onSubmitWork(assignment)}
          disabled={typeof onSubmitWork !== 'function'}
        >
          {isOverdue
            ? (assignment?.submissionType === 'demo' ? 'Сообщить о готовности (просрочено)' : 'Сдать просроченную работу')
            : (assignment?.submissionType === 'demo' ? 'Сообщить о готовности' : 'Сдать работу')}
        </Button>
      );
    case 'submitted':
      return (
        <Button variant="secondary" disabled>
          Ожидает проверки
        </Button>
      );
    case 'graded':
      return (
        <Button
          variant="success"
          onClick={() => typeof onViewResults === 'function' && onViewResults(assignment)}
          disabled={typeof onViewResults !== 'function'}
        >
          Результаты
        </Button>
      );
    case 'returned':
      if (!canSubmitRetake) {
        return (
          <div className="assignment-details-modal__actions-group">
            <Button variant="secondary" disabled>
              {retakeUsed ? 'Пересдача использована' : 'Пересдача недоступна'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => typeof onViewResults === 'function' && onViewResults(assignment)}
              disabled={typeof onViewResults !== 'function'}
            >
              Комментарий
            </Button>
          </div>
        );
      }
      return (
        <div className="assignment-details-modal__actions-group">
          <Button
            variant="warning"
            onClick={() => typeof onResubmit === 'function' && onResubmit(assignment)}
            disabled={typeof onResubmit !== 'function'}
          >
            Пересдать
          </Button>
          <Button
            variant="secondary"
            onClick={() => typeof onViewResults === 'function' && onViewResults(assignment)}
            disabled={typeof onViewResults !== 'function'}
          >
            Комментарий
          </Button>
        </div>
      );
    default:
      return null;
  }
};

const MetaGrid = ({ children }) => (
  <div className="assignment-details-modal__meta-grid">
    {children}
  </div>
);

const MetaItem = ({ label, icon, children }) => (
  <div className="assignment-details-modal__meta-item">
    <div className="meta-label">
      <MetaIcon name={icon} />
      <span>{label}</span>
    </div>
    <div className="meta-value">{children}</div>
  </div>
);

const MetaIcon = ({ name }) => {
  const icons = {
    calendar: (
      <path d="M7 3v2M17 3v2M4 9h16M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    ),
    deadline: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </>
    ),
    score: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 14h8M8 10h4" />
      </>
    ),
    format: (
      <>
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M14 3v5h5" />
      </>
    ),
    group: (
      <>
        <circle cx="9" cy="10" r="3" />
        <circle cx="16.5" cy="11.5" r="2.5" />
        <path d="M4 20c.5-3 2.8-5 5-5s4.5 2 5 5M13.5 20c.4-2 1.8-3.5 3.7-4" />
      </>
    ),
    size: (
      <>
        <path d="M4 12h16" />
        <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" />
      </>
    ),
  };

  if (!icons[name]) return null;

  return (
    <span className="meta-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {icons[name]}
      </svg>
    </span>
  );
};

const StatCard = ({ label, value, tone = 'total' }) => (
  <div className={`assignment-details-modal__stat-card assignment-details-modal__stat-card--${tone}`}>
    <span className="stat-accent" aria-hidden="true"></span>
    <div>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  </div>
);

const SubmissionProgress = ({ stats }) => (
  <div className="assignment-details-modal__progress">
    <div className="progress-header">
      <span className="progress-title">Прогресс сдачи:</span>
      <span className="completion-rate">{stats.completionRate}%</span>
    </div>

    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${stats.completionRate}%` }}></div>
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
);

const getSubmissionTypeLabel = (type) => {
  switch (type) {
    case 'file':
      return 'Файл';
    case 'demo':
      return 'Демонстрация';
    case 'both':
      return 'Файл + Демонстрация';
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

