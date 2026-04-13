import React from 'react';
import Button from '../../UI/Button/Button';
import FileDropzone from '../../UI/FileDropzone/FileDropzone';
import { useNotification } from '../../../context/NotificationContext';
import { formatDate, getAllowedFormatsFromAssignment } from '../../../utils';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
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
  const isRetake = assignment?.status === 'returned';
  const canSubmitRetake = assignment?.canSubmitRetake ?? isRetake;
  const canSubmitCurrentAttempt = isRetake ? canSubmitRetake : true;
  const submitButtonLabel = isRetake
    ? (assignment?.submissionType === 'demo' ? 'Сообщить о готовности к пересдаче' : 'Пересдать работу')
    : (assignment?.submissionType === 'demo' ? 'Сообщить о готовности' : 'Сдать работу');

  useBodyScrollLock(isOpen);
  
  if (!isOpen || !assignment) return null;

  const handleSubmit = () => {
    if (!canSubmitCurrentAttempt) {
      showError('Сдача недоступна: пересдача уже использована или задание закрыто для отправки.');
      return;
    }

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
      
      const allowedFormats = getAllowedFormatsFromAssignment(assignment);
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
    if (deadline < now && !isRetake) {
      showWarning('Срок сдачи задания истек. Работа может быть не принята.');
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay student-submission-modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isRetake ? 'Пересдача работы' : 'Сдача работы'}: {assignment.title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {assignment.submissionType === 'demo' && (
            <div className="submission-status-note">
              <span className="submission-status-note__badge">Демонстрация</span>
              <p className="submission-status-note__text">
                После отправки будет создана заявка о готовности к демонстрации. Файл прикладывать не нужно.
              </p>
            </div>
          )}
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
            disabled={!canSubmitCurrentAttempt || (assignment.submissionType === 'file' && !submissionFile)}
          >
            {submitButtonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

const SubmissionInfo = ({ assignment }) => {
  const allowedFormats = getAllowedFormatsFromAssignment(assignment);
  const maxFileSize = assignment.maxFileSize || 50;
  
  return (
    <div className="submission-info">
      <div className="submission-info__row">
        <span className="submission-info__label">Предмет</span>
        <span className="submission-info__value">{assignment.subject}</span>
      </div>
      <div className="submission-info__row">
        <span className="submission-info__label">Преподаватель</span>
        <span className="submission-info__value">{assignment.teacher}</span>
      </div>
      <div className="submission-info__row">
        <span className="submission-info__label">Формат сдачи</span>
        <span className="submission-info__value">{assignment.submissionType === 'file' ? 'Файл' : 'Демонстрация'}</span>
      </div>
      <div className="submission-info__row">
        <span className="submission-info__label">Срок сдачи</span>
        <span className="submission-info__value">{formatDate(assignment.deadline)}</span>
      </div>
      
      {assignment.submissionType === 'file' && (
        <>
          <div className="submission-info__row">
            <span className="submission-info__label">Допустимые форматы</span>
            <span className="submission-info__value">{allowedFormats.join(', ')}</span>
          </div>
          <div className="submission-info__row">
            <span className="submission-info__label">Максимальный размер</span>
            <span className="submission-info__value">{maxFileSize} МБ</span>
          </div>
        </>
      )}
    </div>
  );
};

const FileUpload = ({ assignment, submissionFile, onFileSelect }) => {
  const { showError } = useNotification();
  const allowedFormats = getAllowedFormatsFromAssignment(assignment);
  const maxFileSize = (assignment.maxFileSize || 50) * 1024 * 1024;
  
  const handleFileChange = (files = []) => {
    const file = files[0];
    if (!file) return;
    
    if (file.size > maxFileSize) {
      showError(`Файл слишком большой. Максимальный размер: ${assignment.maxFileSize || 50} МБ`);
      return;
    }
    
    if (file.size === 0) {
      showError('Файл не может быть пустым');
      return;
    }
    
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedFormats.includes(fileExtension)) {
      showError(`Недопустимый формат файла. Разрешены: ${allowedFormats.join(', ')}`);
      return;
    }
    
    onFileSelect(file);
  };
  
  return (
    <div className="file-upload">
      <FileDropzone
        accept={allowedFormats.join(',')}
        buttonText="Выбрать файл"
        hint="Поддерживаются только допустимые форматы из списка выше."
        selectedFiles={submissionFile ? [submissionFile] : []}
        showSelectedFiles={false}
        onFilesSelected={handleFileChange}
      />
      {submissionFile && (
        <div className="file-info">
          <span>{submissionFile.name}</span>
          <span>{(submissionFile.size / 1024 / 1024).toFixed(2)} МБ</span>
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