export const readFromStorage = (key, fallback = null) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
  }
  return fallback;
};

export const writeToStorage = (key, value, silent = false) => {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    
    if (!silent) {
      const customEvent = new CustomEvent('storageChange', { detail: { key, value } });
      window.dispatchEvent(customEvent);
    }
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      return false;
    }
    return false;
  }
};

export const generateId = () => {
  const assignments = readFromStorage(STORAGE_KEYS.ASSIGNMENTS, []);
  const submissions = readFromStorage(STORAGE_KEYS.SUBMISSIONS, []);
  
  let maxId = 0;
  
  assignments.forEach(a => {
    const id = typeof a.id === 'number' ? a.id : (typeof a.id === 'string' ? parseInt(a.id, 10) || 0 : 0);
    if (id > maxId) maxId = id;
  });
  
  submissions.forEach(s => {
    const id = typeof s.id === 'number' ? s.id : (typeof s.id === 'string' ? parseInt(s.id, 10) || 0 : 0);
    if (id > maxId) maxId = id;
  });
  
  return maxId + 1;
};

export const STORAGE_KEYS = {
  ASSIGNMENTS: 'college_assignments',
  SUBMISSIONS: 'college_submissions',
  USERS: 'college_users_db',
  CURRENT_USER: 'college_current_user',
  ADMIN_COURSES: 'admin_courses',
  ADMIN_LOGS: 'admin_logs'
};

export const normalizeGroup = (group) => group?.trim().toLowerCase() || '';

