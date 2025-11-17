// src/context/RootProvider.jsx
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { StudentProvider } from './StudentContext';
import { TeacherProvider } from './TeacherContext';
import { AdminProvider } from './AdminContext';
import { NotificationProvider } from './NotificationContext';

// Компонент для условного рендеринга провайдеров по роли
// Должен быть внутри AuthProvider, чтобы использовать useAuth
const RoleBasedProvider = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <>{children}</>;
  }

  switch (user.role) {
    case 'student':
      return <StudentProvider>{children}</StudentProvider>;
    case 'teacher':
      return <TeacherProvider>{children}</TeacherProvider>;
    case 'admin':
      return <AdminProvider>{children}</AdminProvider>;
    default:
      return <>{children}</>;
  }
};

// Главный провайдер, объединяющий все контексты
export const RootProvider = ({ children }) => {
  return (
    <NotificationProvider>
      <AuthProvider>
        <RoleBasedProvider>
          {children}
        </RoleBasedProvider>
      </AuthProvider>
    </NotificationProvider>
  );
};

