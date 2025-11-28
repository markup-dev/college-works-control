import { readFromStorage, writeToStorage, STORAGE_KEYS } from '../utils/storageUtils';

const USERS_STORAGE_KEY = STORAGE_KEYS.USERS;
const CURRENT_USER_STORAGE_KEY = STORAGE_KEYS.CURRENT_USER;
const ASSIGNMENTS_STORAGE_KEY = STORAGE_KEYS.ASSIGNMENTS;
const SUBMISSIONS_STORAGE_KEY = STORAGE_KEYS.SUBMISSIONS;

const defaultUsers = [
  {
    id: 1,
    login: 'student_zabiryuchenko',
    email: 'zabiryuchenko@college.ru',
    passwordHash: '$2b$10$e9i7oT2Y/aHi59s/kPvoQ.UYJtjpw7ht5cvRgVOzlT7DcmIfeKC4S',
    name: 'Забирюченко Кристина Алексеевна',
    role: 'student',
    group: 'ИСП-029',
    phone: '+7 (999) 111-22-33',
    timezone: 'UTC+3',
    notifications: { email: true, push: true, sms: false },
    theme: 'system',
    bio: 'Студентка 4 курса, интересы — веб-разработка и дизайн.',
    isActive: true,
    registrationDate: '2024-01-15',
    lastLogin: null,
    teacherLogin: 'teacher_kartseva'
  },
  {
    id: 2,
    login: 'teacher_kartseva',
    email: 'kartseva@college.ru',
    passwordHash: '$2b$10$e9i7oT2Y/aHi59s/kPvoQ.UYJtjpw7ht5cvRgVOzlT7DcmIfeKC4S',
    name: 'Карцева Мария Сергеевна',
    role: 'teacher',
    department: 'JS-разработка',
    phone: '+7 (999) 444-55-66',
    timezone: 'UTC+3',
    notifications: { email: true, push: true, sms: true },
    theme: 'system',
    bio: 'Преподаватель дисциплин по JavaScript',
    isActive: true,
    registrationDate: '2024-01-10',
    lastLogin: null
  },
  {
    id: 3,
    login: 'admin_sidorov',
    email: 'sidorov@college.ru',
    passwordHash: '$2b$10$e9i7oT2Y/aHi59s/kPvoQ.UYJtjpw7ht5cvRgVOzlT7DcmIfeKC4S',
    name: 'Сидоров Андрей Васильевич',
    role: 'admin',
    phone: '+7 (999) 777-88-99',
    timezone: 'UTC+3',
    notifications: { email: true, push: false, sms: false },
    theme: 'system',
    bio: 'Администратор платформы, отвечает за безопасность и доступы.',
    isActive: true,
    registrationDate: '2024-01-01',
    lastLogin: null
  }
];

const defaultAssignments = [
  {
    id: 1,
    title: 'Курсовая работа по базам данных',
    course: 'Базы данных',
    description: 'Разработка схемы БД для информационной системы колледжа.',
    deadline: '2025-12-25',
    status: 'active',
    priority: 'high',
    maxScore: 100,
    submissionType: 'file',
    criteria: ['Качество проектирования БД - 40 баллов', 'Нормализация - 30 баллов', 'Документация - 30 баллов'],
    studentGroups: ['ИСП-029'],
    teacherLogin: 'teacher_kartseva',
    createdAt: '2024-09-01',
    studentsCount: 1,
    submissionsCount: 0,
    pendingCount: 0
  },
  {
    id: 2,
    title: 'React приложение',
    course: 'Веб-программирование',
    description: 'Разработка клиентской части системы контроля учебных работ.',
    deadline: '2025-12-20',
    status: 'active',
    priority: 'medium',
    maxScore: 100,
    submissionType: 'file',
    criteria: ['Функциональность - 40 баллов', 'Интерфейс - 30 баллов', 'Код - 30 баллов'],
    studentGroups: ['ИСП-029'],
    teacherLogin: 'teacher_kartseva',
    createdAt: '2024-09-01',
    studentsCount: 1,
    submissionsCount: 1,
    pendingCount: 0
  },
  {
    id: 3,
    title: 'Тестирование ПО',
    course: 'Тестирование программного обеспечения',
    description: 'Написание тестов для модуля аутентификации.',
    deadline: '2025-12-18',
    status: 'active',
    priority: 'low',
    maxScore: 100,
    submissionType: 'file',
    criteria: ['Покрытие кода - 50 баллов', 'Качество тестов - 50 баллов'],
    studentGroups: ['ИСП-029'],
    teacherLogin: 'teacher_kartseva',
    createdAt: '2024-09-01',
    studentsCount: 1,
    submissionsCount: 1,
    pendingCount: 0
  }
];

const defaultSubmissions = [
  {
    id: 1,
    assignmentId: 2,
    studentLogin: 'student_zabiryuchenko',
    studentName: 'Забирюченко Кристина Алексеевна',
    studentId: 1,
    assignmentTitle: 'React приложение',
    fileName: 'react_app.zip',
    submissionDate: '2025-01-15T14:30:00',
    status: 'submitted',
    fileSize: '15.6 MB',
    group: 'ИСП-029',
    teacherLogin: 'teacher_kartseva',
    maxScore: 100,
    isResubmission: false,
    previousSubmissionId: null
  },
  {
    id: 2,
    assignmentId: 3,
    studentLogin: 'student_zabiryuchenko',
    studentName: 'Забирюченко Кристина Алексеевна',
    studentId: 1,
    assignmentTitle: 'Тестирование ПО',
    fileName: 'testing_module.pdf',
    submissionDate: '2025-01-10T10:15:00',
    status: 'graded',
    score: 85,
    comment: 'Отличная работа! Хорошее покрытие тестами.',
    fileSize: '2.1 MB',
    group: 'ИСП-029',
    teacherLogin: 'teacher_kartseva',
    maxScore: 100,
    isResubmission: false,
    previousSubmissionId: null
  }
];

export { defaultAssignments, defaultSubmissions };

class CollegeDatabase {
  constructor() {
    this.loadAllData();
  }

  loadAllData() {
    this.users = readFromStorage(USERS_STORAGE_KEY, defaultUsers);
    this.assignments = readFromStorage(ASSIGNMENTS_STORAGE_KEY, defaultAssignments);
    this.submissions = readFromStorage(SUBMISSIONS_STORAGE_KEY, defaultSubmissions);
  }

  saveAllData() {
    writeToStorage(USERS_STORAGE_KEY, this.users);
    
    const currentAssignments = readFromStorage(ASSIGNMENTS_STORAGE_KEY);
    if (!currentAssignments || currentAssignments.length === 0) {
      writeToStorage(ASSIGNMENTS_STORAGE_KEY, this.assignments, true);
    }
    
    const currentSubmissions = readFromStorage(SUBMISSIONS_STORAGE_KEY);
    if (!currentSubmissions || currentSubmissions.length === 0) {
      writeToStorage(SUBMISSIONS_STORAGE_KEY, this.submissions, true);
    }
  }

  getUsers() {
    return [...this.users];
  }

  getUserById(userId) {
    return this.users.find(user => user.id === userId) || null;
  }

  getUserByLogin(login) {
    return this.users.find(user => user.login === login) || null;
  }

  getUserByLoginOrEmail(identifier) {
    return this.users.find(user => 
      user.login === identifier || user.email === identifier
    ) || null;
  }

  getStudentsByTeacher(teacherLogin) {
    return this.users.filter(user => 
      user.role === 'student' && user.teacherLogin === teacherLogin
    );
  }

  getTeacherByStudent(studentLogin) {
    const student = this.getUserByLogin(studentLogin);
    return student?.teacherLogin ? this.getUserByLogin(student.teacherLogin) : null;
  }

  addUser(userData) {
    const newUser = {
      ...userData,
      id: this.generateId(this.users)
    };
    this.users.push(newUser);
    this.saveAllData();
    return newUser;
  }

  updateUser(userId, updates) {
    const index = this.users.findIndex(user => user.id === userId);
    if (index === -1) return null;

    this.users[index] = { ...this.users[index], ...updates };
    this.saveAllData();
    return this.users[index];
  }

  deleteUser(userId) {
    const index = this.users.findIndex(user => user.id === userId);
    if (index === -1) return null;

    const [deletedUser] = this.users.splice(index, 1);
    this.saveAllData();
    return deletedUser;
  }

  getAssignments() {
    return [...this.assignments];
  }

  getAssignmentById(assignmentId) {
    return this.assignments.find(assign => assign.id === assignmentId) || null;
  }

  getAssignmentsByTeacher(teacherLogin) {
    return this.assignments.filter(assign => assign.teacherLogin === teacherLogin);
  }

  getAssignmentsByStudent(studentLogin) {
    const student = this.getUserByLogin(studentLogin);
    if (!student) return [];

    return this.assignments.filter(assign => 
      assign.studentGroups?.includes(student.group) && 
      assign.teacherLogin === student.teacherLogin
    );
  }

  addAssignment(assignmentData) {
    const newAssignment = {
      ...assignmentData,
      id: this.generateId(this.assignments)
    };
    this.assignments.push(newAssignment);
    this.saveAllData();
    return newAssignment;
  }

  updateAssignment(assignmentId, updates) {
    const index = this.assignments.findIndex(assign => assign.id === assignmentId);
    if (index === -1) return null;

    this.assignments[index] = { ...this.assignments[index], ...updates };
    this.saveAllData();
    return this.assignments[index];
  }

  deleteAssignment(assignmentId) {
    const index = this.assignments.findIndex(assign => assign.id === assignmentId);
    if (index === -1) return null;

    const [deletedAssignment] = this.assignments.splice(index, 1);
    this.saveAllData();
    return deletedAssignment;
  }

  getSubmissions() {
    return [...this.submissions];
  }

  getSubmissionById(submissionId) {
    return this.submissions.find(sub => sub.id === submissionId) || null;
  }

  getSubmissionsByStudent(studentLogin) {
    return this.submissions.filter(sub => sub.studentLogin === studentLogin);
  }

  getSubmissionsByTeacher(teacherLogin) {
    return this.submissions.filter(sub => sub.teacherLogin === teacherLogin);
  }

  getSubmissionsByAssignment(assignmentId) {
    return this.submissions.filter(sub => sub.assignmentId === assignmentId);
  }

  getLatestSubmissionsByTeacher(teacherLogin) {
    const allSubmissions = this.getSubmissionsByTeacher(teacherLogin);
    const latestSubmissions = [];
    const seen = new Map();
    
    const sortedSubmissions = [...allSubmissions].sort((a, b) => 
      new Date(b.submissionDate) - new Date(a.submissionDate)
    );

    for (const submission of sortedSubmissions) {
      const key = `${submission.assignmentId}_${submission.studentLogin}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        latestSubmissions.push(submission);
      }
    }

    return latestSubmissions;
  }

  addSubmission(submissionData) {
    const newSubmission = {
      ...submissionData,
      id: this.generateId(this.submissions),
      submissionDate: submissionData.submissionDate || new Date().toISOString()
    };
    this.submissions.push(newSubmission);
    this.saveAllData();
    return newSubmission;
  }

  updateSubmission(submissionId, updates) {
    const index = this.submissions.findIndex(sub => sub.id === submissionId);
    if (index === -1) return null;

    this.submissions[index] = { ...this.submissions[index], ...updates };
    this.saveAllData();
    return this.submissions[index];
  }

  getCurrentUser() {
    return readFromStorage(CURRENT_USER_STORAGE_KEY);
  }

  setCurrentUser(user) {
    writeToStorage(CURRENT_USER_STORAGE_KEY, user);
  }

  clearCurrentUser() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
  }

  generateId(array) {
    return array.length > 0 ? Math.max(...array.map(item => item.id)) + 1 : 1;
  }

  resetToDefault() {
    this.users = [...defaultUsers];
    this.assignments = [...defaultAssignments];
    this.submissions = [...defaultSubmissions];
    this.saveAllData();
    this.clearCurrentUser();
    return true;
  }
}

const collegeDatabase = new CollegeDatabase();
export default collegeDatabase;
