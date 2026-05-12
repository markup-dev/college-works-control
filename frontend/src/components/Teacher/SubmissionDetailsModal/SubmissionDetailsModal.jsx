import React from 'react';
import Button from '../../UI/Button/Button';
import Modal from '../../UI/Modal/Modal';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import { formatDate, formatFileSize } from '../../../utils';
import './SubmissionDetailsModal.scss';

const SubmissionDetailsModal = ({ 
  submission, 
  assignment,
  isOpen, 
  onClose,
  onDownload,
  onGrade,
  onReturn
}) => {
  if (!isOpen || !submission) return null;

  const maxScore = assignment?.maxScore || submission.maxScore || 100;
  const gradeLabel = submission.gradeLabel || submission.grade_label || null;
  const effectiveSubmissionType = assignment?.submissionType || submission.submissionType || 'file';
  const isDemoSubmission = effectiveSubmissionType === 'demo';
  const statusInfo = {
    submitted: { label: 'На проверке', variant: 'warning' },
    graded: { label: 'Зачтена', variant: 'success' },
    returned: { label: 'Возвращена', variant: 'danger' }
  }[submission.status] || { label: 'На проверке', variant: 'warning' };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Детали работы"
      subtitle={submission.assignmentTitle || assignment?.title || 'Задание'}
      size="large"
      className="teacher-submission-details-modal"
      contentClassName="teacher-submission-details-modal__body"
      footer={(
        <div className="teacher-submission-details-modal__actions">
          {submission.status === 'submitted' && !submission.isResubmission && (
            <Button
              variant="warning"
              onClick={() => {
                onClose();
                onReturn?.(submission);
              }}
            >
              Отправить на доработку
            </Button>
          )}
          {submission.status === 'submitted' && (
            <Button
              variant="primary"
              onClick={() => {
                onGrade?.(submission);
              }}
            >
              Оценить работу
            </Button>
          )}
          {submission.status === 'graded' && (
            <Button
              variant="primary"
              onClick={() => {
                onGrade?.(submission);
              }}
            >
              Изменить оценку
            </Button>
          )}
          {submission.status === 'returned' && (
            <p className="teacher-submission-details-modal__actions-hint">
              Работа у студента на доработке. Оценить можно только после новой сдачи файла.
            </p>
          )}
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      )}
    >
          <div className="details-overview">
            <StatusBadge tone={statusInfo.variant}>
              {statusInfo.label}
            </StatusBadge>
            {submission.submissionDate && (
              <span className="details-overview__meta">
                Сдано: {formatDate(submission.submissionDate)}
              </span>
            )}
            {submission.isResubmission && (
              <StatusBadge tone="default">
                Пересдача
              </StatusBadge>
            )}
          </div>

          <div className="details-section">
            <h4 className="section-title">Задание</h4>
            <div className="info-grid">
              <div className="info-item">
                <strong>Название:</strong>
                <span>{submission.assignmentTitle || assignment?.title || 'Не указано'}</span>
              </div>
              {assignment?.subject && (
                <div className="info-item">
                  <strong>Предмет:</strong>
                  <span>{assignment.subject}</span>
                </div>
              )}
              {assignment?.deadline && (
                <div className="info-item">
                  <strong>Срок сдачи:</strong>
                  <span>{formatDate(assignment.deadline)}</span>
                </div>
              )}
              <div className="info-item">
                <strong>Максимальный балл:</strong>
                <span>{maxScore}</span>
              </div>
            </div>
          </div>

          <div className="details-section">
            <h4 className="section-title">Студент</h4>
            <div className="info-grid">
              <div className="info-item">
                <strong>ФИО:</strong>
                <span>{submission.studentName}</span>
              </div>
              {submission.group && (
                <div className="info-item">
                  <strong>Группа:</strong>
                  <span className="group-badge">{submission.group}</span>
                </div>
              )}
            </div>
          </div>

          <div className="details-section">
            <h4 className="section-title">Работа</h4>
            <div className="info-grid">
              <div className="info-item">
                <strong>Дата сдачи:</strong>
                <span>{submission.submissionDate ? formatDate(submission.submissionDate) : 'Дата не указана'}</span>
              </div>
              <div className="info-item">
                <strong>Статус:</strong>
                <div className="submission-status-stack">
                  <StatusBadge tone={statusInfo.variant}>
                    {statusInfo.label}
                  </StatusBadge>
                  {submission.isResubmission && (
                    <StatusBadge tone="default">
                      Пересдача
                    </StatusBadge>
                  )}
                </div>
              </div>
              {submission.fileName ? (
                <div className="info-item file-info-item">
                  <strong>Файл:</strong>
                  <button
                    type="button"
                    className="file-details file-details--clickable"
                    onClick={() => onDownload?.(submission)}
                    title="Скачать файл"
                  >
                    <span className="file-name">{submission.fileName}</span>
                    {submission.fileSize && (
                      <span className="file-size">{formatFileSize(submission.fileSize)}</span>
                    )}
                  </button>
                </div>
              ) : isDemoSubmission ? (
                <div className="info-item file-info-item">
                  <strong>Формат сдачи:</strong>
                  <span>Демонстрация (файл не требуется)</span>
                </div>
              ) : null}
            </div>
          </div>

          {(submission.score !== null && submission.score !== undefined) && (
            <div className="details-section">
              <h4 className="section-title">Оценка</h4>
              <div className="score-display-large">
                <span className="score-value">{submission.score}</span>
                <span className="score-separator">/</span>
                <span className="score-max">{maxScore}</span>
                {gradeLabel && (
                  <span className="score-grade-label">
                    оценка {gradeLabel}
                  </span>
                )}
              </div>
              {(submission.teacherComment || submission.comment) && (
                <div className="comment-section">
                  <strong>Комментарий преподавателя:</strong>
                  <div className="comment-text">{submission.teacherComment || submission.comment}</div>
                </div>
              )}
            </div>
          )}

          {submission.status === 'returned' && submission.teacherComment && (
            <div className="details-section details-section--notice">
              <h4 className="section-title">Комментарий при возврате</h4>
              <div className="submission-return-comment">{submission.teacherComment}</div>
            </div>
          )}

          {assignment?.description && (
            <div className="details-section">
              <h4 className="section-title">Описание задания</h4>
              <div className="description-text">{assignment.description}</div>
            </div>
          )}

          {assignment?.criteria && assignment.criteria.length > 0 && (
            <div className="details-section">
              <h4 className="section-title">Критерии оценки</h4>
              <ul className="criteria-list">
                {assignment.criteria.map((criterion, index) => {
                  const text = typeof criterion === 'string' ? criterion : criterion.text;
                  const points = typeof criterion === 'object' ? criterion.maxPoints : 0;
                  return (
                    <li key={index} className="criterion-item">
                      <span className="criterion-text">
                        {text}{points > 0 && ` — ${points} баллов`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
    </Modal>
  );
};

export default SubmissionDetailsModal;

