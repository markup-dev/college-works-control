import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import api from '../services/api';
import { DEFAULT_ALLOWED_FORMATS, getAllowedFormatsFromAssignment, normalizeGroupName, PAGINATION_DEFAULTS } from '../utils';

const normalizeAssignment = (assignment) => ({
  ...assignment,
  subject: assignment.subject || assignment.subjectRelation?.name || '',
  subjectId: assignment.subjectId || assignment.subject_id || assignment.subjectRelation?.id || null,
  studentGroups: assignment.studentGroups || assignment.groups?.map((g) => g.name) || [],
  allowedFormats: getAllowedFormatsFromAssignment(assignment),
  materialFiles: assignment.materialFiles || assignment.materialItems || [],
});

const normalizeSubmission = (submission) => ({
  ...submission,
  subject: submission.subject || submission.subjectName || '',
  group: normalizeGroupName(submission.group || submission.groupName || ''),
  teacherComment: submission.teacherComment || '',
  submissionType: submission.submissionType || 'file',
});

const parsePositiveId = (raw) => {
  if (raw == null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getCreatedAssignmentIdFromResponse = (response) => {
  const headers = response?.headers;
  const headerRaw =
    (typeof headers?.get === 'function' ? headers.get('x-created-assignment-id') : null)
    ?? headers?.['x-created-assignment-id']
    ?? headers?.['X-Created-Assignment-Id'];
  const fromHeader = parsePositiveId(headerRaw);
  if (fromHeader) {
    return fromHeader;
  }

  let data = response?.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') {
    return null;
  }

  const topLevel = parsePositiveId(data.assignmentId ?? data.assignment_id);
  if (topLevel) {
    return topLevel;
  }

  const fromObject = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return null;
    }
    return parsePositiveId(obj.id ?? obj.assignmentId ?? obj.assignment_id);
  };

  return (
    fromObject(data.assignment)
    ?? fromObject(data.data)
    ?? fromObject(data.data?.assignment)
  );
};

const getApiErrorMessage = (error, fallback) => {
  const responseData = error?.response?.data;
  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message;
  }

  const firstFieldError = responseData?.errors
    ? Object.values(responseData.errors).flat().find(Boolean)
    : null;

  return firstFieldError || fallback;
};

const areQueriesEqual = (a = {}, b = {}) =>
  a.page === b.page
  && a.perPage === b.perPage
  && a.sort === b.sort
  && (a.search || '') === (b.search || '')
  && (a.status || 'all') === (b.status || 'all')
  && (a.group || 'all') === (b.group || 'all')
  && (a.subjectId || 'all') === (b.subjectId || 'all')
  && (a.assignmentId || 'all') === (b.assignmentId || 'all')
  && String(a.studentId || 'all') === String(b.studentId || 'all');

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
  const [assignmentsMeta, setAssignmentsMeta] = useState({});
  const [submissionsMeta, setSubmissionsMeta] = useState({});
  const [assignmentsQuery, setAssignmentsQuery] = useState({
    page: 1,
    perPage: PAGINATION_DEFAULTS.teacherAssignments,
    sort: 'priority',
  });
  const [submissionsQuery, setSubmissionsQuery] = useState({
    page: 1,
    perPage: PAGINATION_DEFAULTS.teacherSubmissions,
    sort: 'newest',
  });
  const assignmentsQueryRef = useRef(assignmentsQuery);
  const submissionsQueryRef = useRef(submissionsQuery);
  const [metaSubjects, setMetaSubjects] = useState([]);
  const [metaGroups, setMetaGroups] = useState([]);
  const [metaAssignments, setMetaAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTeacherAssignments = useCallback(async (queryOverrides = {}) => {
    const currentQuery = assignmentsQueryRef.current;
    const nextQuery = {
      page: 1,
      perPage: PAGINATION_DEFAULTS.teacherAssignments,
      sort: 'priority',
      ...currentQuery,
      ...queryOverrides,
    };
    const params = {
      page: nextQuery.page,
      per_page: nextQuery.perPage,
      sort: nextQuery.sort,
      search: nextQuery.search || undefined,
      group: nextQuery.group && nextQuery.group !== 'all' ? nextQuery.group : undefined,
      subject_id: nextQuery.subjectId && nextQuery.subjectId !== 'all' ? nextQuery.subjectId : undefined,
      status: nextQuery.status && nextQuery.status !== 'all' ? nextQuery.status : undefined,
    };

    setLoading(true);
    setError(null);
    try {
      const assignmentsRes = await api.get('/assignments', { params });
      const assignmentList = Array.isArray(assignmentsRes.data?.data)
        ? assignmentsRes.data.data
        : (assignmentsRes.data || []);

      setAllTeacherAssignments(assignmentList.map(normalizeAssignment));
      setAssignmentsMeta(assignmentsRes.data?.meta || {});
      if (!areQueriesEqual(assignmentsQueryRef.current, nextQuery)) {
        assignmentsQueryRef.current = nextQuery;
        setAssignmentsQuery(nextQuery);
      }
    } catch (err) {
      setError('Ошибка загрузки данных преподавателя');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeacherSubmissions = useCallback(async (queryOverrides = {}) => {
    const currentQuery = submissionsQueryRef.current;
    const nextQuery = {
      page: 1,
      perPage: PAGINATION_DEFAULTS.teacherSubmissions,
      sort: 'newest',
      ...currentQuery,
      ...queryOverrides,
    };
    const params = {
      page: nextQuery.page,
      per_page: nextQuery.perPage,
      sort: nextQuery.sort,
      search: nextQuery.search || undefined,
      status: nextQuery.status && nextQuery.status !== 'all' ? nextQuery.status : undefined,
      assignment_id: nextQuery.assignmentId && nextQuery.assignmentId !== 'all' ? nextQuery.assignmentId : undefined,
      subject_id: nextQuery.subjectId && nextQuery.subjectId !== 'all' ? nextQuery.subjectId : undefined,
      group: nextQuery.group && nextQuery.group !== 'all' ? nextQuery.group : undefined,
      student_id:
        nextQuery.studentId && nextQuery.studentId !== 'all'
          ? Number(nextQuery.studentId)
          : undefined,
    };

    setLoading(true);
    setError(null);
    try {
      const submissionsRes = await api.get('/submissions', { params });
      const submissionList = Array.isArray(submissionsRes.data?.data)
        ? submissionsRes.data.data
        : (submissionsRes.data || []);

      setAllSubmissions(submissionList.map(normalizeSubmission));
      setSubmissionsMeta(submissionsRes.data?.meta || {});
      if (!areQueriesEqual(submissionsQueryRef.current, nextQuery)) {
        submissionsQueryRef.current = nextQuery;
        setSubmissionsQuery(nextQuery);
      }
    } catch (err) {
      setError('Ошибка загрузки данных преподавателя');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTeacherMeta = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) {
      setLoading(true);
    }
    try {
      const metaRes = await api.get('/assignments/meta');
      setMetaSubjects(Array.isArray(metaRes?.data?.subjects) ? metaRes.data.subjects : []);
      setMetaGroups(Array.isArray(metaRes?.data?.groups) ? metaRes.data.groups : []);
      setMetaAssignments(Array.isArray(metaRes?.data?.assignments) ? metaRes.data.assignments : []);
      setError(null);
    } catch {
      setError('Ошибка загрузки данных преподавателя');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const loadTeacherData = useCallback(async (options = {}) => {
    const includeAssignments = options.includeAssignments !== false;
    const includeSubmissions = options.includeSubmissions !== false;
    setLoading(true);
    setError(null);
    try {
      await loadTeacherMeta({ silent: true });

      const requests = [];
      if (includeAssignments) {
        requests.push(loadTeacherAssignments());
      }
      if (includeSubmissions) {
        requests.push(loadTeacherSubmissions());
      }

      if (requests.length > 0) {
        await Promise.all(requests);
      }
    } catch {
      setError('Ошибка загрузки данных преподавателя');
    } finally {
      setLoading(false);
    }
  }, [loadTeacherAssignments, loadTeacherMeta, loadTeacherSubmissions]);

  const gradeSubmission = useCallback(async (submissionId, score, comment, criterionScores = []) => {
    setLoading(true);
    try {
      await api.put(`/submissions/${submissionId}/grade`, {
        score: parseInt(score, 10),
        comment,
        criterionScores,
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

  const uploadAssignmentMaterials = useCallback(async (assignmentId, materialFiles = [], removedMaterialIds = []) => {
    const files = Array.isArray(materialFiles) ? materialFiles.filter(Boolean) : [];
    const removeIds = Array.isArray(removedMaterialIds) ? removedMaterialIds.filter(Boolean) : [];

    if (!assignmentId || (files.length === 0 && removeIds.length === 0)) {
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('files[]', file));
    removeIds.forEach((id) => formData.append('remove_ids[]', String(id)));

    await api.post(`/assignments/${assignmentId}/materials`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }, []);

  const createAssignment = useCallback(async (assignmentData) => {
    setLoading(true);
    let createdAssignmentId = null;
    try {
      const {
        materialFiles = [],
        removedMaterialIds = [],
        ...payload
      } = assignmentData || {};

      const response = await api.post('/assignments', {
        title: payload.title || '',
        subjectId: payload.subjectId,
        description: payload.description || '',
        deadline: payload.deadline || '',
        maxScore: payload.maxScore || 100,
        submissionType: payload.submissionType || 'file',
        criteria: payload.criteria || [],
        studentGroups: payload.studentGroups || [],
        priority: payload.priority || 'medium',
        allowedFormats: payload.allowedFormats || DEFAULT_ALLOWED_FORMATS,
        maxFileSize: payload.maxFileSize || null,
      });

      createdAssignmentId = getCreatedAssignmentIdFromResponse(response);
      if (!createdAssignmentId) {
        return {
          success: false,
          error: 'Сервер не вернул идентификатор созданного задания. Обновите страницу.',
        };
      }

      try {
        await uploadAssignmentMaterials(createdAssignmentId, materialFiles, removedMaterialIds);
      } catch (matErr) {
        try {
          await api.delete(`/assignments/${createdAssignmentId}`);
        } catch {
          // ignore rollback errors
        }
        return {
          success: false,
          error: getApiErrorMessage(matErr, 'Ошибка при загрузке материалов к заданию'),
        };
      }

      Promise.resolve(loadTeacherData()).catch(() => {});
      return { success: true };
    } catch (err) {
      if (createdAssignmentId) {
        try {
          await api.delete(`/assignments/${createdAssignmentId}`);
        } catch {
          // Ignore rollback errors and return source error.
        }
      }

      const message = getApiErrorMessage(err, 'Ошибка при создании задания');
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [loadTeacherData, uploadAssignmentMaterials]);

  const updateAssignment = useCallback(async (assignmentId, updates) => {
    setLoading(true);
    try {
      const {
        materialFiles = [],
        removedMaterialIds = [],
        ...payload
      } = updates || {};

      await api.put(`/assignments/${assignmentId}`, {
        ...payload,
        subjectId: payload.subjectId,
      });
      await uploadAssignmentMaterials(assignmentId, materialFiles, removedMaterialIds);

      Promise.resolve(loadTeacherData()).catch(() => {});
      return { success: true };
    } catch (err) {
      return { success: false, error: getApiErrorMessage(err, 'Ошибка при обновлении задания') };
    } finally {
      setLoading(false);
    }
  }, [loadTeacherData, uploadAssignmentMaterials]);

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
        sub => sub.assignmentId === assignment.id
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

  const availableGroups = useMemo(() => {
    const set = new Set();
    metaGroups.forEach((group) => {
      const normalized = normalizeGroupName(group);
      if (normalized) {
        set.add(normalized);
      }
    });
    return Array.from(set);
  }, [metaGroups]);

  const availableSubjects = useMemo(() => {
    return metaSubjects
      .filter((subject) => subject && subject.id && subject.name)
      .map((subject) => ({
        id: Number(subject.id),
        name: String(subject.name).trim(),
      }))
      .filter((subject) => subject.name)
      .filter((subject, index, array) => array.findIndex((item) => item.id === subject.id) === index)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [metaSubjects]);

  const assignmentFilterOptions = useMemo(() => {
    return metaAssignments
      .filter((assignment) => assignment && assignment.id && assignment.title)
      .map((assignment) => ({
        id: Number(assignment.id),
        title: String(assignment.title).trim(),
        status: String(assignment.status || 'active'),
      }))
      .filter((assignment) => assignment.title)
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }, [metaAssignments]);

  const value = {
    teacherAssignments: assignmentsWithSubmissions,
    submissions: allSubmissions,
    assignmentsMeta,
    submissionsMeta,
    assignmentsQuery,
    submissionsQuery,
    availableGroups,
    availableSubjects,
    assignmentFilterOptions,
    loading,
    error,
    loadTeacherMeta,
    loadTeacherData,
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
