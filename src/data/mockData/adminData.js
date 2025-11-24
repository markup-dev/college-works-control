export const mockAdminCourses = [
  {
    id: 1,
    name: 'JavaScript',
    teacher: 'Карцева М.С.',
    studentsCount: 25,
    assignmentsCount: 8,
    status: 'active',
  },
  {
    id: 2,
    name: 'Программирование',
    teacher: 'Смирнов А.В.',
    studentsCount: 30,
    assignmentsCount: 12,
    status: 'active',
  },
  {
    id: 3,
    name: 'Веб-разработка',
    teacher: 'Козлов И.П.',
    studentsCount: 20,
    assignmentsCount: 6,
    status: 'inactive',
  },
];

export const mockSystemLogs = [
  {
    id: 1,
    timestamp: '2025-01-16 10:30:00',
    user: 'student_zabiryuchenko',
    action: 'login',
    details: 'Успешный вход в систему',
  },
  {
    id: 2,
    timestamp: '2025-01-16 11:15:00',
    user: 'teacher_kartseva',
    action: 'create_assignment',
    details: 'Создано задание "Курсовая работа"',
  },
  {
    id: 3,
    timestamp: '2025-01-16 12:00:00',
    user: 'student_zabiryuchenko',
    action: 'submit_work',
    details: 'Сдана работа по БД',
  },
];

