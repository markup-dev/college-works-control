import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ADMIN_APP_NAV_ITEMS } from '../../../config/adminNavItems';
import PageShell from '../../UI/PageShell/PageShell';
import './AdminLayout.scss';

const AdminLayout = () => (
  <PageShell className="admin-dashboard app-page" contentClassName="admin-layout" maxWidth="wide">
    <aside className="admin-layout__sidebar" aria-label="Разделы админ-панели">
      <div className="admin-layout__brand">Администрирование</div>
      <nav className="admin-layout__nav">
        {ADMIN_APP_NAV_ITEMS.map(({ to, label, end }) => (
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
  </PageShell>
);

export default AdminLayout;
