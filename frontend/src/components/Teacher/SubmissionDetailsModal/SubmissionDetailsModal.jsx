import React from 'react';
import Button from '../../UI/Button/Button';
import { formatDate, formatFileSize } from '../../../utils';
import './SubmissionDetailsModal.scss';

const SubmissionDetailsModal = ({ 
  submission, 
  assignment,
  isOpen, 
  onClose,
  onDownload,
  onGrade
}) => {
  if (!isOpen || !submission) return null;

  const maxScore = assignment?.maxScore || submission.maxScore || 100;
  const statusInfo = {
    'submitted': { label: 'На проверке', variant: 'warning', icon: '📋' },
    'graded': { label: 'Зачтена', variant: 'success', icon: '✅' },
    'returned': { label: 'Возвращена', variant: 'danger', icon: '↩️' }
  }[submission.status] || { label: 'На проверке', variant: 'warning', icon: '📋' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content submission-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Детали работы</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="details-section">
            <h4 className="section-title">📝 Задание</h4>
            <div className="info-grid">
              <div className="info-item">
                <strong>Название:</strong>
                <span>{submission.assignmentTitle || assignment?.title || 'Не указано'}</span>
              </div>
              {assignment?.course && (
                <div className="info-item">
                  <strong>Дисциплина:</strong>
                  <span>{assignment.course}</span>
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
            <h4 className="section-title">👨‍🎓 Студент</h4>
            <div className="info-grid">
              <div className="info-item">
                <strong>ФИО:</strong>
                <span>{submission.studentName}</span>
              </div>
              {submission.studentId && (
                <div className="info-item">
                  <strong>ID студента:</strong>
                  <span>{submission.studentId}</span>
                </div>
              )}
              {submission.group && (
                <div className="info-item">
                  <strong>Группа:</strong>
                  <span className="group-badge">{submission.group}</span>
                </div>
              )}
            </div>
          </div>

          <div className="details-section">
            <h4 className="section-title">📄 Работа</h4>
            <div className="info-grid">
              <div className="info-item">
                <strong>Дата сдачи:</strong>
                <span>{formatDate(submission.submissionDate)}</span>
              </div>
              <div className="info-item">
                <strong>Статус:</strong>
                <span className={`status-badge status-badge--${statusInfo.variant}`}>
                  {statusInfo.icon} {statusInfo.label}
                </span>
              </div>
              {submission.fileName && (
                <div className="info-item file-info-item">
                  <strong>Файл:</strong>
                  <div className="file-details">
                    <span className="file-name">📄 {submission.fileName}</span>
                    {submission.fileSize && (
                      <span className="file-size">{formatFileSize(submission.fileSize)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {(submission.score !== null && submission.score !== undefined) && (
            <div className="details-section">
              <h4 className="section-title">✅ Оценка</h4>
              <div className="score-display-large">
                <span className="score-value">{submission.score}</span>
                <span className="score-separator">/</span>
                <span className="score-max">{maxScore}</span>
              </div>
              {submission.comment && (
                <div className="comment-section">
                  <strong>Комментарий преподавателя:</strong>
                  <div className="comment-text">{submission.comment}</div>
                </div>
              )}
            </div>
          )}

          {assignment?.description && (
            <div className="details-section">
              <h4 className="section-title">📋 Описание задания</h4>
              <div className="description-text">{assignment.description}</div>
            </div>
          )}

          {assignment?.criteria && assignment.criteria.length > 0 && (
            <div className="details-section">
              <h4 className="section-title">📊 Критерии оценки</h4>
              <ul className="criteria-list">
                {assignment.criteria.map((criterion, index) => (
                  <li key={index} className="criterion-item">
                    <span className="criterion-marker">•</span>
                    <span className="criterion-text">{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          {submission.fileName && onDownload && (
            <Button 
              variant="outline" 
              onClick={() => {
                onDownload(submission);
                onClose();
              }}
              icon="📥"
            >
              Скачать файл
            </Button>
          )}
          {submission.status === 'submitted' ? (
            <Button 
              variant="primary" 
              onClick={() => {
                onClose();
                onGrade?.(submission);
              }}
              icon="✅"
            >
              Оценить работу
            </Button>
          ) : (
            <Button 
              variant="primary" 
              onClick={() => {
                onClose();
                onGrade?.(submission);
              }}
              icon="✏️"
            >
              Изменить оценку
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionDetailsModal;

