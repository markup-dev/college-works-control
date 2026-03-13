import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const StudentContext = createContext();

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
};

export const StudentProvider = ({ children }) => {
  const [assignments, setAssignments] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const loadStudentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentsRes, submissionsRes] = await Promise.all([
        api.get('/assignments'),
        api.get('/submissions'),
      ]);

      setAssignments(assignmentsRes.data);
      setStudentSubmissions(submissionsRes.data);
    } catch (err) {
      setError('Ошибка загрузки данных студента');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStudentAssignments = useCallback(async () => {
    return loadStudentData();
  }, [loadStudentData]);

  const submitWork = useCallback(async (assignmentId, file) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('assignment_id', assignmentId);
      if (file) {
        formData.append('file', file);
      }
      formData.append('comment', '');

      await api.post('/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await loadStudentData();

      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Ошибка при отправке работы';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [loadStudentData]);

  useEffect(() => {
    if (user) {
      loadStudentData();
    }
  }, [user, loadStudentData]);

  const value = {
    assignments,
    studentSubmissions,
    loading,
    error,
    loadStudentAssignments,
    submitWork,
  };

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
};
