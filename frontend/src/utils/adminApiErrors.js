export const firstApiErrorMessage = (data) => {
  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    const flat = Object.values(errors).flat().filter(Boolean);
    if (flat.length) return flat[0];
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();
  return null;
};
