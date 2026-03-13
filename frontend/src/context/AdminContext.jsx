import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api';

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
      const [statsRes, usersRes, coursesRes, logsRes, assignmentsRes, submissionsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/courses'),
        api.get('/admin/logs'),
        api.get('/assignments'),
        api.get('/submissions'),
      ]);

      setAdminStats(statsRes.data);
      setUsers(usersRes.data);
      setCourses(coursesRes.data);
      setSystemLogs(logsRes.data);
      setAssignments(assignmentsRes.data);
      setSubmissions(submissionsRes.data);
    } catch (err) {
      setError('Ошибка загрузки данных администратора');
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async (userData) => {
    try {
      const response = await api.post('/admin/users', userData);
      if (response.data.user) {
        await loadAdminData();
        return { success: true, user: response.data.user };
      }
      return { success: false, error: 'Ошибка создания пользователя' };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка создания пользователя';
      return { success: false, error: message };
    }
  }, [loadAdminData]);

  const updateUser = useCallback(async (userId, userData) => {
    try {
      await api.put(`/admin/users/${userId}`, userData);
      await loadAdminData();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка обновления пользователя';
      return { success: false, error: message };
    }
  }, [loadAdminData]);

  const deleteUser = useCallback(async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      await loadAdminData();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка удаления пользователя';
      return { success: false, error: message };
    }
  }, [loadAdminData]);

  const createCourse = useCallback(async (courseData) => {
    try {
      await api.post('/admin/courses', courseData);
      await loadAdminData();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка создания курса';
      return { success: false, error: message };
    }
  }, [loadAdminData]);

  const updateCourse = useCallback(async (courseId, courseData) => {
    try {
      await api.put(`/admin/courses/${courseId}`, courseData);
      await loadAdminData();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка обновления курса';
      return { success: false, error: message };
    }
  }, [loadAdminData]);

  const deleteCourse = useCallback(async (courseId) => {
    try {
      await api.delete(`/admin/courses/${courseId}`);
      await loadAdminData();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка удаления курса';
      return { success: false, error: message };
    }
  }, [loadAdminData]);

  const deleteAssignment = useCallback(async (assignmentId) => {
    try {
      await api.delete(`/admin/assignments/${assignmentId}`);
      await loadAdminData();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка удаления задания';
      return { success: false, error: message };
    }
  }, [loadAdminData]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

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
