export const getAssignmentStatusInfo = (assignmentOrStatus) => {
  const status = typeof assignmentOrStatus === 'string' 
    ? assignmentOrStatus 
    : assignmentOrStatus?.status;
  
  const statusMap = {
    'not_submitted': { label: 'Не сдано', variant: 'danger', icon: '' },
    'submitted': { label: 'На проверке', variant: 'warning', icon: '' },
    'graded': { label: 'Оценено', variant: 'success', icon: '' },
    'returned': { label: 'Возвращено', variant: 'danger', icon: '' },
    'active': { label: 'Активно', variant: 'success', icon: '' },
    'inactive': { label: 'Неактивно', variant: 'danger', icon: '' },
    'archived': { label: 'Завершено', variant: 'completed', icon: '' },
    'draft': { label: 'Черновик', variant: 'default', icon: '' }
  };
  
  return statusMap[status] || statusMap['not_submitted'];
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
  { key: 'all', label: 'Все задания', icon: '' },
  { key: 'not_submitted', label: 'Не сданы', icon: '' },
  { key: 'submitted', label: 'На проверке', icon: '' },
  { key: 'graded', label: 'Оцененные', icon: '' },
  { key: 'returned', label: 'Возвращенные', icon: '' },
  { key: 'urgent', label: 'Срочные', icon: '' },
];

export const teacherAssignmentFilters = [
  { key: 'all', label: 'Все задания', icon: '' },
  { key: 'active', label: 'Активные', icon: '' },
  { key: 'inactive', label: 'Неактивные', icon: '' },
  { key: 'with_submissions', label: 'С работами', icon: '' },
  { key: 'without_submissions', label: 'Без работ', icon: '' },
];