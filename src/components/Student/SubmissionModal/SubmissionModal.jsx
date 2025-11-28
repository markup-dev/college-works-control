import React from 'react';
import Button from '../../UI/Button/Button';
import { useNotification } from '../../../context/NotificationContext';
import { formatDate } from '../../../utils';
import './SubmissionModal.scss';

const SubmissionModal = ({ 
  assignment, 
  isOpen, 
  onClose, 
  submissionFile, 
  onFileSelect, 
  onSubmit 
}) => {
  const { showWarning, showError } = useNotification();
  
  if (!isOpen || !assignment) return null;

  const handleSubmit = () => {
    if (assignment.submissionType === 'file') {
      if (!submissionFile) {
        showWarning('Пожалуйста, выберите файл для загрузки');
        return;
      }
      
      const maxFileSize = (assignment.maxFileSize || 50) * 1024 * 1024;
      if (submissionFile.size > maxFileSize) {
        showError(`Файл слишком большой. Максимальный размер: ${assignment.maxFileSize || 50} МБ`);
        return;
      }
      
      if (submissionFile.size === 0) {
        showError('Файл не может быть пустым');
        return;
      }
      
      const allowedFormats = assignment.allowedFormats || ['.pdf', '.docx', '.zip'];
      const fileExtension = '.' + submissionFile.name.split('.').pop()?.toLowerCase();
      if (!allowedFormats.includes(fileExtension)) {
        showError(`Недопустимый формат файла. Разрешены: ${allowedFormats.join(', ')}`);
        return;
      }
      
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(submissionFile.name)) {
        showError('Имя файла содержит недопустимые символы');
        return;
      }
    }
    
    const deadline = new Date(assignment.deadline);
    const now = new Date();
    if (deadline < now) {
      showWarning('Срок сдачи задания истек. Работа может быть не принята.');
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

const FileUpload = ({ assignment, submissionFile, onFileSelect }) => {
  const { showError } = useNotification();
  const allowedFormats = assignment.allowedFormats || ['.pdf', '.docx', '.zip'];
  const maxFileSize = (assignment.maxFileSize || 50) * 1024 * 1024;
  
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > maxFileSize) {
      showError(`Файл слишком большой. Максимальный размер: ${assignment.maxFileSize || 50} МБ`);
      e.target.value = '';
      return;
    }
    
    if (file.size === 0) {
      showError('Файл не может быть пустым');
      e.target.value = '';
      return;
    }
    
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedFormats.includes(fileExtension)) {
      showError(`Недопустимый формат файла. Разрешены: ${allowedFormats.join(', ')}`);
      e.target.value = '';
      return;
    }
    
    onFileSelect(file);
  };
  
  return (
    <div className="file-upload">
      <label className="file-input-label">
        <input
          type="file"
          onChange={handleFileChange}
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

const DemoSubmission = () => (
  <div className="demo-submission">
    <p>Для этого задания требуется личная демонстрация.</p>
    <p>Нажмите кнопку ниже, чтобы сообщить о готовности к демонстрации.</p>
  </div>
);

export default SubmissionModal;