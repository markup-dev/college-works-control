// src/utils/validation.js
export const validateLoginForm = (formData) => {
  const errors = {};

  if (!formData.login.trim()) {
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

  // Валидация имени
  if (!formData.name.trim()) {
    errors.name = 'ФИО обязательно';
  } else if (formData.name.trim().length < 2) {
    errors.name = 'ФИО должно содержать минимум 2 символа';
  }

  // Валидация логина
  if (!formData.login.trim()) {
    errors.login = 'Логин обязателен';
  } else if (formData.login.length < 3) {
    errors.login = 'Логин должен содержать минимум 3 символа';
  } else if (!/^[a-zA-Z0-9_]+$/.test(formData.login)) {
    errors.login = 'Логин может содержать только латинские буквы, цифры и подчеркивание';
  }

  // Валидация email
  if (!formData.email.trim()) {
    errors.email = 'Email обязателен';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.email = 'Введите корректный email адрес';
  }

  // Валидация пароля
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

  // Валидация подтверждения пароля
  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Подтверждение пароля обязательно';
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Пароли не совпадают';
  }


  // Дополнительные проверки в зависимости от роли
  if (formData.role === 'student' && !formData.group?.trim()) {
    errors.group = 'Группа обязательна для студента';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};