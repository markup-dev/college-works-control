import {
  GROUP_REGEX,
  validateEmailValue,
  validateLoginValue,
  validateNameField,
  validatePasswordValue,
  validatePhoneValue,
} from './validation';

export const formatDate = (dateString) => {
  if (!dateString) return 'Дата не указана';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Неверная дата';
    
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch (error) {
    return 'Неверная дата';
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'Дата не указана';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Неверная дата';
    
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    return 'Неверная дата';
  }
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

export const calculateSystemStats = (users = [], assignments = [], submissions = []) => {
  const totalUsers = users.length;
  const activeUsers = users.filter(user => user.isActive !== false).length;
  const totalGroups = new Set(users.map(user => user.group).filter(Boolean)).size;
  
  const totalAssignments = assignments.length;
  const totalSubmissions = submissions.length;
  const pendingSubmissions = submissions.filter(sub => sub.status === 'submitted').length;
  
  const systemLoad = Math.min(100, Math.round((pendingSubmissions / Math.max(totalSubmissions, 1)) * 100));

  return {
    totalUsers,
    activeUsers,
    totalGroups,
    totalAssignments,
    totalSubmissions,
    pendingSubmissions,
    systemLoad
  };
};

export const formatTableDate = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch (error) {
    return '-';
  }
};

export const formatLogDateTime = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  } catch (error) {
    return '-';
  }
};

export const validateUserData = (userData, isEdit = false) => {
  const errors = {};

  const lastNameError = validateNameField(userData.lastName, 'Фамилия', true);
  if (lastNameError) errors.lastName = lastNameError;

  const firstNameError = validateNameField(userData.firstName, 'Имя', true);
  if (firstNameError) errors.firstName = firstNameError;

  const middleNameError = validateNameField(userData.middleName, 'Отчество');
  if (middleNameError) errors.middleName = middleNameError;

  const loginError = validateLoginValue(userData.login);
  if (loginError) errors.login = loginError;

  const emailError = validateEmailValue(userData.email, true);
  if (emailError) errors.email = emailError;

  if (!userData.role) {
    errors.role = 'Роль обязательна';
  }

  const trimmedGroup = userData.group?.trim() || '';
  if (userData.role === 'student') {
    if (!trimmedGroup) {
      errors.group = 'Группа обязательна для студента';
    } else if (!GROUP_REGEX.test(trimmedGroup)) {
      errors.group = 'Группа должна содержать только буквы, цифры и дефис';
    } else if (trimmedGroup.length > 20) {
      errors.group = 'Группа не должна превышать 20 символов';
    }
  }

  if (isEdit && userData.password) {
    const passwordError = validatePasswordValue(userData.password, !isEdit);
    if (passwordError) {
      errors.password = passwordError;
    }
  }

  const trimmedDepartment = userData.department?.trim() || '';
  if (trimmedDepartment && trimmedDepartment.length > 100) {
    errors.department = 'Кафедра не должна превышать 100 символов';
  }

  const phoneError = validatePhoneValue(userData.phone, false);
  if (phoneError) {
    errors.phone = phoneError;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const filterUsers = (users, filters) => {
  return users.filter(user => {
    if (filters.role && user.role !== filters.role) {
      return false;
    }
    
    if (filters.status && user.status !== filters.status) {
      return false;
    }
    
    if (filters.group && user.group !== filters.group) {
      return false;
    }
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const searchFields = [user.fullName, user.login, user.email, user.group].filter(Boolean);
      const matches = searchFields.some(field => 
        field.toLowerCase().includes(searchTerm)
      );
      if (!matches) return false;
    }
    
    return true;
  });
};

export const sortUsers = (users, sortBy, sortDirection) => {
  return [...users].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (sortBy === 'registrationDate' || sortBy === 'lastLogin') {
      aValue = new Date(aValue || 0);
      bValue = new Date(bValue || 0);
    }
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
};