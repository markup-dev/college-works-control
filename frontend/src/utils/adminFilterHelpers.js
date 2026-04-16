export const updateAdminFilterField = (prevState, field, value) => ({
  ...prevState,
  [field]: value,
  page: field === 'page' ? value : 1,
});

export const resetAdminFilterState = (prevState, defaults) => ({
  ...defaults,
  perPage: prevState?.perPage ?? defaults?.perPage ?? 20,
});

export const prevAdminFilterPage = (prevState, currentPage) => ({
  ...prevState,
  page: Math.max(1, (currentPage || prevState?.page || 1) - 1),
});

export const nextAdminFilterPage = (prevState, currentPage) => ({
  ...prevState,
  page: (currentPage || prevState?.page || 1) + 1,
});
