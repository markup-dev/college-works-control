export const TEACHER_DASHBOARD_NAV_ITEMS = [
  { id: 'assignments', label: 'Мои задания' },
  { id: 'submissions', label: 'Работы студентов' },
  { id: 'completed', label: 'Завершенные' },
  { id: 'analytics', label: 'Аналитика' },
  { id: 'students', label: 'Группы' },
  { id: 'disciplines', label: 'Мои дисциплины' },
];

export const DEFAULT_TEACHER_DASHBOARD_TAB = 'assignments';

const TAB_IDS = new Set(TEACHER_DASHBOARD_NAV_ITEMS.map(({ id }) => id));

export const resolveTeacherDashboardTab = (value) => (
  value && TAB_IDS.has(value) ? value : DEFAULT_TEACHER_DASHBOARD_TAB
);

export const buildTeacherDashboardTabPath = (tabId) => {
  const tab = resolveTeacherDashboardTab(tabId);
  return tab === DEFAULT_TEACHER_DASHBOARD_TAB ? '/teacher' : `/teacher?tab=${tab}`;
};

export const isTeacherDashboardTabActive = (location, tabId) => {
  if (!/^\/teacher\/?$/.test(location?.pathname || '')) {
    return false;
  }
  const params = new URLSearchParams(location.search || '');
  return resolveTeacherDashboardTab(params.get('tab')) === tabId;
};
