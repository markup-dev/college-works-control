const GENERIC_VALIDATION_MESSAGES = new Set([
  'The given data was invalid.',
  'The given data was invalid',
]);

/** Первое сообщение из тела ответа Laravel (errors → message). */
export const firstApiErrorMessage = (data) => {
  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    const flat = Object.values(errors).flat().filter(Boolean);
    if (flat.length) return String(flat[0]);
  }
  const message = typeof data?.message === 'string' ? data.message.trim() : '';
  if (message && !GENERIC_VALIDATION_MESSAGES.has(message)) return message;
  return null;
};

/** Понятный текст из axios-ошибки; без «Request failed with status code …». */
export const getApiErrorMessage = (error, fallback = 'Произошла ошибка') => {
  const data = error?.response?.data;
  if (data) {
    return firstApiErrorMessage(data) || fallback;
  }
  return fallback;
};
