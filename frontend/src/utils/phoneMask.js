/**
 * Поле профиля: маска под бэкенд-валидацию (см. PHONE_REGEX в validation.js).
 * Канонический вид: "+7 (XXX) XXX-XX-XX".
 * Удобный ввод: 8XXXXXXXXXX, +7..., 10 цифр (часто 9XXXXXXXXX без кода страны).
 */

const MAX_TOTAL_DIGITS = 11;

export const countDigitsBeforeCaret = (str, caret) => {
  let n = 0;
  const end = Math.min(caret ?? str.length, str.length);
  for (let i = 0; i < end; i += 1) {
    if (/\d/.test(str[i])) n += 1;
  }
  return n;
};

export const caretAfterNthDigit = (formatted, n) => {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === n) return i + 1;
    }
  }
  return formatted.length;
};

/** Последовательность цифр в форме 7xxxxxxxxxx — как в поле профиля. */
export function extractProfilePhoneDigits(input) {
  let digits = String(input ?? '').replace(/\D/g, '').slice(0, MAX_TOTAL_DIGITS);
  if (!digits.length) return '';
  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`.slice(0, MAX_TOTAL_DIGITS);
  }
  return digits.slice(0, MAX_TOTAL_DIGITS);
}

/** Позиция курсора сразу после k-й цифры в уже отформатированной строке (k — сколько цифр должно быть слева от курсора). */
export function caretIndexAfterDigitCount(formatted, digitsBeforeCaret) {
  return caretAfterNthDigit(formatted ?? '', digitsBeforeCaret);
}

/**
 * Backspace при курсоре на/после скобки, пробела, «+»: удаляем ближайшую слева цифру.
 * @returns {{ formatted: string, caret: number } | null} null — отдать событию браузера
 */
export function resolveProfilePhoneBackspace(formatted, caretIndex) {
  const val = formatted ?? '';
  const caret = Math.min(Math.max(caretIndex, 0), val.length);

  let removeCharIndex = -1;
  for (let i = caret - 1; i >= 0; i -= 1) {
    if (/\d/.test(val[i])) {
      removeCharIndex = i;
      break;
    }
  }
  if (removeCharIndex < 0) return null;

  let ordinalToDrop = null;
  for (let i = 0, od = -1; i <= removeCharIndex; i += 1) {
    if (/\d/.test(val[i])) {
      od += 1;
      if (i === removeCharIndex) ordinalToDrop = od;
    }
  }
  if (ordinalToDrop == null || ordinalToDrop < 0) return null;

  const all = extractProfilePhoneDigits(val);
  if (!all.length || ordinalToDrop >= all.length) return null;

  const newDigits = `${all.slice(0, ordinalToDrop)}${all.slice(ordinalToDrop + 1)}`;
  const newFormatted = formatProfilePhoneRu(newDigits);
  /** Курсор в конец: при стирании скобки/пробела не теряется «шаг удаления». */
  const nextCaret = newFormatted.length;

  return { formatted: newFormatted, caret: nextCaret };
}

/** Delete справа: если под курсором не цифра — удаляем ближайшую справа. */
export function resolveProfilePhoneDeleteForward(formatted, caretIndex) {
  const val = formatted ?? '';
  const caret = Math.min(Math.max(caretIndex, 0), val.length);

  let removeCharIndex = -1;
  for (let i = caret; i < val.length; i += 1) {
    if (/\d/.test(val[i])) {
      removeCharIndex = i;
      break;
    }
  }
  if (removeCharIndex < 0) return null;

  let ordinalToDrop = null;
  for (let i = 0, od = -1; i <= removeCharIndex; i += 1) {
    if (/\d/.test(val[i])) {
      od += 1;
      if (i === removeCharIndex) ordinalToDrop = od;
    }
  }
  if (ordinalToDrop == null || ordinalToDrop < 0) return null;

  const all = extractProfilePhoneDigits(val);
  if (!all.length || ordinalToDrop >= all.length) return null;

  const newDigits = `${all.slice(0, ordinalToDrop)}${all.slice(ordinalToDrop + 1)}`;
  const newFormatted = formatProfilePhoneRu(newDigits);
  const nextCaret = newFormatted.length;

  return { formatted: newFormatted, caret: nextCaret };
}

export function formatProfilePhoneRu(input) {
  const digits = extractProfilePhoneDigits(input);

  if (!digits.length) {
    return '';
  }

  let subscriber = digits.startsWith('7') ? digits.slice(1) : digits;
  subscriber = subscriber.slice(0, 10);

  if (!subscriber.length) {
    return '+7';
  }

  const a = subscriber.slice(0, 3);
  const b = subscriber.slice(3, 6);
  const c = subscriber.slice(6, 8);
  const d = subscriber.slice(8, 10);

  let out = '+7 (';
  out += a;
  if (a.length === 3) {
    out += ')';
    if (b.length) {
      out += ` ${b}`;
    }
    if (b.length === 3 && (c.length || d.length)) {
      out += '-';
    }
    out += c;
    if (c.length === 2 && d.length) {
      out += '-';
      out += d;
    }
  }

  return out;
}

/** К 8(###)###-##-## или +7 (###) ###-##-## — совместимо с regex бэкенда. */
export const formatRuPhoneDisplay = (rawInput) => {
  const raw = String(rawInput ?? '');
  const trimmed = raw.trim();
  if (!trimmed.replace(/\D/g, '') && (trimmed === '+' || trimmed === '')) {
    return trimmed === '+' ? '+' : '';
  }

  let digits = raw.replace(/\D/g, '').slice(0, MAX_TOTAL_DIGITS);
  if (digits.length === 10 && digits[0] === '9') {
    digits = `7${digits}`;
  }

  if (!digits) return '';

  if (digits[0] === '8') {
    const rest = digits.slice(1);
    let out = '8';
    if (rest.length === 0) return out;
    out += `(${rest.slice(0, 3)}`;
    if (rest.length <= 3) return out;
    out += `)${rest.slice(3, 6)}`;
    if (rest.length <= 6) return out;
    out += `-${rest.slice(6, 8)}`;
    if (rest.length <= 8) return out;
    out += `-${rest.slice(8, 10)}`;
    return out;
  }

  if (digits[0] === '7') {
    const rest = digits.slice(1);
    let out = '+7';
    if (rest.length === 0) return out;
    out += ` (${rest.slice(0, 3)}`;
    if (rest.length <= 3) return out;
    out += `) ${rest.slice(3, 6)}`;
    if (rest.length <= 6) return out;
    out += `-${rest.slice(6, 8)}`;
    if (rest.length <= 8) return out;
    out += `-${rest.slice(8, 10)}`;
    return out;
  }

  return digits;
};

export const isPhoneCompleteOrEmpty = (phoneValue) => {
  const digits = String(phoneValue || '').replace(/\D/g, '');
  return digits.length === 0 || digits.length === MAX_TOTAL_DIGITS;
};

/** Отправка в API: только канонический номер или пустая строка. */
export function normalizeProfilePhoneForSubmit(input) {
  const formatted = formatProfilePhoneRu(input);
  if (!formatted || formatted === '+7') return '';
  return formatted;
}
