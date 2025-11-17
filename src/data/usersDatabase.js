// src/data/usersDatabase.js

const USERS_STORAGE_KEY = 'college_users_db_v1';
const CURRENT_USER_STORAGE_KEY = 'college_current_user';

const defaultUsers = [
  {
    id: 1,
    login: 'student_ivanov',
    email: 'ivanov@college.ru',
    passwordHash: '$2b$10$e9i7oT2Y/aHi59s/kPvoQ.UYJtjpw7ht5cvRgVOzlT7DcmIfeKC4S', // Password123
    name: 'Иванов Алексей Петрович',
    role: 'student',
    group: 'ИСП-401',
    phone: '+7 (999) 111-22-33',
    timezone: 'UTC+3',
    notifications: {
      email: true,
      push: true,
      sms: false
    },
    theme: 'system',
    bio: 'Студент 4 курса, интересы — веб-разработка и дизайн.',
    isActive: true,
    registrationDate: '2024-01-15',
    lastLogin: null
  },
  {
    id: 2,
    login: 'teacher_petrova',
    email: 'petrova@college.ru',
    passwordHash: '$2b$10$e9i7oT2Y/aHi59s/kPvoQ.UYJtjpw7ht5cvRgVOzlT7DcmIfeKC4S', // Password123
    name: 'Петрова Мария Сергеевна',
    role: 'teacher',
    department: 'Информатика',
    phone: '+7 (999) 444-55-66',
    timezone: 'UTC+3',
    notifications: {
      email: true,
      push: true,
      sms: true
    },
    theme: 'system',
    bio: 'Преподаватель дисциплин по программированию и базам данных.',
    isActive: true,
    registrationDate: '2024-01-10',
    lastLogin: null
  },
  {
    id: 3,
    login: 'admin_sidorov',
    email: 'sidorov@college.ru',
    passwordHash: '$2b$10$e9i7oT2Y/aHi59s/kPvoQ.UYJtjpw7ht5cvRgVOzlT7DcmIfeKC4S', // Password123
    name: 'Сидоров Андрей Васильевич',
    role: 'admin',
    phone: '+7 (999) 777-88-99',
    timezone: 'UTC+3',
    notifications: {
      email: true,
      push: false,
      sms: false
    },
    theme: 'system',
    bio: 'Администратор платформы, отвечает за безопасность и доступы.',
    isActive: true,
    registrationDate: '2024-01-01',
    lastLogin: null
  }
];

const isBrowser = typeof window !== 'undefined';

const readFromStorage = (key) => {
  if (!isBrowser) return null;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error(`Error reading ${key} from storage:`, error);
    return null;
  }
};

const writeToStorage = (key, value) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to storage:`, error);
  }
};

class UsersDatabase {
  constructor() {
    this.users = this.loadUsers();
  }

  loadUsers() {
    const stored = readFromStorage(USERS_STORAGE_KEY);
    if (stored && Array.isArray(stored) && stored.length) {
      return stored;
    }
    writeToStorage(USERS_STORAGE_KEY, defaultUsers);
    return defaultUsers;
  }

  syncUsers(users) {
    this.users = [...users];
    writeToStorage(USERS_STORAGE_KEY, this.users);
    return this.getUsers();
  }

  getUsers() {
    if (!this.users || !Array.isArray(this.users)) {
      this.users = this.loadUsers();
    }
    return [...this.users];
  }

  setUsers(users) {
    return this.syncUsers(users);
  }

  addUser(user) {
    const nextUsers = [...this.getUsers(), user];
    this.syncUsers(nextUsers);
    return user;
  }

  updateUser(userId, updates) {
    const users = this.getUsers();
    const index = users.findIndex((user) => user.id === userId);
    if (index === -1) {
      return null;
    }
    const current = users[index];
    const updated = {
      ...current,
      ...updates,
      notifications: updates.notifications
        ? { ...current.notifications, ...updates.notifications }
        : current.notifications
    };
    users[index] = updated;
    this.syncUsers(users);
    return updated;
  }

  deleteUser(userId) {
    const users = this.getUsers();
    const index = users.findIndex((user) => user.id === userId);
    if (index === -1) {
      return null;
    }
    const [removed] = users.splice(index, 1);
    this.syncUsers(users);
    return removed;
  }

  getUserById(userId) {
    return this.getUsers().find((user) => user.id === userId) || null;
  }

  getUserByLoginOrEmail(identifier) {
    if (!identifier) return null;
    const normalized = identifier.trim().toLowerCase();
    return this.getUsers().find(
      (user) =>
        user.login?.toLowerCase() === normalized ||
        user.email?.toLowerCase() === normalized
    ) || null;
  }

  getCurrentUser() {
    const stored = readFromStorage(CURRENT_USER_STORAGE_KEY);
    return stored || null;
  }

  setCurrentUser(user) {
    if (user) {
      writeToStorage(CURRENT_USER_STORAGE_KEY, user);
    } else {
      this.clearCurrentUser();
    }
  }

  clearCurrentUser() {
    if (!isBrowser) return;
    try {
      window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing current user from storage:', error);
    }
  }
}

const usersDatabase = new UsersDatabase();

export default usersDatabase;
export { defaultUsers };

