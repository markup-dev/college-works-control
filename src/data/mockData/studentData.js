// src/data/mockData/studentData.js
// Моковые данные для студента

export const mockStudentAssignments = [
  {
    id: 1,
    title: 'Курсовая работа по базам данных',
    course: 'Базы данных',
    deadline: '2025-12-25',
    status: 'not_submitted',
    score: null,
    submittedAt: null,
    description: 'Разработка схемы БД для информационной системы колледжа.',
    priority: 'high',
    maxScore: 100,
    teacher: 'Петрова М.И.',
    submissionType: 'file',
    allowedFormats: ['.pdf', '.docx', '.zip'],
    maxFileSize: 50,
    criteria: ['Качество проектирования БД - 40 баллов', 'Нормализация - 30 баллов', 'Документация - 30 баллов']
  },
  {
    id: 2,
    title: 'React приложение',
    course: 'Веб-программирование',
    deadline: '2025-12-20',
    status: 'submitted',
    score: null,
    submittedAt: '2025-01-15T14:30:00',
    description: 'Разработка клиентской части системы контроля учебных работ.',
    priority: 'medium',
    maxScore: 100,
    teacher: 'Петрова М.И.',
    submissionType: 'file',
    allowedFormats: ['.pdf', '.docx', '.zip'],
    maxFileSize: 50,
    criteria: ['Функциональность - 40 баллов', 'Интерфейс - 30 баллов', 'Код - 30 баллов']
  },
  {
    id: 3,
    title: 'Тестирование ПО',
    course: 'Тестирование программного обеспечения',
    deadline: '2025-12-18',
    status: 'graded',
    score: 85,
    submittedAt: '2025-01-10T10:15:00',
    description: 'Написание тестов для модуля аутентификации.',
    priority: 'low',
    maxScore: 100,
    teacher: 'Смирнов А.В.',
    submissionType: 'file',
    allowedFormats: ['.pdf', '.docx', '.zip'],
    maxFileSize: 50,
    feedback: 'Отличная работа! Хорошее покрытие тестами.',
    criteria: ['Покрытие кода - 50 баллов', 'Качество тестов - 50 баллов']
  }
];

export const mockStudentSubmissions = [
  {
    id: 1,
    assignmentId: 2,
    fileName: 'react_app.zip',
    submissionDate: '2025-01-15T14:30:00',
    status: 'submitted',
    fileSize: '15.6 MB'
  },
  {
    id: 2,
    assignmentId: 3,
    fileName: 'testing_module.pdf',
    submissionDate: '2025-01-10T10:15:00',
    status: 'graded',
    score: 85,
    fileSize: '2.1 MB'
  }
];

