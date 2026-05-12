const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const RU_LOCALE = 'ru-RU';

const parseDateValue = (value) => {
  if (!value) return null;

  const raw = String(value);
  const dateOnly = raw.match(DATE_ONLY_PATTERN);

  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  return new Date(raw);
};

export const formatDateLong = (value, fallback = '—') => {
  const date = parseDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString(RU_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const formatDateTime = (value, fallback = '—') => {
  const date = parseDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString(RU_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateTimeWithSeconds = (value, fallback = '—') => {
  const date = parseDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString(RU_LOCALE, {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
};

export const formatDateTimeShortMonth = (value, fallback = '—') => {
  const date = parseDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString(RU_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateTimeCompact = (value, fallback = '—') => {
  const date = parseDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString(RU_LOCALE, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateRelative = (value) => {
  const date = parseDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;

  return formatDateLong(value);
};
