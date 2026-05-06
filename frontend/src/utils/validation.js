export const LOGIN_REGEX = /^[a-zA-Z0-9_]+$/;
export const CYRILLIC_NAME_REGEX = /^[А-Яа-яЁё-]+$/u;
export const GROUP_REGEX = /^[А-ЯЁA-Z0-9-]+$/i;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
export const PHONE_REGEX = /^(\+7\s?\(?\d{3}\)?\s?\d{3}[- ]?\d{2}[- ]?\d{2}|8\(\d{3}\)\d{3}-\d{2}-\d{2})$/;

export const validateNameField = (value, label, required = false) => {
  const trimmedValue = value?.trim() || '';
  if (!trimmedValue) {
    return required ? `Введите ${label.toLowerCase()}` : '';
  }
  if (!CYRILLIC_NAME_REGEX.test(trimmedValue)) {
    return `${label} может содержать только кириллические буквы и дефис`;
  }
  if (trimmedValue.length > 100) {
    return `${label} не должна превышать 100 символов`;
  }
  return '';
};

export const validateLoginValue = (value, label = 'Логин') => {
  const trimmedValue = value?.trim() || '';
  if (!trimmedValue) {
    return `Введите ${label.toLowerCase()}`;
  }
  if (trimmedValue.length < 6) {
    return `${label} должен содержать минимум 6 символов`;
  }
  if (trimmedValue.length > 30) {
    return `${label} не должен превышать 30 символов`;
  }
  if (!LOGIN_REGEX.test(trimmedValue)) {
    return `${label} может содержать только латинские буквы, цифры и подчеркивание`;
  }
  return '';
};

export const validateEmailValue = (value, required = true) => {
  const trimmedValue = value?.trim() || '';
  if (!trimmedValue) {
    return required ? 'Введите email' : '';
  }
  if (trimmedValue.length > 255) {
    return 'Email не должен превышать 255 символов';
  }
  if (!EMAIL_REGEX.test(trimmedValue)) {
    return 'Введите корректный email';
  }
  return '';
};

export const validatePhoneValue = (value, required = false) => {
  const trimmedValue = value?.trim() || '';
  if (!trimmedValue) {
    return required ? 'Введите номер телефона' : '';
  }
  if (!PHONE_REGEX.test(trimmedValue)) {
    return 'Телефон должен быть в формате 8(XXX)XXX-XX-XX или +7 (XXX) XXX-XX-XX';
  }
  return '';
};

export const validatePasswordValue = (value, required = true) => {
  if (!value) {
    return required ? 'Введите пароль' : '';
  }
  if (value.length < 8) {
    return 'Пароль должен содержать минимум 8 символов';
  }
  if (value.length > 128) {
    return 'Пароль не должен превышать 128 символов';
  }
  if (!PASSWORD_REGEX.test(value)) {
    return 'Пароль должен содержать заглавную, строчную букву и цифру';
  }
  return '';
};

export const validateLoginForm = (formData) => {
  const errors = {};
  const loginInput = formData.login?.trim() || '';

  if (!loginInput) {
    errors.login = 'Введите логин или email';
  } else if (loginInput.includes('@')) {
    const emailError = validateEmailValue(loginInput, true);
    if (emailError) {
      errors.login = emailError;
    }
  } else {
    const loginError = validateLoginValue(loginInput);
    if (loginError) {
      errors.login = loginError;
    }
  }

  if (!formData.role) {
    errors.role = 'Выберите роль';
  }

  const passwordError = validatePasswordValue(formData.password, true);
  if (passwordError) {
    errors.password = passwordError;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateRegisterForm = (formData) => {
  const errors = {};

  const lastNameError = validateNameField(formData.lastName, 'Фамилия', true);
  if (lastNameError) errors.lastName = lastNameError;

  const firstNameError = validateNameField(formData.firstName, 'Имя', true);
  if (firstNameError) errors.firstName = firstNameError;

  const middleNameError = validateNameField(formData.middleName, 'Отчество');
  if (middleNameError) errors.middleName = middleNameError;

  const loginError = validateLoginValue(formData.login);
  if (loginError) errors.login = loginError;

  const emailError = validateEmailValue(formData.email, true);
  if (emailError) errors.email = emailError;

  const phoneError = validatePhoneValue(formData.phone, true);
  if (phoneError) errors.phone = phoneError;

  if (!formData.role) {
    errors.role = 'Выберите роль';
  }

  const passwordError = validatePasswordValue(formData.password, true);
  if (passwordError) errors.password = passwordError;

  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Подтвердите пароль';
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Пароли не совпадают';
  }

  const trimmedGroup = formData.group?.trim() || '';
  if (formData.role === 'student') {
    if (!trimmedGroup) {
      errors.group = 'Введите группу студента';
    } else if (!GROUP_REGEX.test(trimmedGroup)) {
      errors.group = 'Группа может содержать только буквы, цифры и дефис';
    } else if (trimmedGroup.length > 20) {
      errors.group = 'Группа не должна превышать 20 символов';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateAssignmentForm = (formData) => {
  const errors = {};

  const trimmedTitle = formData.title?.trim() || '';
  if (!trimmedTitle) {
    errors.title = 'Введите название задания';
  } else if (trimmedTitle.length < 3) {
    errors.title = 'Название должно содержать минимум 3 символа';
  } else if (trimmedTitle.length > 255) {
    errors.title = 'Название не должно превышать 255 символов';
  }

  const trimmedSubject = formData.subject?.trim() || '';
  if (!trimmedSubject) {
    errors.subject = 'Введите название предмета';
  } else if (trimmedSubject.length > 255) {
    errors.subject = 'Название предмета не должно превышать 255 символов';
  }

  const trimmedDescription = formData.description?.trim() || '';
  if (!trimmedDescription) {
    errors.description = 'Введите описание задания';
  } else if (trimmedDescription.length < 10) {
    errors.description = 'Описание должно содержать минимум 10 символов';
  } else if (trimmedDescription.length > 5000) {
    errors.description = 'Описание не должно превышать 5000 символов';
  }

  if (!formData.deadline) {
    errors.deadline = 'Укажите срок сдачи';
  } else {
    const deadline = new Date(formData.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deadline < today) {
      errors.deadline = 'Срок сдачи не может быть в прошлом';
    }
  }

  if (!formData.studentGroups || !Array.isArray(formData.studentGroups) || formData.studentGroups.length === 0) {
    errors.studentGroups = 'Выберите хотя бы одну группу';
  } else if (formData.studentGroups.some((group) => !GROUP_REGEX.test((group || '').trim()))) {
    errors.studentGroups = 'Некорректное название группы в списке';
  }

  const criteria = Array.isArray(formData.criteria)
    ? formData.criteria
        .map((criterion) => ({
          text: typeof criterion === 'string' ? criterion.trim() : (criterion?.text || '').trim(),
          maxPoints: Number(typeof criterion === 'string' ? 0 : criterion?.maxPoints),
        }))
        .filter((criterion) => criterion.text)
    : [];

  if (criteria.length > 0) {
    const hasInvalidPoints = criteria.some((criterion) => !Number.isInteger(criterion.maxPoints) || criterion.maxPoints < 1);

    if (hasInvalidPoints) {
      errors.criteria = 'У каждого критерия должно быть минимум 1 балл';
    } else {
      const criteriaTotal = criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0);

      if (criteriaTotal !== 100) {
        errors.criteria = `Сумма баллов по критериям должна быть 100, сейчас ${criteriaTotal}`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateProfileForm = (formData) => {
  const errors = {};

  const lastNameError = validateNameField(formData.lastName, 'Фамилия', true);
  if (lastNameError) errors.lastName = lastNameError;

  const firstNameError = validateNameField(formData.firstName, 'Имя', true);
  if (firstNameError) errors.firstName = firstNameError;

  const middleNameError = validateNameField(formData.middleName, 'Отчество');
  if (middleNameError) errors.middleName = middleNameError;

  const loginError = validateLoginValue(formData.login);
  if (loginError) errors.login = loginError;

  const emailError = validateEmailValue(formData.email, true);
  if (emailError) errors.email = emailError;

  const phoneError = validatePhoneValue(formData.phone, false);
  if (phoneError) errors.phone = phoneError;

  const trimmedDepartment = formData.department?.trim() || '';
  if (trimmedDepartment.length > 100) {
    errors.department = 'Кафедра не должна превышать 100 символов';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validatePasswordChange = (formData) => {
  const errors = {};

  if (!formData.currentPassword) {
    errors.currentPassword = 'Введите текущий пароль';
  }

  const passwordError = validatePasswordValue(formData.newPassword, true);
  if (passwordError) {
    errors.newPassword = passwordError;
  } else if (formData.currentPassword && formData.newPassword === formData.currentPassword) {
    errors.newPassword = 'Новый пароль не должен совпадать с текущим';
  }

  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Подтвердите новый пароль';
  } else if (formData.newPassword !== formData.confirmPassword) {
    errors.confirmPassword = 'Пароли не совпадают';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};