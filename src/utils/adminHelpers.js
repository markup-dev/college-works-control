export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

export const formatDateTime = (dateString) => {
  return new Date(dateString).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getRoleInfo = (role) => {
  const roleMap = {
    'student': { label: 'Студент', variant: 'primary', icon: '👨‍🎓' },
    'teacher': { label: 'Преподаватель', variant: 'success', icon: '👩‍🏫' },
    'admin': { label: 'Администратор', variant: 'danger', icon: '⚙️' }
  };
  return roleMap[role] || roleMap.student;
};

export const getStatusInfo = (status) => {
  const statusMap = {
    'active': { label: 'Активен', variant: 'success', icon: '🟢' },
    'inactive': { label: 'Неактивен', variant: 'danger', icon: '🔴' },
    'blocked': { label: 'Заблокирован', variant: 'danger', icon: '⛔' }
  };
  return statusMap[status] || statusMap.active;
};

// Mock данные для администратора
export const mockUsers = [
  {
    id: 1,
    login: 'student_ivanov',
    fullName: 'Иванов Алексей Петрович',
    email: 'ivanov@college.ru',
    role: 'student',
    group: 'ИСП-401',
    status: 'active',
    registrationDate: '2024-09-01',
    lastLogin: '2024-12-20T14:30:00'
  },
  {
    id: 2,
    login: 'teacher_petrova',
    fullName: 'Петрова Мария Сергеевна',
    email: 'petrova@college.ru',
    role: 'teacher',
    group: null,
    status: 'active',
    registrationDate: '2023-08-15',
    lastLogin: '2024-12-20T10:15:00'
  },
  {
    id: 3,
    login: 'admin_sidorov',
    fullName: 'Сидоров Андрей Васильевич',
    email: 'sidorov@college.ru',
    role: 'admin',
    group: null,
    status: 'active',
    registrationDate: '2022-01-10',
    lastLogin: '2024-12-20T16:45:00'
  },
  {
    id: 4,
    login: 'student_kozlov',
    fullName: 'Козлов Дмитрий Иванович',
    email: 'kozlov@college.ru',
    role: 'student',
    group: 'ИСП-402',
    status: 'inactive',
    registrationDate: '2024-09-01',
    lastLogin: '2024-11-15T09:20:00'
  }
];

export const mockGroups = [
  {
    id: 1,
    name: 'ИСП-401',
    specialty: 'Информационные системы и программирование',
    course: 4,
    studentsCount: 25,
    curator: 'Петрова М.С.',
    createdAt: '2020-09-01'
  },
  {
    id: 2,
    name: 'ИСП-402',
    specialty: 'Информационные системы и программирование',
    course: 4,
    studentsCount: 23,
    curator: 'Смирнов А.В.',
    createdAt: '2020-09-01'
  },
  {
    id: 3,
    name: 'ИСП-301',
    specialty: 'Информационные системы и программирование',
    course: 3,
    studentsCount: 28,
    curator: 'Кузнецов И.П.',
    createdAt: '2021-09-01'
  }
];

export const mockCourses = [
  {
    id: 1,
    name: 'Базы данных',
    code: 'БД.01',
    teacher: 'Петрова М.С.',
    groups: ['ИСП-401', 'ИСП-402'],
    semester: 7,
    assignmentsCount: 12,
    studentsCount: 48
  },
  {
    id: 2,
    name: 'Веб-программирование',
    code: 'ВП.02',
    teacher: 'Смирнов А.В.',
    groups: ['ИСП-401'],
    semester: 7,
    assignmentsCount: 8,
    studentsCount: 25
  },
  {
    id: 3,
    name: 'Проектирование ИС',
    code: 'ПИС.03',
    teacher: 'Кузнецов И.П.',
    groups: ['ИСП-301'],
    semester: 5,
    assignmentsCount: 6,
    studentsCount: 28
  }
];

export const systemStats = {
  totalUsers: 156,
  activeUsers: 142,
  totalGroups: 8,
  totalCourses: 24,
  totalAssignments: 187,
  pendingSubmissions: 45,
  systemLoad: 65
};