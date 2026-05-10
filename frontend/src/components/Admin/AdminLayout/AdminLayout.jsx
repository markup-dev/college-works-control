import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './AdminLayout.scss';

const navItems = [
  { to: '/admin/dashboard', label: 'Дашборд', end: true },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/groups', label: 'Группы' },
  { to: '/admin/subjects', label: 'Предметы' },
  { to: '/admin/assignments-matrix', label: 'Матрица' },
  { to: '/admin/assignments', label: 'Назначения' },
  { to: '/admin/homework', label: 'Задания' },
  { to: '/admin/broadcasts', label: 'Рассылки' },
  { to: '/admin/logs', label: 'Журнал' },
  { to: '/admin/settings', label: 'Настройки' },
];

const AdminLayout = () => (
  <div className="admin-layout">
    <aside className="admin-layout__sidebar" aria-label="Разделы админ-панели">
      <div className="admin-layout__brand">Администрирование</div>
      <nav className="admin-layout__nav">
        {navItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={!!end}
            className={({ isActive }) =>
              `admin-layout__link${isActive ? ' admin-layout__link--active' : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <div className="admin-layout__main">
      <Outlet />
    </div>
  </div>
);

export default AdminLayout;
