const DEFAULT_TEACHER = {
  login: 'teacher_kartseva',
  name: 'Карцева Мария Сергеевна',
};

export const mockTeacherAssignments = [
  {
    id: 1,
    title: 'Курсовая работа по базам данных',
    course: 'Базы данных',
    description: 'Разработка схемы БД для информационной системы колледжа. Требуется спроектировать нормализованную базу данных с учетом всех требований.',
    studentsCount: 25,
    submissionsCount: 18,
    pendingCount: 7,
    deadline: '2025-12-25',
    status: 'active',
    createdAt: '2024-09-01',
    priority: 'high',
    maxScore: 100,
    submissionType: 'file',
    criteria: ['Качество проектирования БД - 40 баллов', 'Нормализация - 30 баллов', 'Документация - 30 баллов'],
    studentGroups: ['ИСП-029', 'ИСП-029А'],
    teacherLogin: DEFAULT_TEACHER.login,
    teacherName: DEFAULT_TEACHER.name
  },
  {
    id: 2,
    title: 'React приложение',
    course: 'Веб-программирование',
    description: 'Разработка клиентской части системы контроля учебных работ. Создание современного React-приложения с использованием лучших практик.',
    studentsCount: 30,
    submissionsCount: 25,
    pendingCount: 5,
    deadline: '2025-12-20',
    status: 'active',
    createdAt: '2024-09-01',
    priority: 'medium',
    maxScore: 100,
    submissionType: 'file',
    criteria: ['Функциональность - 40 баллов', 'Интерфейс - 30 баллов', 'Код - 30 баллов'],
    studentGroups: ['ИСП-029'],
    teacherLogin: DEFAULT_TEACHER.login,
    teacherName: DEFAULT_TEACHER.name
  }
];

export const mockTeacherSubmissions = [
  {
    id: 1,
    assignmentId: 1,
    assignmentTitle: 'Курсовая работа по базам данных',
    studentName: 'Иванов А.С.',
    studentId: 'IS-2020-001',
    group: 'ИСП-029',
    submitDate: '2025-01-15T14:30:00',
    status: 'submitted',
    fileName: 'coursework_ivanov.pdf',
    fileSize: '2.4 MB',
    score: null,
    comment: null,
    maxScore: 100,
    teacherLogin: DEFAULT_TEACHER.login
  },
  {
    id: 2,
    assignmentId: 1,
    assignmentTitle: 'Курсовая работа по базам данных',
    studentName: 'Петров В.И.',
    studentId: 'IS-2020-002',
    group: 'ИСП-029',
    submitDate: '2025-01-14T16:45:00',
    status: 'graded',
    fileName: 'coursework_petrov.pdf',
    fileSize: '2.1 MB',
    score: 92,
    comment: 'Отличная работа! Хорошая структура БД.',
    maxScore: 100,
    teacherLogin: DEFAULT_TEACHER.login
  },
  {
    id: 3,
    assignmentId: 2,
    assignmentTitle: 'React приложение',
    studentName: 'Сидорова М.П.',
    studentId: 'IS-2020-003',
    group: 'ИСП-029А',
    submitDate: '2025-01-13T11:20:00',
    status: 'returned',
    fileName: 'react_app_sidorova.zip',
    fileSize: '18.3 MB',
    score: null,
    comment: 'Требуется доработка интерфейса',
    maxScore: 100,
    teacherLogin: DEFAULT_TEACHER.login
  },
  {
    id: 4,
    assignmentId: 1,
    assignmentTitle: 'Курсовая работа по базам данных',
    studentName: 'Козлов Д.В.',
    studentId: 'IS-2020-004',
    group: 'ИСП-029',
    submitDate: '2025-01-12T10:15:00',
    status: 'graded',
    fileName: 'coursework_kozlov.pdf',
    fileSize: '2.8 MB',
    score: 85,
    comment: 'Хорошая работа, но есть замечания по нормализации.',
    maxScore: 100,
    teacherLogin: DEFAULT_TEACHER.login
  },
  {
    id: 5,
    assignmentId: 2,
    assignmentTitle: 'React приложение',
    studentName: 'Морозова А.И.',
    studentId: 'IS-2020-005',
    group: 'ИСП-029',
    submitDate: '2025-01-11T09:30:00',
    status: 'submitted',
    fileName: 'react_app_morozova.zip',
    fileSize: '15.2 MB',
    score: null,
    comment: null,
    maxScore: 100,
    teacherLogin: DEFAULT_TEACHER.login
  }
];

