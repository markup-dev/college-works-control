import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { StudentProvider } from './StudentContext';
import { TeacherProvider } from './TeacherContext';
import { AdminProvider } from './AdminContext';
import { NotificationProvider } from './NotificationContext';
import { initializeStorage } from '../utils/dataInitializer';

const DataInitializer = ({ children }) => {
  useEffect(() => {
    initializeStorage();
  }, []);
  return <>{children}</>;
};

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

export const RootProvider = ({ children }) => {
  return (
    <NotificationProvider>
      <DataInitializer>
        <AuthProvider>
          <RoleBasedProvider>
            {children}
          </RoleBasedProvider>
        </AuthProvider>
      </DataInitializer>
    </NotificationProvider>
  );
};
