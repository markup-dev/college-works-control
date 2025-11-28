export const getAssignmentStatusInfo = (assignmentOrStatus) => {
  const status = typeof assignmentOrStatus === 'string' 
    ? assignmentOrStatus 
    : assignmentOrStatus?.status;
  
  const statusMap = {
    'not_submitted': { label: 'Не сдано', variant: 'danger', icon: '⏳' },
    'submitted': { label: 'На проверке', variant: 'warning', icon: '📋' },
    'graded': { label: 'Оценено', variant: 'success', icon: '✅' },
    'returned': { label: 'Возвращено', variant: 'danger', icon: '↩️' },
    'active': { label: 'Активно', variant: 'success', icon: '🟢' },
    'inactive': { label: 'Неактивно', variant: 'danger', icon: '🔴' }
  };
  
  return statusMap[status] || statusMap['not_submitted'];
};

export const getPriorityInfo = (priority) => {
  const priorityMap = {
    'high': { label: 'Высокий', color: '#dc3545', icon: '🔴' },
    'medium': { label: 'Средний', color: '#ffc107', icon: '🟡' },
    'low': { label: 'Низкий', color: '#28a745', icon: '🟢' }
  };
  
  return priorityMap[priority] || priorityMap['medium'];
};

export const getDaysUntilDeadlineWithColor = (deadline) => {
  const days = getDaysUntilDeadline(deadline);
  
  if (days === null) return { days: '—', color: '#6c757d' };
  if (days < 0) return { days: 'Просрочено', color: '#dc3545' };
  if (days === 0) return { days: 'Сегодня', color: '#fd7e14' };
  if (days <= 3) return { days: `${days} дня`, color: '#ffc107' };
  
  return { days: `${days} дней`, color: '#28a745' };
};

export const getDaysUntilDeadline = (deadline) => {
  if (!deadline) return null;
  
  try {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    
    if (isNaN(deadlineDate.getTime())) return null;
    
    const diffTime = deadlineDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    return null;
  }
};

export const assignmentFilters = [
  { key: 'all', label: 'Все задания', icon: '📚' },
  { key: 'not_submitted', label: 'Не сданы', icon: '⏳' },
  { key: 'submitted', label: 'На проверке', icon: '📋' },
  { key: 'graded', label: 'Оцененные', icon: '✅' },
  { key: 'returned', label: 'Возвращенные', icon: '↩️' },
  { key: 'urgent', label: 'Срочные', icon: '🔥' }
];

export const teacherAssignmentFilters = [
  { key: 'all', label: 'Все задания', icon: '📚' },
  { key: 'active', label: 'Активные', icon: '🟢' },
  { key: 'inactive', label: 'Неактивные', icon: '🔴' },
  { key: 'with_submissions', label: 'С работами', icon: '📋' },
  { key: 'without_submissions', label: 'Без работ', icon: '⏳' }
];