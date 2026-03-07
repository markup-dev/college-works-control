import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import authService from '../services/authService';
import userService from '../services/userService';

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

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
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

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setError(null);
  }, []);

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
      const updatedUser = userService.updateUser(user.id, updates);
      if (updatedUser) {
        setUser(updatedUser);
        userService.setCurrentUser(updatedUser);
        return { success: true, user: updatedUser };
      } else {
        const errorMsg = 'Ошибка обновления профиля';
        setError(errorMsg);
        return { success: false, error: errorMsg };
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
      const result = await authService.changePassword(user.id, currentPassword, newPassword);
      if (!result.success) {
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