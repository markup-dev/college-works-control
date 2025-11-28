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

  const trimmedName = userData.name?.trim() || '';
  if (!trimmedName) {
    errors.name = 'ФИО обязательно';
  } else if (trimmedName.length < 2) {
    errors.name = 'ФИО должно содержать минимум 2 символа';
  } else if (trimmedName.length > 100) {
    errors.name = 'ФИО не должно превышать 100 символов';
  }

  const trimmedLogin = userData.login?.trim() || '';
  if (!trimmedLogin) {
    errors.login = 'Логин обязателен';
  } else if (trimmedLogin.length < 3) {
    errors.login = 'Логин должен содержать минимум 3 символа';
  } else if (trimmedLogin.length > 30) {
    errors.login = 'Логин не должен превышать 30 символов';
  } else if (!/^[a-zA-Z0-9_]+$/.test(trimmedLogin)) {
    errors.login = 'Логин может содержать только латинские буквы, цифры и подчеркивание';
  }

  const trimmedEmail = userData.email?.trim() || '';
  if (!trimmedEmail) {
    errors.email = 'Email обязателен';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Введите корректный email адрес';
  } else if (trimmedEmail.length > 255) {
    errors.email = 'Email не должен превышать 255 символов';
  }

  if (!userData.role) {
    errors.role = 'Роль обязательна';
  }

  const trimmedGroup = userData.group?.trim() || '';
  if (userData.role === 'student') {
    if (!trimmedGroup) {
      errors.group = 'Группа обязательна для студента';
    } else if (!/^[А-ЯЁA-Z\-\d]+$/i.test(trimmedGroup)) {
      errors.group = 'Группа должна содержать только буквы, цифры и дефис (например, ИСП-401)';
    } else if (trimmedGroup.length > 20) {
      errors.group = 'Группа не должна превышать 20 символов';
    }
  }

  if (userData.role === 'student' && !userData.teacherLogin?.trim()) {
    errors.teacherLogin = 'Выберите преподавателя для студента';
  }

  if (!isEdit && !userData.password) {
    errors.password = 'Пароль обязателен';
  } else if (!isEdit && userData.password) {
    if (userData.password.length < 8) {
      errors.password = 'Пароль должен содержать минимум 8 символов';
    } else if (userData.password.length > 128) {
      errors.password = 'Пароль не должен превышать 128 символов';
    } else if (!/(?=.*[a-z])/.test(userData.password)) {
      errors.password = 'Пароль должен содержать хотя бы одну строчную букву';
    } else if (!/(?=.*[A-Z])/.test(userData.password)) {
      errors.password = 'Пароль должен содержать хотя бы одну заглавную букву';
    } else if (!/(?=.*\d)/.test(userData.password)) {
      errors.password = 'Пароль должен содержать хотя бы одну цифру';
    }
  }

  const trimmedDepartment = userData.department?.trim() || '';
  if (trimmedDepartment && trimmedDepartment.length > 100) {
    errors.department = 'Кафедра не должна превышать 100 символов';
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
      const searchFields = [user.name, user.login, user.email, user.group].filter(Boolean);
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