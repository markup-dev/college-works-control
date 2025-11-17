// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Загрузка текущего пользователя при инициализации
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  // Вход в систему
  const login = useCallback(async (login, password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.login(login, password);
      
      if (result.success) {
        setUser(result.user);
      } else {
        setError(result.error);
      }
      
      return result;
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = 'Ошибка при входе в систему';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  // Выход из системы
  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setError(null);
  }, []);

  // Регистрация
  const register = useCallback(async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.register(userData);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      console.error('Registration error:', err);
      const errorMsg = 'Ошибка при регистрации';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) {
      return { success: false, error: 'Пользователь не авторизован' };
    }

    try {
      const result = await authService.updateUser(user.id, updates);
      if (result.success) {
        setUser(result.user);
      } else {
        setError(result.error);
      }
      return result;
    } catch (err) {
      console.error('Update profile error:', err);
      return { success: false, error: 'Ошибка обновления профиля' };
    }
  }, [user]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!user) {
      return { success: false, error: 'Пользователь не авторизован' };
    }

    try {
      const result = await authService.changePassword(user.id, currentPassword, newPassword);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      console.error('Change password error:', err);
      return { success: false, error: 'Ошибка смены пароля' };
    }
  }, [user]);

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    register,
    updateProfile,
    changePassword,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

