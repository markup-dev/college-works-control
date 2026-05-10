import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { StudentProvider } from './StudentContext';
import { TeacherProvider } from './TeacherContext';
import { NotificationProvider } from './NotificationContext';

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
      return <>{children}</>;
    default:
      return <>{children}</>;
  }
};

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
