// src/utils/assignmentHelpers.js
export const getStatusInfo = (assignmentOrStatus) => {
  // Поддерживаем оба варианта: объект assignment или просто статус
  const status = typeof assignmentOrStatus === 'string' 
    ? assignmentOrStatus 
    : assignmentOrStatus.status;
  
  if (status === 'not_submitted') return { label: 'Не сдано', variant: 'danger', icon: '⏳' };
  if (status === 'submitted') return { label: 'На проверке', variant: 'warning', icon: '📋' };
  if (status === 'graded') return { label: 'Оценено', variant: 'success', icon: '✅' };
  if (status === 'returned') return { label: 'Возвращено', variant: 'danger', icon: '↩️' };
  return { label: 'Не сдано', variant: 'danger', icon: '⏳' };
};

// Остальные функции без изменений...
export const getPriorityInfo = (priority) => {
  if (priority === 'high') return { label: 'Высокий', color: '#dc3545', icon: '🔴' };
  if (priority === 'medium') return { label: 'Средний', color: '#ffc107', icon: '🟡' };
  if (priority === 'low') return { label: 'Низкий', color: '#28a745', icon: '🟢' };
  return { label: 'Средний', color: '#ffc107', icon: '🟡' };
};

export const getDaysUntilDeadline = (deadline) => {
  const today = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// Вычисление статистики по работам для преподавателя
export const calculateSubmissionStats = (submissions = []) => {
  const total = submissions.length;
  const submitted = submissions.filter(s => s.status === 'submitted').length;
  const graded = submissions.filter(s => s.status === 'graded').length;
  const pending = submissions.filter(s => s.status === 'submitted').length;

  const completionRate = total > 0 ? Math.round((submitted / total) * 100) : 0;

  return {
    total,
    submitted,
    graded,
    pending,
    completionRate
  };
};

// Упрощенные mock данные для тестирования
export const mockAssignments = [
  {
    id: 1,
    title: 'Курсовая работа',
    course: 'Базы данных',
    deadline: '2025-12-25',
    status: 'not_submitted',
    score: null,
    submittedAt: null,
    description: 'Разработка схемы БД для информационной системы колледжа.',
    priority: 'high',
    maxScore: 100,
    teacher: 'Забирюченко М.С.',
    submissionType: 'file',
    criteria: ['Качество проектирования БД - 40 баллов']
  },
  // ... можно добавить еще 2-3 задания для теста
];

export const filters = [
  { key: 'all', label: 'Все задания', icon: '📚' },
  { key: 'not_submitted', label: 'Не сданы', icon: '⏳' },
  { key: 'submitted', label: 'На проверке', icon: '📋' },
  { key: 'graded', label: 'Оцененные', icon: '✅' },
  { key: 'returned', label: 'Возвращенные', icon: '↩️' },
  { key: 'urgent', label: 'Срочные', icon: '🔥' }
];