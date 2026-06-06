import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState(null);
  const logoutPromiseRef = useRef(null);

  useEffect(() => {
    const savedUser = authService.getCurrentUser();
    if (savedUser && authService.getToken()) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (login, password, role) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.login(login, password, role);

      if (result.success) {
        setUser(result.user);
      } else {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMsg = 'Ошибка при входе в систему';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (logoutPromiseRef.current) {
      return logoutPromiseRef.current;
    }

    const logoutPromise = (async () => {
      setLoggingOut(true);
      try {
        await authService.logout();
        setUser(null);
        setError(null);
      } finally {
        setLoggingOut(false);
        logoutPromiseRef.current = null;
      }
    })();

    logoutPromiseRef.current = logoutPromise;
    return logoutPromise;
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) {
      return { success: false, error: 'Пользователь не авторизован' };
    }

    try {
      const result = await authService.updateProfile(updates);
      if (result.success) {
        setUser(result.user);
        return { success: true, user: result.user };
      } else {
        setError(result.error);
        return result;
      }
    } catch (err) {
      return { success: false, error: 'Ошибка обновления профиля' };
    }
  }, [user]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) {
      return { success: false, error: 'Пользователь не авторизован' };
    }

    try {
      const result = await authService.changePassword(currentPassword, newPassword);
      if (result.success && result.user) {
        setUser(result.user);
      } else if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      return { success: false, error: 'Ошибка смены пароля' };
    }
  }, [user]);

  const value = {
    user,
    loading,
    loggingOut,
    error,
    login,
    logout,
    updateProfile,
    changePassword,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
