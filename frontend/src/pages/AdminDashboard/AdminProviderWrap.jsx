import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminProvider } from '../../context/AdminContext';

const AdminProviderWrap = () => (
  <AdminProvider>
    <Outlet />
  </AdminProvider>
);

export default AdminProviderWrap;
