export const countDigitsBeforeCaret = (str, caret) => {
  let n = 0;
  const end = Math.min(caret ?? str.length, str.length);
  for (let i = 0; i < end; i++) {
    if (/\d/.test(str[i])) n += 1;
  }
  return n;
};

export const caretAfterNthDigit = (formatted, n) => {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === n) return i + 1;
    }
  }
  return formatted.length;
};

/** К 8(###)###-##-## или +7 (###) ###-##-## — совместимо с regex бэкенда. */
export const formatRuPhoneDisplay = (rawInput) => {
  const trimmed = rawInput.trim();
  if (!trimmed.replace(/\D/g, '') && (trimmed === '+' || trimmed === '')) {
    return trimmed === '+' ? '+' : '';
  }

  let digits = rawInput.replace(/\D/g, '').slice(0, 11);
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
  return digits.length === 0 || digits.length === 11;
};
