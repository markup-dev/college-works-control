import React from 'react';
import Button from '../../UI/Button/Button';
import { useNotification } from '../../../context/NotificationContext';
import { formatDate } from '../../../utils/assignmentHelpers';
import './SubmissionModal.scss';

const SubmissionModal = ({ 
  assignment, 
  isOpen, 
  onClose, 
  submissionFile, 
  onFileSelect, 
  onSubmit 
}) => {
  const { showWarning } = useNotification();
  
  if (!isOpen || !assignment) return null;

  const handleSubmit = () => {
    if (assignment.submissionType === 'file' && !submissionFile) {
      showWarning('Пожалуйста, выберите файл для загрузки');
      return;
    }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Сдача работы: {assignment.title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <SubmissionInfo assignment={assignment} />
          
          {assignment.submissionType === 'file' ? (
            <FileUpload 
              assignment={assignment}
              submissionFile={submissionFile}
              onFileSelect={onFileSelect}
            />
          ) : (
            <DemoSubmission />
          )}
        </div>
        
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            variant="primary"
            onClick={handleSubmit}
            disabled={assignment.submissionType === 'file' && !submissionFile}
          >
            📤 Сдать работу
          </Button>
        </div>
      </div>
    </div>
  );
};

// Компонент информации о задании
const SubmissionInfo = ({ assignment }) => {
  const allowedFormats = assignment.allowedFormats || ['.pdf', '.docx', '.zip'];
  const maxFileSize = assignment.maxFileSize || 50;
  
  return (
    <div className="submission-info">
      <p><strong>Дисциплина:</strong> {assignment.course}</p>
      <p><strong>Преподаватель:</strong> {assignment.teacher}</p>
      <p><strong>Формат сдачи:</strong> {assignment.submissionType === 'file' ? 'Файл' : 'Демонстрация'}</p>
      <p><strong>Срок сдачи:</strong> {formatDate(assignment.deadline)}</p>
      
      {assignment.submissionType === 'file' && (
        <>
          <p><strong>Допустимые форматы:</strong> {allowedFormats.join(', ')}</p>
          <p><strong>Максимальный размер:</strong> {maxFileSize} МБ</p>
        </>
      )}
    </div>
  );
};

// Компонент загрузки файла
const FileUpload = ({ assignment, submissionFile, onFileSelect }) => {
  const allowedFormats = assignment.allowedFormats || ['.pdf', '.docx', '.zip'];
  
  return (
    <div className="file-upload">
      <label className="file-input-label">
        <input
          type="file"
          onChange={onFileSelect}
          accept={allowedFormats.join(',')}
        />
        <span className="file-input-button">📎 Выберите файл</span>
      </label>
      {submissionFile && (
        <div className="file-info">
          <span>📄 {submissionFile.name}</span>
          <span>📏 {(submissionFile.size / 1024 / 1024).toFixed(2)} МБ</span>
        </div>
      )}
    </div>
  );
};

// Компонент для демонстрации
const DemoSubmission = () => (
  <div className="demo-submission">
    <p>Для этого задания требуется личная демонстрация.</p>
    <p>Свяжитесь с преподавателем для согласования времени.</p>
  </div>
);

export default SubmissionModal;