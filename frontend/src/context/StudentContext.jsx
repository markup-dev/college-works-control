import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { getAllowedFormatsFromAssignment } from '../utils';

const normalizeAssignment = (assignment) => ({
  ...assignment,
  subject: assignment.subject || assignment.subjectRelation?.name || '',
  studentGroups: assignment.studentGroups || assignment.groups?.map((g) => g.name) || [],
  allowedFormats: getAllowedFormatsFromAssignment(assignment),
  materialFiles: assignment.materialFiles || assignment.materialItems || [],
  retakeUsed: Boolean(assignment.retakeUsed),
  canSubmitFirstAttempt: Boolean(assignment.canSubmitFirstAttempt),
  canSubmitRetake: Boolean(assignment.canSubmitRetake),
});

const areQueriesEqual = (a = {}, b = {}) =>
  a.page === b.page
  && a.perPage === b.perPage
  && a.sort === b.sort
  && (a.search || '') === (b.search || '')
  && (a.status || 'all') === (b.status || 'all')
  && (a.subjectId || 'all') === (b.subjectId || 'all')
  && (a.teacherId || 'all') === (b.teacherId || 'all');

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
  const [assignmentsMeta, setAssignmentsMeta] = useState({});
  const [assignmentsQuery, setAssignmentsQuery] = useState({
    page: 1,
    perPage: 18,
    sort: 'priority',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const loadStudentData = useCallback(async (queryOverrides = {}) => {
    const nextQuery = {
      page: 1,
      perPage: 18,
      sort: 'priority',
      ...assignmentsQuery,
      ...queryOverrides,
    };

    const params = {
      page: nextQuery.page,
      perPage: nextQuery.perPage,
      sort: nextQuery.sort,
      search: nextQuery.search || undefined,
      status: nextQuery.status && nextQuery.status !== 'all' ? nextQuery.status : undefined,
      subjectId: nextQuery.subjectId && nextQuery.subjectId !== 'all' ? nextQuery.subjectId : undefined,
      teacherId: nextQuery.teacherId && nextQuery.teacherId !== 'all' ? nextQuery.teacherId : undefined,
    };

    setLoading(true);
    setError(null);
    try {
      const [assignmentsRes, submissionsRes] = await Promise.all([
        api.get('/assignments', { params }),
        api.get('/submissions'),
      ]);

      const assignmentList = Array.isArray(assignmentsRes.data?.data)
        ? assignmentsRes.data.data
        : (assignmentsRes.data || []);

      setAssignments(assignmentList.map(normalizeAssignment));
      setAssignmentsMeta(assignmentsRes.data?.meta || {});
      if (!areQueriesEqual(assignmentsQuery, nextQuery)) {
        setAssignmentsQuery(nextQuery);
      }
      setStudentSubmissions(submissionsRes.data);
    } catch (err) {
      setError('Ошибка загрузки данных студента');
    } finally {
      setLoading(false);
    }
  }, [assignmentsQuery]);

  const loadStudentAssignments = useCallback(async (queryOverrides = {}) => {
    return loadStudentData(queryOverrides);
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
      const validationErrors = err.response?.data?.errors;
      const firstValidationMessage = validationErrors
        ? Object.values(validationErrors).flat().find((message) => typeof message === 'string' && message.trim() !== '')
        : '';
      const message = firstValidationMessage || err.response?.data?.message || 'Ошибка при отправке работы';
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
    assignmentsMeta,
    assignmentsQuery,
    loading,
    error,
    loadStudentAssignments,
    submitWork,
  };

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
};
