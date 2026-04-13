const DEFAULT_ALLOWED_FORMATS = ['.pdf', '.doc', '.docx', '.zip', '.rar'];

export const normalizeAllowedFormats = (formats = []) => {
  if (!Array.isArray(formats)) {
    return [...DEFAULT_ALLOWED_FORMATS];
  }

  const normalized = formats
    .map((format) => (format || '').toString().trim().toLowerCase())
    .filter(Boolean)
    .map((format) => (format.startsWith('.') ? format : `.${format}`));

  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : [...DEFAULT_ALLOWED_FORMATS];
};

export const getAllowedFormatsFromAssignment = (assignment = {}) => {
  const directFormats = Array.isArray(assignment.allowedFormats) ? assignment.allowedFormats : [];
  const relationFormats = Array.isArray(assignment.allowedFormatItems)
    ? assignment.allowedFormatItems.map((item) => item?.format)
    : [];

  return normalizeAllowedFormats([...directFormats, ...relationFormats]);
};

export { DEFAULT_ALLOWED_FORMATS };
