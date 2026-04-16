import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { getAllowedFormatsFromAssignment, PAGINATION_DEFAULTS } from '../utils';

const normalizeAssignment = (assignment) => ({
  ...assignment,
  subject: assignment.subject || assignment.subjectRelation?.name || '',
  studentGroups: assignment.studentGroups || assignment.groups?.map((g) => g.name) || [],
  allowedFormats: getAllowedFormatsFromAssignment(assignment),
  materialFiles: assignment.materialFiles || assignment.materialItems || [],
  retakeUsed: Boolean(assignment.retakeUsed ?? assignment.retake_used),
  canSubmitFirstAttempt: Boolean(assignment.canSubmitFirstAttempt ?? assignment.can_submit_first_attempt),
  canSubmitRetake: Boolean(assignment.canSubmitRetake ?? assignment.can_submit_retake),
});

const areQueriesEqual = (a = {}, b = {}) =>
  a.page === b.page
  && a.perPage === b.perPage
  && a.sort === b.sort
  && (a.search || '') === (b.search || '')
  && (a.status || 'all') === (b.status || 'all')
  && (a.subjectId || 'all') === (b.subjectId || 'all')
  && (a.teacherId || 'all') === (b.teacherId || 'all')
  && (a.subject || 'all') === (b.subject || 'all')
  && (a.teacher || 'all') === (b.teacher || 'all');

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
    perPage: PAGINATION_DEFAULTS.studentAssignments,
    sort: 'priority',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const assignmentsQueryRef = useRef(assignmentsQuery);
  const requestIdRef = useRef(0);
  const inFlightQueryKeyRef = useRef(null);
  const queryCacheRef = useRef(new Map());

  useEffect(() => {
    assignmentsQueryRef.current = assignmentsQuery;
  }, [assignmentsQuery]);

  useEffect(() => {
    if (!user) {
      assignmentsQueryRef.current = {
        page: 1,
        perPage: PAGINATION_DEFAULTS.studentAssignments,
        sort: 'priority',
      };
      setAssignmentsQuery(assignmentsQueryRef.current);
      setAssignments([]);
      setAssignmentsMeta({});
      setStudentSubmissions([]);
      queryCacheRef.current.clear();
    }
  }, [user]);

  const loadStudentData = useCallback(async (queryOverrides = {}, options = {}) => {
    const includeSubmissions = Boolean(options.includeSubmissions);
    const currentQuery = assignmentsQueryRef.current;
    const nextQuery = {
      page: 1,
      perPage: PAGINATION_DEFAULTS.studentAssignments,
      sort: 'priority',
      ...currentQuery,
      ...queryOverrides,
    };

    const params = {
      page: nextQuery.page,
      per_page: nextQuery.perPage,
      sort: nextQuery.sort,
      search: nextQuery.search || undefined,
      status: nextQuery.status && nextQuery.status !== 'all' ? nextQuery.status : undefined,
      subject_id: nextQuery.subjectId && nextQuery.subjectId !== 'all' ? nextQuery.subjectId : undefined,
      teacher_id: nextQuery.teacherId && nextQuery.teacherId !== 'all' ? nextQuery.teacherId : undefined,
      subject: nextQuery.subject && nextQuery.subject !== 'all' ? nextQuery.subject : undefined,
      teacher: nextQuery.teacher && nextQuery.teacher !== 'all' ? nextQuery.teacher : undefined,
    };
    const queryKey = JSON.stringify({ params, includeSubmissions });

    const cached = queryCacheRef.current.get(queryKey);
    const now = Date.now();
    if (cached && !options.force && now - cached.timestamp < 120000) {
      setAssignments(cached.assignments);
      setAssignmentsMeta(cached.meta);
      if (includeSubmissions) {
        setStudentSubmissions(cached.submissions || []);
      }
      if (!areQueriesEqual(assignmentsQueryRef.current, nextQuery)) {
        assignmentsQueryRef.current = nextQuery;
        setAssignmentsQuery(nextQuery);
      }
      setError(null);
      setLoading(false);
      return;
    }

    if (inFlightQueryKeyRef.current === queryKey && !options.force) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    inFlightQueryKeyRef.current = queryKey;
    setLoading(true);
    setError(null);
    try {
      const requests = [api.get('/assignments', { params })];
      if (includeSubmissions) {
        requests.push(api.get('/submissions'));
      }
      const [assignmentsRes, submissionsRes] = await Promise.all(requests);

      const assignmentList = Array.isArray(assignmentsRes.data?.data)
        ? assignmentsRes.data.data
        : (assignmentsRes.data || []);

      if (requestId !== requestIdRef.current) {
        return;
      }

      const normalizedAssignments = assignmentList.map(normalizeAssignment);
      const normalizedSubmissions = includeSubmissions && submissionsRes
        ? (Array.isArray(submissionsRes.data?.data) ? submissionsRes.data.data : (submissionsRes.data || []))
        : [];
      queryCacheRef.current.set(queryKey, {
        assignments: normalizedAssignments,
        meta: assignmentsRes.data?.meta || {},
        submissions: normalizedSubmissions,
        timestamp: Date.now(),
      });

      setAssignments(normalizedAssignments);
      setAssignmentsMeta(assignmentsRes.data?.meta || {});
      if (!areQueriesEqual(assignmentsQueryRef.current, nextQuery)) {
        assignmentsQueryRef.current = nextQuery;
        setAssignmentsQuery(nextQuery);
      }
      if (includeSubmissions && submissionsRes) {
        setStudentSubmissions(normalizedSubmissions);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError('Ошибка загрузки данных студента');
    } finally {
      if (requestId === requestIdRef.current) {
        inFlightQueryKeyRef.current = null;
      }
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

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

      queryCacheRef.current.clear();
      await loadStudentData({}, { force: true });

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
