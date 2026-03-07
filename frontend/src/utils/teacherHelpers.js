export const formatDate = (dateString) => {
  if (!dateString) return 'Дата не указана';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Неверная дата';
    
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch (error) {
    return 'Неверная дата';
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'Дата не указана';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Неверная дата';
    
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    return 'Неверная дата';
  }
};


export const getSubmissionStatusInfo = (status) => {
  const statusMap = {
    'submitted': { label: 'На проверке', variant: 'warning', icon: '📋' },
    'graded': { label: 'Зачтена', variant: 'success', icon: '✅' },
    'returned': { label: 'Возвращена', variant: 'danger', icon: '↩️' },
    'draft': { label: 'Черновик', variant: 'default', icon: '📝' }
  };
  
  return statusMap[status] || { label: status, variant: 'default', icon: '❓' };
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  if (typeof bytes === 'string') {
    return bytes;
  }
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const validateScore = (score, maxScore = 100) => {
  if (score === null || score === undefined || score === '') {
    return { isValid: false, error: 'Оценка обязательна' };
  }
  
  const numScore = Number(score);
  
  if (isNaN(numScore)) {
    return { isValid: false, error: 'Оценка должна быть числом' };
  }
  
  if (!Number.isInteger(numScore)) {
    return { isValid: false, error: 'Оценка должна быть целым числом' };
  }
  
  if (numScore < 0) {
    return { isValid: false, error: 'Оценка не может быть отрицательной' };
  }
  
  if (numScore > maxScore) {
    return { isValid: false, error: `Оценка не может превышать ${maxScore} баллов` };
  }
  
  return { isValid: true };
};

export const validateGradingComment = (comment) => {
  if (!comment || typeof comment !== 'string') {
    return { isValid: true };
  }
  
  const trimmedComment = comment.trim();
  
  if (trimmedComment.length > 2000) {
    return { isValid: false, error: 'Комментарий не должен превышать 2000 символов' };
  }
  
  return { isValid: true };
};

export const generateDownloadFileName = (submission) => {
  const studentName = submission.studentName?.replace(/\s+/g, '_') || 'student';
  const assignmentTitle = submission.assignmentTitle?.replace(/\s+/g, '_') || 'assignment';
  const extension = submission.fileName?.split('.').pop() || 'zip';
  
  return `${studentName}_${assignmentTitle}.${extension}`;
};

export const calculateSubmissionStats = (submissions = []) => {
  const total = submissions.length;
  const submitted = submissions.filter(s => s.status === 'submitted').length;
  const graded = submissions.filter(s => s.status === 'graded').length;
  const returned = submissions.filter(s => s.status === 'returned').length;
  const pending = submissions.filter(s => s.status === 'submitted').length;

  const completionRate = total > 0 ? Math.round((submitted / total) * 100) : 0;

  return {
    total,
    submitted,
    graded,
    returned,
    pending,
    completionRate
  };
};