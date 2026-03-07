import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import authService from '../services/authService';
import userService from '../services/userService';
import { mockAdminCourses, mockSystemLogs } from '../data/mockData/adminData';
import { readFromStorage, writeToStorage, STORAGE_KEYS, generateId } from '../utils/storageUtils';

const ADMIN_COURSES_KEY = STORAGE_KEYS.ADMIN_COURSES;
const ADMIN_LOGS_KEY = STORAGE_KEYS.ADMIN_LOGS;

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
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
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

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = userService.getAllUsers();
      const storedCourses = readFromStorage(ADMIN_COURSES_KEY, mockAdminCourses);
      const storedLogs = readFromStorage(ADMIN_LOGS_KEY, mockSystemLogs);
      const storedAssignments = readFromStorage(STORAGE_KEYS.ASSIGNMENTS, []);
      const storedSubmissions = readFromStorage(STORAGE_KEYS.SUBMISSIONS, []);

      const totalAssignments = storedAssignments.length;
      const pendingSubmissions = storedSubmissions.filter(s => s.status === 'submitted').length;

      const calculatedStats = {
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter((u) => u.isActive === true).length,
        totalCourses: storedCourses.length,
        activeCourses: storedCourses.filter((c) => c.status === 'active').length,
        totalAssignments: totalAssignments,
        pendingSubmissions: pendingSubmissions,
        systemUptime: '99.8%',
      };

      setUsers(allUsers);
      setCourses(storedCourses);
      setAssignments(storedAssignments);
      setSubmissions(storedSubmissions);
      setSystemLogs(storedLogs);
      setAdminStats(calculatedStats);
    } catch (err) {
      setError('Ошибка загрузки данных администратора');
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async (userData) => {
    try {
      const result = await authService.register(userData);
      if (result.success) {
        const updatedUsers = userService.getAllUsers();
        setUsers(updatedUsers);
        setAdminStats(prev => ({
          ...prev,
          totalUsers: updatedUsers.length,
          activeUsers: updatedUsers.filter((u) => u.isActive === true).length,
        }));
        setSystemLogs(prev => {
          const updatedLogs = [
            {
              id: generateId(),
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
      const result = await userService.updateUser(userId, userData);
      if (result) {
        const updatedUsers = userService.getAllUsers();
        setUsers(updatedUsers);
        setAdminStats(prev => ({
          ...prev,
          totalUsers: updatedUsers.length,
          activeUsers: updatedUsers.filter((u) => u.isActive === true).length,
        }));
        setSystemLogs(prev => {
          const updatedLogs = [
            {
              id: generateId(),
              timestamp: new Date().toLocaleString('ru-RU'),
              user: 'system',
              action: 'update_user',
              details: `Изменены данные пользователя ID ${userId}`
            },
            ...prev
          ];
          writeToStorage(ADMIN_LOGS_KEY, updatedLogs);
          return updatedLogs;
        });
        return { success: true };
      }
      return { success: false, error: 'Ошибка обновления пользователя' };
    } catch (error) {
      return { success: false, error: 'Ошибка обновления пользователя' };
    }
  }, []);

  const deleteUser = useCallback(async (userId) => {
    try {
      const result = userService.deleteUser(userId);
      if (result) {
        const updatedUsers = userService.getAllUsers();
        setUsers(updatedUsers);
        setAdminStats(prev => ({
          ...prev,
          totalUsers: updatedUsers.length,
          activeUsers: updatedUsers.filter((u) => u.isActive === true).length,
        }));
        setSystemLogs(prev => {
          const updatedLogs = [
            {
              id: generateId(),
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
        return { success: true };
      }
      return { success: false, error: 'Ошибка удаления пользователя' };
    } catch (error) {
      return { success: false, error: 'Ошибка удаления пользователя' };
    }
  }, []);

  const createCourse = useCallback(async (courseData) => {
    try {
      const newCourse = {
        id: generateId(),
        ...courseData,
        studentsCount: 0,
        assignmentsCount: 0,
      };
      setCourses((prev) => {
        const updated = [...prev, newCourse];
        writeToStorage(ADMIN_COURSES_KEY, updated);
        setAdminStats(prevStats => ({
          ...prevStats,
          totalCourses: updated.length,
          activeCourses: updated.filter((c) => c.status === 'active').length,
        }));
        return updated;
      });
      setSystemLogs(prev => {
        const updatedLogs = [
          {
            id: generateId(),
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
        setAdminStats(prevStats => ({
          ...prevStats,
          totalCourses: updated.length,
          activeCourses: updated.filter((c) => c.status === 'active').length,
        }));
        return updated;
      });
      setSystemLogs(prev => {
        const updatedLogs = [
          {
            id: generateId(),
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

  const deleteCourse = useCallback(async (courseId) => {
    try {
      setCourses((prev) => {
        const updated = prev.filter((course) => course.id !== courseId);
        writeToStorage(ADMIN_COURSES_KEY, updated);
        setAdminStats(prevStats => ({
          ...prevStats,
          totalCourses: updated.length,
          activeCourses: updated.filter((c) => c.status === 'active').length,
        }));
        return updated;
      });
      setSystemLogs(prev => {
        const updatedLogs = [
          {
            id: generateId(),
            timestamp: new Date().toLocaleString('ru-RU'),
            user: 'system',
            action: 'delete_course',
            details: `Удален курс ID ${courseId}`
          },
          ...prev
        ];
        writeToStorage(ADMIN_LOGS_KEY, updatedLogs);
        return updatedLogs;
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка удаления курса' };
    }
  }, []);

  const deleteAssignment = useCallback(async (assignmentId) => {
    try {
      const storedAssignments = readFromStorage(STORAGE_KEYS.ASSIGNMENTS, []);
      const updatedAssignments = storedAssignments.filter(a => a.id !== assignmentId);
      writeToStorage(STORAGE_KEYS.ASSIGNMENTS, updatedAssignments);
      setAssignments(updatedAssignments);
      
      const storedSubmissions = readFromStorage(STORAGE_KEYS.SUBMISSIONS, []);
      const updatedSubmissions = storedSubmissions.filter(s => s.assignmentId !== assignmentId);
      writeToStorage(STORAGE_KEYS.SUBMISSIONS, updatedSubmissions);
      setSubmissions(updatedSubmissions);
      
      setAdminStats(prev => ({
        ...prev,
        totalAssignments: updatedAssignments.length,
        pendingSubmissions: updatedSubmissions.filter(s => s.status === 'submitted').length,
      }));
      
      setSystemLogs(prev => {
        const updatedLogs = [
          {
            id: generateId(),
            timestamp: new Date().toLocaleString('ru-RU'),
            user: 'system',
            action: 'delete_assignment',
            details: `Удалено задание ID ${assignmentId}`
          },
          ...prev
        ];
        writeToStorage(ADMIN_LOGS_KEY, updatedLogs);
        return updatedLogs;
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка удаления задания' };
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.detail?.key === STORAGE_KEYS.ASSIGNMENTS || e.detail?.key === STORAGE_KEYS.SUBMISSIONS) {
        const storedAssignments = readFromStorage(STORAGE_KEYS.ASSIGNMENTS, []);
        const storedSubmissions = readFromStorage(STORAGE_KEYS.SUBMISSIONS, []);
        setAssignments(storedAssignments);
        setSubmissions(storedSubmissions);
        setAdminStats(prev => ({
          ...prev,
          totalAssignments: storedAssignments.length,
          pendingSubmissions: storedSubmissions.filter(s => s.status === 'submitted').length,
        }));
      }
    };

    window.addEventListener('storageChange', handleStorageChange);
    return () => window.removeEventListener('storageChange', handleStorageChange);
  }, []);

  const value = {
    users,
    courses,
    assignments,
    submissions,
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
    deleteCourse,
    deleteAssignment,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
