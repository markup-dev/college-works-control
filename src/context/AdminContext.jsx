// src/context/AdminContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import authService from '../services/authService';
import { mockAdminCourses, mockSystemLogs } from '../data/mockData/adminData';

const ADMIN_COURSES_KEY = 'admin_courses';
const ADMIN_LOGS_KEY = 'admin_logs';

const readFromStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error(`Error reading ${key} from storage:`, error);
  }
  return fallback;
};

const writeToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to storage:`, error);
  }
};

const AdminContext = createContext();

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

export const AdminProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalCourses: 0,
    activeCourses: 0,
    totalAssignments: 0,
    pendingSubmissions: 0,
    systemUptime: '100%',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Загрузка данных администратора
  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Имитация загрузки данных
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Получаем реальных пользователей из authService
      const allUsers = authService.getAllUsers();
      const mockStats = {
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter((u) => u.isActive).length,
        totalCourses: mockAdminCourses.length,
        activeCourses: mockAdminCourses.filter((c) => c.status === 'active').length,
        totalAssignments: 45,
        pendingSubmissions: 12,
        systemUptime: '99.8%',
      };

      const storedCourses = readFromStorage(ADMIN_COURSES_KEY, mockAdminCourses);
      const storedLogs = readFromStorage(ADMIN_LOGS_KEY, mockSystemLogs);

      setUsers(allUsers);
      setCourses(storedCourses);
      setSystemLogs(storedLogs);
      writeToStorage(ADMIN_COURSES_KEY, storedCourses);
      writeToStorage(ADMIN_LOGS_KEY, storedLogs);
      setAdminStats(mockStats);
    } catch (err) {
      setError('Ошибка загрузки данных администратора');
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Функции управления пользователями
  const createUser = useCallback(async (userData) => {
    try {
      const result = await authService.register(userData);
      if (result.success) {
        const updatedUsers = authService.getAllUsers();
        setUsers(updatedUsers);
        setSystemLogs(prev => {
          const updatedLogs = [
            {
              id: Date.now(),
              timestamp: new Date().toLocaleString('ru-RU'),
              user: userData.login,
              action: 'create_user',
              details: `Создан пользователь ${userData.name}`
            },
            ...prev
          ];
          writeToStorage(ADMIN_LOGS_KEY, updatedLogs);
          return updatedLogs;
        });
      }
      return result;
    } catch (error) {
      return { success: false, error: 'Ошибка создания пользователя' };
    }
  }, []);

  const updateUser = useCallback(async (userId, userData) => {
    try {
      const result = await authService.updateUser(userId, userData);
      if (result.success) {
        setUsers(authService.getAllUsers());
        setSystemLogs(prev => {
          const updatedLogs = [
            {
              id: Date.now(),
              timestamp: new Date().toLocaleString('ru-RU'),
              user: result.user?.login || 'system',
              action: 'update_user',
              details: `Изменены данные пользователя ID ${userId}`
            },
            ...prev
          ];
          writeToStorage(ADMIN_LOGS_KEY, updatedLogs);
          return updatedLogs;
        });
      }
      return result;
    } catch (error) {
      return { success: false, error: 'Ошибка обновления пользователя' };
    }
  }, []);

  const deleteUser = useCallback(async (userId) => {
    try {
      const result = await authService.deleteUser(userId);
      if (result.success) {
        setUsers(authService.getAllUsers());
        setSystemLogs(prev => {
          const updatedLogs = [
            {
              id: Date.now(),
              timestamp: new Date().toLocaleString('ru-RU'),
              user: 'system',
              action: 'delete_user',
              details: `Удален пользователь ID ${userId}`
            },
            ...prev
          ];
          writeToStorage(ADMIN_LOGS_KEY, updatedLogs);
          return updatedLogs;
        });
      }
      return result;
    } catch (error) {
      return { success: false, error: 'Ошибка удаления пользователя' };
    }
  }, []);

  // Функции управления курсами
  const createCourse = useCallback(async (courseData) => {
    try {
      const newCourse = {
        id: Date.now(),
        ...courseData,
        studentsCount: 0,
        assignmentsCount: 0,
      };
      setCourses((prev) => {
        const updated = [...prev, newCourse];
        writeToStorage(ADMIN_COURSES_KEY, updated);
        return updated;
      });
      setSystemLogs(prev => {
        const updatedLogs = [
          {
            id: Date.now(),
            timestamp: new Date().toLocaleString('ru-RU'),
            user: 'system',
            action: 'create_course',
            details: `Создан курс ${courseData.name}`
          },
          ...prev
        ];
        writeToStorage(ADMIN_LOGS_KEY, updatedLogs);
        return updatedLogs;
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка создания курса' };
    }
  }, []);

  const updateCourse = useCallback(async (courseId, courseData) => {
    try {
      setCourses((prev) => {
        const updated = prev.map((course) =>
          course.id === courseId ? { ...course, ...courseData } : course
        );
        writeToStorage(ADMIN_COURSES_KEY, updated);
        return updated;
      });
      setSystemLogs(prev => {
        const updatedLogs = [
          {
            id: Date.now(),
            timestamp: new Date().toLocaleString('ru-RU'),
            user: 'system',
            action: 'update_course',
            details: `Обновлен курс ID ${courseId}`
          },
          ...prev
        ];
        writeToStorage(ADMIN_LOGS_KEY, updatedLogs);
        return updatedLogs;
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка обновления курса' };
    }
  }, []);

  const value = {
    users,
    courses,
    systemLogs,
    adminStats,
    loading,
    error,
    loadAdminData,
    createUser,
    updateUser,
    deleteUser,
    createCourse,
    updateCourse,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

