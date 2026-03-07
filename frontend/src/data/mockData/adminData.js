export const mockAdminCourses = [
  {
    id: 1,
    name: 'JavaScript',
    teacher: 'Карцева М.С.',
    teacherLogin: 'teacher_kartseva',
    studentsCount: 1,
    assignmentsCount: 3,
    status: 'active',
  },
  {
    id: 2,
    name: 'Программирование',
    teacher: 'Смирнов А.В.',
    teacherLogin: 'teacher_smirnov',
    studentsCount: 30,
    assignmentsCount: 12,
    status: 'active',
  },
  {
    id: 3,
    name: 'Веб-разработка',
    teacher: 'Козлов И.П.',
    teacherLogin: 'teacher_kozlov',
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
    userRole: 'student',
    action: 'login',
    details: 'Успешный вход в систему',
  },
  {
    id: 2,
    timestamp: '2025-01-16 11:15:00',
    user: 'teacher_kartseva',
    userRole: 'teacher',
    action: 'create_assignment',
    details: 'Создано задание "Курсовая работа" для студента student_zabiryuchenko',
  },
  {
    id: 3,
    timestamp: '2025-01-16 12:00:00',
    user: 'student_zabiryuchenko',
    userRole: 'student',
    action: 'submit_work',
    details: 'Сдана работа по тестированию для преподавателя teacher_kartseva',
  },
];