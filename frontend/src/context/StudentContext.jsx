import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { getApiErrorMessage } from '../utils/adminApiErrors';
import { getAllowedFormatsFromAssignment, getDaysUntilDeadline, PAGINATION_DEFAULTS } from '../utils';
import { resolveAssignmentSubjectId, resolveAssignmentSubjectName } from '../utils/filterHelpers';

const formatAssignmentTeacherDisplay = (teacher) => {
  if (teacher == null) {
    return '';
  }
  if (typeof teacher === 'string') {
    return teacher;
  }
  if (typeof teacher === 'object') {
    const full =
      teacher.fullName
      ?? [teacher.lastName, teacher.firstName]
        .filter(Boolean)
        .join(' ')
        .trim();
    if (full) {
      return full;
    }
    if (teacher.login) {
      return String(teacher.login);
    }
  }
  return '';
};

export const normalizeStudentAssignment = (assignment) => ({
  ...assignment,
  isCompleted: Boolean(assignment.isCompleted),
  subject: resolveAssignmentSubjectName(assignment),
  subjectId: resolveAssignmentSubjectId(assignment),
  teacher: formatAssignmentTeacherDisplay(assignment.teacher),
  studentGroups: assignment.studentGroups || assignment.groups?.map((g) => g.name) || [],
  allowedFormats: getAllowedFormatsFromAssignment(assignment),
  materialFiles: assignment.materialFiles || assignment.materialItems || [],
  criteria: assignment.criteria || assignment.criteriaItems || [],
  retakeUsed: Boolean(assignment.retakeUsed),
  canSubmitFirstAttempt: Boolean(assignment.canSubmitFirstAttempt),
  canSubmitRetake: Boolean(assignment.canSubmitRetake),
});

const normalizeAssignment = normalizeStudentAssignment;

const areQueriesEqual = (a = {}, b = {}) =>
  a.page === b.page
  && a.perPage === b.perPage
  && (a.search || '') === (b.search || '')
  && (a.status || 'all') === (b.status || 'all')
  && (a.subjectId || 'all') === (b.subjectId || 'all')
  && (a.teacherId || 'all') === (b.teacherId || 'all')
  && (a.subject || 'all') === (b.subject || 'all')
  && (a.teacher || 'all') === (b.teacher || 'all')
  && (a.submissionType || 'all') === (b.submissionType || 'all');

const SUBMISSION_CHUNK_SIZE = 1024 * 1024;
const SUBMISSION_CHUNK_CONCURRENCY = 4;

const createUploadId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const uploadSubmissionInChunks = async (assignmentId, file) => {
  const uploadId = createUploadId();
  const totalChunks = Math.ceil(file.size / SUBMISSION_CHUNK_SIZE);

  const uploadChunk = async (chunkIndex) => {
    const start = chunkIndex * SUBMISSION_CHUNK_SIZE;
    const chunk = file.slice(start, Math.min(start + SUBMISSION_CHUNK_SIZE, file.size));
    const formData = new FormData();
    formData.append('assignment_id', String(assignmentId));
    formData.append('upload_id', uploadId);
    formData.append('chunk_index', String(chunkIndex));
    formData.append('total_chunks', String(totalChunks));
    formData.append('file_name', file.name);
    formData.append('file_size', String(file.size));
    formData.append('chunk', chunk, `${file.name}.part${chunkIndex}`);

    await api.post('/submissions/chunks', formData);
  };

  const chunkIndexes = Array.from({ length: totalChunks }, (_, index) => index);
  const workers = Array.from(
    { length: Math.min(SUBMISSION_CHUNK_CONCURRENCY, totalChunks) },
    async () => {
      while (chunkIndexes.length > 0) {
        const nextIndex = chunkIndexes.shift();
        if (typeof nextIndex === 'number') {
          await uploadChunk(nextIndex);
        }
      }
    },
  );
  await Promise.all(workers);

  await api.post('/submissions/chunks/complete', {
    assignmentId,
    uploadId,
    totalChunks,
    fileName: file.name,
    fileSize: file.size,
  });
};

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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const assignmentsQueryRef = useRef(assignmentsQuery);
  const assignmentsRef = useRef(assignments);
  const requestIdRef = useRef(0);
  const inFlightQueryKeyRef = useRef(null);
  const queryCacheRef = useRef(new Map());

  useEffect(() => {
    assignmentsQueryRef.current = assignmentsQuery;
  }, [assignmentsQuery]);

  useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);

  useEffect(() => {
    if (!user) {
      assignmentsQueryRef.current = {
        page: 1,
        perPage: PAGINATION_DEFAULTS.studentAssignments,
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
    const silent = Boolean(options.silent);
    const currentQuery = assignmentsQueryRef.current;
    const nextQuery = {
      page: 1,
      perPage: PAGINATION_DEFAULTS.studentAssignments,
      ...currentQuery,
      ...queryOverrides,
    };

    const params = {
      page: nextQuery.page,
      per_page: nextQuery.perPage,
      search: nextQuery.search || undefined,
      status: nextQuery.status && nextQuery.status !== 'all' ? nextQuery.status : undefined,
      subject_id: nextQuery.subjectId && nextQuery.subjectId !== 'all' ? nextQuery.subjectId : undefined,
      teacher_id: nextQuery.teacherId && nextQuery.teacherId !== 'all' ? nextQuery.teacherId : undefined,
      subject: nextQuery.subject && nextQuery.subject !== 'all' ? nextQuery.subject : undefined,
      teacher: nextQuery.teacher && nextQuery.teacher !== 'all' ? nextQuery.teacher : undefined,
      submission_type: nextQuery.submissionType && nextQuery.submissionType !== 'all'
        ? nextQuery.submissionType
        : undefined,
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
    let toggledLoading = false;
    if (!silent) {
      setLoading(true);
      toggledLoading = true;
    }
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
      if (toggledLoading && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadStudentAssignments = useCallback(async (queryOverrides = {}, fetchOptions = {}) => {
    return loadStudentData(queryOverrides, fetchOptions);
  }, [loadStudentData]);

  const markAssignmentAsSubmitted = useCallback((assignmentId) => {
    const submittedAt = new Date().toISOString();
    const previousAssignment = assignmentsRef.current.find((assignment) => assignment.id === assignmentId);
    const previousStatus = previousAssignment?.status || null;
    const wasUrgent = previousStatus === 'not_submitted'
      && getDaysUntilDeadline(previousAssignment?.deadline) <= 3;
    const currentStatusFilter = assignmentsQueryRef.current?.status || 'all';

    setAssignments((currentAssignments) => {
      const nextAssignments = currentAssignments.map((assignment) => {
        if (assignment.id !== assignmentId) {
          return assignment;
        }

        return {
          ...assignment,
          status: 'submitted',
          submittedAt,
          canSubmitFirstAttempt: false,
          canSubmitRetake: false,
          retakeUsed: previousStatus === 'returned' ? true : assignment.retakeUsed,
        };
      });

      if (currentStatusFilter !== 'all' && currentStatusFilter !== 'submitted') {
        return nextAssignments.filter((assignment) => assignment.id !== assignmentId);
      }

      return nextAssignments;
    });

    setAssignmentsMeta((currentMeta) => {
      const counts = currentMeta?.counts;
      if (!counts || typeof counts !== 'object') {
        return currentMeta;
      }

      const decrease = (value) => Math.max(0, Number(value || 0) - 1);
      const increase = (value) => Number(value || 0) + 1;

      return {
        ...currentMeta,
        counts: {
          ...counts,
          notSubmitted: previousStatus === 'not_submitted' ? decrease(counts.notSubmitted) : counts.notSubmitted,
          returned: previousStatus === 'returned' ? decrease(counts.returned) : counts.returned,
          urgent: wasUrgent ? decrease(counts.urgent) : counts.urgent,
          submitted: previousStatus !== 'submitted' ? increase(counts.submitted) : counts.submitted,
        },
      };
    });
  }, []);

  const submitWork = useCallback(async (assignmentId, file) => {
    setLoading(true);
    try {
      if (file && file.size > SUBMISSION_CHUNK_SIZE) {
        await uploadSubmissionInChunks(assignmentId, file);
      } else {
        const formData = new FormData();
        formData.append('assignment_id', assignmentId);
        if (file) {
          formData.append('file', file);
        }
        formData.append('comment', '');

        await api.post('/submissions', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      queryCacheRef.current.clear();
      markAssignmentAsSubmitted(assignmentId);
      void loadStudentData({ ...assignmentsQueryRef.current }, { force: true, silent: true });

      return { success: true };
    } catch (err) {
      return { success: false, error: getApiErrorMessage(err, 'Ошибка при отправке работы') };
    } finally {
      setLoading(false);
    }
  }, [loadStudentData, markAssignmentAsSubmitted]);

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
