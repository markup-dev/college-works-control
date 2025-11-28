export const validateLoginForm = (formData) => {
  const errors = {};

  const trimmedLogin = formData.login?.trim() || '';
  if (!trimmedLogin) {
    errors.login = 'Логин или email обязателен';
  }

  if (!formData.role) {
    errors.role = 'Необходимо выбрать роль';
  }

  if (!formData.password) {
    errors.password = 'Пароль обязателен';
  } else if (formData.password.length < 6) {
    errors.password = 'Пароль должен содержать минимум 6 символов';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateRegisterForm = (formData) => {
  const errors = {};

  const trimmedName = formData.name?.trim() || '';
  if (!trimmedName) {
    errors.name = 'ФИО обязательно';
  } else if (trimmedName.length < 2) {
    errors.name = 'ФИО должно содержать минимум 2 символа';
  } else if (trimmedName.length > 100) {
    errors.name = 'ФИО не должно превышать 100 символов';
  }

  const trimmedLogin = formData.login?.trim() || '';
  if (!trimmedLogin) {
    errors.login = 'Логин обязателен';
  } else if (trimmedLogin.length < 3) {
    errors.login = 'Логин должен содержать минимум 3 символа';
  } else if (trimmedLogin.length > 30) {
    errors.login = 'Логин не должен превышать 30 символов';
  } else if (!/^[a-zA-Z0-9_]+$/.test(trimmedLogin)) {
    errors.login = 'Логин может содержать только латинские буквы, цифры и подчеркивание';
  }

  const trimmedEmail = formData.email?.trim() || '';
  if (!trimmedEmail) {
    errors.email = 'Email обязателен';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Введите корректный email адрес';
  } else if (trimmedEmail.length > 255) {
    errors.email = 'Email не должен превышать 255 символов';
  }

  if (!formData.password) {
    errors.password = 'Пароль обязателен';
  } else if (formData.password.length < 8) {
    errors.password = 'Пароль должен содержать минимум 8 символов';
  } else if (formData.password.length > 128) {
    errors.password = 'Пароль не должен превышать 128 символов';
  } else if (!/(?=.*[a-z])/.test(formData.password)) {
    errors.password = 'Пароль должен содержать хотя бы одну строчную букву';
  } else if (!/(?=.*[A-Z])/.test(formData.password)) {
    errors.password = 'Пароль должен содержать хотя бы одну заглавную букву';
  } else if (!/(?=.*\d)/.test(formData.password)) {
    errors.password = 'Пароль должен содержать хотя бы одну цифру';
  }

  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Подтверждение пароля обязательно';
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Пароли не совпадают';
  }

  const trimmedGroup = formData.group?.trim() || '';
  if (formData.role === 'student') {
    if (!trimmedGroup) {
      errors.group = 'Группа обязательна для студента';
    } else if (!/^[А-ЯЁA-Z\-\d]+$/i.test(trimmedGroup)) {
      errors.group = 'Группа должна содержать только буквы, цифры и дефис (например, ИСП-401)';
    } else if (trimmedGroup.length > 20) {
      errors.group = 'Группа не должна превышать 20 символов';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateAssignmentForm = (formData) => {
  const errors = {};

  const trimmedTitle = formData.title?.trim() || '';
  if (!trimmedTitle) {
    errors.title = 'Название задания обязательно';
  } else if (trimmedTitle.length < 3) {
    errors.title = 'Название должно содержать минимум 3 символа';
  } else if (trimmedTitle.length > 200) {
    errors.title = 'Название не должно превышать 200 символов';
  }

  const trimmedCourse = formData.course?.trim() || '';
  if (!trimmedCourse) {
    errors.course = 'Название курса обязательно';
  } else if (trimmedCourse.length > 100) {
    errors.course = 'Название курса не должно превышать 100 символов';
  }

  const trimmedDescription = formData.description?.trim() || '';
  if (!trimmedDescription) {
    errors.description = 'Описание задания обязательно';
  } else if (trimmedDescription.length < 10) {
    errors.description = 'Описание должно содержать минимум 10 символов';
  } else if (trimmedDescription.length > 5000) {
    errors.description = 'Описание не должно превышать 5000 символов';
  }

  if (!formData.deadline) {
    errors.deadline = 'Срок сдачи обязателен';
  } else {
    const deadline = new Date(formData.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (deadline < today) {
      errors.deadline = 'Срок сдачи не может быть в прошлом';
    }
    
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    if (deadline > maxDate) {
      errors.deadline = 'Срок сдачи не может быть более чем через 2 года';
    }
  }

  const maxScore = Number(formData.maxScore);
  if (!formData.maxScore || isNaN(maxScore) || maxScore <= 0) {
    errors.maxScore = 'Максимальный балл должен быть положительным числом';
  } else if (maxScore > 1000) {
    errors.maxScore = 'Максимальный балл не должен превышать 1000';
  } else if (!Number.isInteger(maxScore)) {
    errors.maxScore = 'Максимальный балл должен быть целым числом';
  }

  if (!formData.studentGroups || !Array.isArray(formData.studentGroups) || formData.studentGroups.length === 0) {
    errors.studentGroups = 'Выберите хотя бы одну группу';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateProfileForm = (formData) => {
  const errors = {};

  const trimmedName = formData.name?.trim() || '';
  if (!trimmedName) {
    errors.name = 'ФИО обязательно';
  } else if (trimmedName.length < 2) {
    errors.name = 'ФИО должно содержать минимум 2 символа';
  } else if (trimmedName.length > 100) {
    errors.name = 'ФИО не должно превышать 100 символов';
  }

  const trimmedEmail = formData.email?.trim() || '';
  if (!trimmedEmail) {
    errors.email = 'Email обязателен';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Введите корректный email адрес';
  } else if (trimmedEmail.length > 255) {
    errors.email = 'Email не должен превышать 255 символов';
  }

  const trimmedPhone = formData.phone?.trim() || '';
  if (trimmedPhone) {
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    if (!/^(\+?7|8)?[0-9]{10}$/.test(phoneDigits) || phoneDigits.length < 10) {
      errors.phone = 'Введите корректный номер телефона (например, +7 999 123-45-67 или 8 999 123-45-67)';
    }
  }

  const trimmedGroup = formData.group?.trim() || '';
  if (trimmedGroup && !/^[А-ЯЁA-Z\-\d]+$/i.test(trimmedGroup)) {
    errors.group = 'Группа должна содержать только буквы, цифры и дефис (например, ИСП-401)';
  } else if (trimmedGroup && trimmedGroup.length > 20) {
    errors.group = 'Группа не должна превышать 20 символов';
  }

  const trimmedDepartment = formData.department?.trim() || '';
  if (trimmedDepartment && trimmedDepartment.length > 100) {
    errors.department = 'Кафедра не должна превышать 100 символов';
  }

  const trimmedBio = formData.bio?.trim() || '';
  if (trimmedBio && trimmedBio.length > 500) {
    errors.bio = 'Описание не должно превышать 500 символов';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validatePasswordChange = (formData) => {
  const errors = {};

  if (!formData.currentPassword) {
    errors.currentPassword = 'Текущий пароль обязателен';
  }

  if (!formData.newPassword) {
    errors.newPassword = 'Новый пароль обязателен';
  } else if (formData.newPassword.length < 8) {
    errors.newPassword = 'Пароль должен содержать минимум 8 символов';
  } else if (!/(?=.*[a-z])/.test(formData.newPassword)) {
    errors.newPassword = 'Пароль должен содержать хотя бы одну строчную букву';
  } else if (!/(?=.*[A-Z])/.test(formData.newPassword)) {
    errors.newPassword = 'Пароль должен содержать хотя бы одну заглавную букву';
  } else if (!/(?=.*\d)/.test(formData.newPassword)) {
    errors.newPassword = 'Пароль должен содержать хотя бы одну цифру';
  }

  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Подтверждение пароля обязательно';
  } else if (formData.newPassword !== formData.confirmPassword) {
    errors.confirmPassword = 'Пароли не совпадают';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};