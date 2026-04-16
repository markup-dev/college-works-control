import {
  GROUP_REGEX,
  validateEmailValue,
  validateLoginValue,
  validateNameField,
  validatePasswordValue,
  validatePhoneValue,
} from './validation';

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