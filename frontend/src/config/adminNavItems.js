/**
 * Пункты боковой навигации админ-панели (десктоп) и мобильного меню шапки.
 */
export const ADMIN_APP_NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Дашборд', end: true },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/groups', label: 'Группы' },
  { to: '/admin/subjects', label: 'Предметы' },
  { to: '/admin/assignments', label: 'Назначения' },
  { to: '/admin/homework', label: 'Задания' },
  { to: '/admin/broadcasts', label: 'Рассылки' },
  { to: '/admin/logs', label: 'Журнал' },
  { to: '/admin/settings', label: 'Настройки' },
];

export const ADMIN_APP_NAV_WITHOUT_DASHBOARD = ADMIN_APP_NAV_ITEMS.filter(
  (item) => item.to !== '/admin/dashboard',
);
