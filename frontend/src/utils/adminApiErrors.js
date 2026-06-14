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

const POST_TOO_LARGE_PATTERNS = [
  /post data is too large/i,
  /entity too large/i,
  /payload too large/i,
  /request entity too large/i,
];

const formatPostTooLargeMessage = () =>
  'Файл слишком большой для разовой отправки. Обновите страницу и попробуйте ещё раз.';

/** Понятный текст из axios-ошибки; без «Request failed with status code …». */
export const getApiErrorMessage = (error, fallback = 'Произошла ошибка') => {
  const status = error?.response?.status;
  if (status === 413) {
    return formatPostTooLargeMessage();
  }

  const data = error?.response?.data;
  if (data) {
    const message = firstApiErrorMessage(data);
    if (message && POST_TOO_LARGE_PATTERNS.some((pattern) => pattern.test(message))) {
      return formatPostTooLargeMessage();
    }
    if (message) {
      return message;
    }
  }

  return fallback;
};
