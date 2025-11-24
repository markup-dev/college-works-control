export const formatDate = (dateString) => {
  if (!dateString) return 'Дата не указана';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Некорректная дата';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

export const getDaysUntilDeadline = (deadline) => {
  const today = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getSubmissionStatusInfo = (status) => {
  const statusMap = {
    'submitted': { label: 'На проверке', variant: 'warning', icon: '📋' },
    'graded': { label: 'Зачтена', variant: 'success', icon: '✅' },
    'returned': { label: 'Возвращена', variant: 'danger', icon: '↩️' }
  };
  return statusMap[status] || statusMap['submitted'];
};

// Форматирование размера файла
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  if (typeof bytes === 'string') {
    // Если уже отформатирован, возвращаем как есть
    return bytes;
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const mockAssignments = [
  {
    id: 1,
    title: "Курсовая работа по базам данных",
    course: "Базы данных",
    deadline: "2024-12-25",
    submissionsCount: 15,
    totalStudents: 25,
    status: "active",
    group: "ИСП-401",
    description: "Разработка схемы БД для информационной системы колледжа",
    maxScore: 100,
    submissionType: "file",
    createdAt: "2024-09-01"
  },
  // ... остальные задания
];

export const mockSubmissions = [
  {
    id: 1,
    assignmentId: 1,
    assignmentTitle: "Курсовая работа по базам данных",
    studentName: "Иванов Алексей",
    studentId: "IS-2020-001",
    group: "ИСП-401",
    submitDate: "2024-12-20",
    status: "на проверке",
    fileName: "coursework_ivanov.pdf",
    fileSize: "2.1 МБ",
    score: null,
    comment: null,
    maxScore: 100
  },
  // ... остальные работы
];