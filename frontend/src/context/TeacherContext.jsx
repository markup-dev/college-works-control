import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const TeacherContext = createContext();

export const useTeacher = () => {
  const context = useContext(TeacherContext);
  if (!context) {
    throw new Error('useTeacher must be used within a TeacherProvider');
  }
  return context;
};

export const TeacherProvider = ({ children }) => {
  const [allTeacherAssignments, setAllTeacherAssignments] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const loadTeacherData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentsRes, submissionsRes] = await Promise.all([
        api.get('/assignments'),
        api.get('/submissions'),
      ]);

      setAllTeacherAssignments(assignmentsRes.data);
      setAllSubmissions(submissionsRes.data);
    } catch (err) {
      setError('Ошибка загрузки данных преподавателя');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeacherAssignments = useCallback(async () => {
    return loadTeacherData();
  }, [loadTeacherData]);

  const loadTeacherSubmissions = useCallback(async () => {
    return loadTeacherData();
  }, [loadTeacherData]);

  const gradeSubmission = useCallback(async (submissionId, score, comment) => {
    setLoading(true);
    try {
      await api.put(`/submissions/${submissionId}/grade`, {
        score: parseInt(score, 10),
        comment,
      });

      await loadTeacherData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при оценке работы' };
    } finally {
      setLoading(false);
    }
  }, [loadTeacherData]);

  const returnSubmission = useCallback(async (submissionId, comment) => {
    setLoading(true);
    try {
      await api.put(`/submissions/${submissionId}/return`, { comment });

      await loadTeacherData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при возврате работы' };
    } finally {
      setLoading(false);
    }
  }, [loadTeacherData]);

  const createAssignment = useCallback(async (assignmentData) => {
    setLoading(true);
    try {
      await api.post('/assignments', {
        title: assignmentData.title || '',
        course: assignmentData.course || '',
        description: assignmentData.description || '',
        deadline: assignmentData.deadline || '',
        maxScore: assignmentData.maxScore || 100,
        submissionType: assignmentData.submissionType || 'file',
        criteria: assignmentData.criteria || [],
        studentGroups: assignmentData.studentGroups || [],
        priority: assignmentData.priority || 'medium',
        allowedFormats: assignmentData.allowedFormats || null,
        maxFileSize: assignmentData.maxFileSize || null,
      });

      await loadTeacherData();
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Ошибка при создании задания';
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [loadTeacherData]);

  const updateAssignment = useCallback(async (assignmentId, updates) => {
    setLoading(true);
    try {
      await api.put(`/assignments/${assignmentId}`, updates);

      await loadTeacherData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при обновлении задания' };
    } finally {
      setLoading(false);
    }
  }, [loadTeacherData]);

  const deleteAssignment = useCallback(async (assignmentId) => {
    setLoading(true);
    try {
      await api.delete(`/assignments/${assignmentId}`);

      await loadTeacherData();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при удалении задания' };
    } finally {
      setLoading(false);
    }
  }, [loadTeacherData]);

  const assignmentsWithSubmissions = useMemo(() => {
    return allTeacherAssignments.map(assignment => {
      const assignmentSubmissions = allSubmissions.filter(
        sub => sub.assignment_id === assignment.id
      );
      const pendingCount = assignmentSubmissions.filter(
        sub => sub.status === 'submitted'
      ).length;

      return {
        ...assignment,
        submissions: assignmentSubmissions,
        submissionsCount: assignmentSubmissions.length,
        pendingCount,
      };
    });
  }, [allTeacherAssignments, allSubmissions]);

  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user, loadTeacherData]);

  const value = {
    teacherAssignments: assignmentsWithSubmissions,
    submissions: allSubmissions,
    loading,
    error,
    loadTeacherAssignments,
    loadTeacherSubmissions,
    gradeSubmission,
    returnSubmission,
    createAssignment,
    updateAssignment,
    deleteAssignment,
  };

  return <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>;
};
