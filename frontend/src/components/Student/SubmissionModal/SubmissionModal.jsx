import React, { useEffect, useState } from 'react';
import Button from '../../UI/Button/Button';
import FileDropzone from '../../UI/FileDropzone/FileDropzone';
import Modal from '../../UI/Modal/Modal';
import { useNotification } from '../../../context/NotificationContext';
import { formatDate, getAllowedFormatsFromAssignment } from '../../../utils';
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
  const [submitting, setSubmitting] = useState(false);
  const isRetake = assignment?.status === 'returned';
  const canSubmitRetake = assignment?.canSubmitRetake ?? isRetake;
  const canSubmitCurrentAttempt = isRetake ? canSubmitRetake : true;
  const submitButtonLabel = isRetake
    ? (assignment?.submissionType === 'demo' ? 'Сообщить о готовности к пересдаче' : 'Пересдать работу')
    : (assignment?.submissionType === 'demo' ? 'Сообщить о готовности' : 'Сдать работу');

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
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

    setSubmitting(true);
    try {
      await Promise.resolve(onSubmit?.());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${isRetake ? 'Пересдача работы' : 'Сдача работы'}: ${assignment.title}`}
      size="medium"
      className="student-submission-modal"
      contentClassName="student-submission-modal__body"
      footer={(
        <div className="student-submission-modal__actions">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={
              submitting ||
              !canSubmitCurrentAttempt ||
              (assignment.submissionType === 'file' && !submissionFile)
            }
          >
            {submitButtonLabel}
          </Button>
        </div>
      )}
    >
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
    </Modal>
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
        hint="Форматы файлов — в списке выше."
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