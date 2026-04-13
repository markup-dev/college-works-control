import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { DEFAULT_ALLOWED_FORMATS, getAllowedFormatsFromAssignment } from '../utils';

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
  group: submission.group || submission.groupName || '',
  teacherComment: submission.teacherComment || '',
  submissionType: submission.submissionType || 'file',
});

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
  && (a.assignmentId || 'all') === (b.assignmentId || 'all');

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
    perPage: 18,
    sort: 'priority',
  });
  const [submissionsQuery, setSubmissionsQuery] = useState({
    page: 1,
    perPage: 20,
    sort: 'newest',
  });
  const [metaSubjects, setMetaSubjects] = useState([]);
  const [metaGroups, setMetaGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const loadTeacherAssignments = useCallback(async (queryOverrides = {}) => {
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
      group: nextQuery.group && nextQuery.group !== 'all' ? nextQuery.group : undefined,
      subjectId: nextQuery.subjectId && nextQuery.subjectId !== 'all' ? nextQuery.subjectId : undefined,
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
      if (!areQueriesEqual(assignmentsQuery, nextQuery)) {
        setAssignmentsQuery(nextQuery);
      }
    } catch (err) {
      setError('Ошибка загрузки данных преподавателя');
    } finally {
      setLoading(false);
    }
  }, [assignmentsQuery]);

  const loadTeacherSubmissions = useCallback(async (queryOverrides = {}) => {
    const nextQuery = {
      page: 1,
      perPage: 20,
      sort: 'newest',
      ...submissionsQuery,
      ...queryOverrides,
    };
    const params = {
      page: nextQuery.page,
      perPage: nextQuery.perPage,
      sort: nextQuery.sort,
      search: nextQuery.search || undefined,
      status: nextQuery.status && nextQuery.status !== 'all' ? nextQuery.status : undefined,
      assignmentId: nextQuery.assignmentId && nextQuery.assignmentId !== 'all' ? nextQuery.assignmentId : undefined,
      group: nextQuery.group && nextQuery.group !== 'all' ? nextQuery.group : undefined,
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
      if (!areQueriesEqual(submissionsQuery, nextQuery)) {
        setSubmissionsQuery(nextQuery);
      }
    } catch (err) {
      setError('Ошибка загрузки данных преподавателя');
    } finally {
      setLoading(false);
    }
  }, [submissionsQuery]);

  const loadTeacherData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const metaRes = await api.get('/assignments/meta');
      setMetaSubjects(Array.isArray(metaRes?.data?.subjects) ? metaRes.data.subjects : []);
      setMetaGroups(Array.isArray(metaRes?.data?.groups) ? metaRes.data.groups : []);

      await Promise.all([
        loadTeacherAssignments(),
        loadTeacherSubmissions(),
      ]);
    } catch {
      setError('Ошибка загрузки данных преподавателя');
      setLoading(false);
    }
  }, [loadTeacherAssignments, loadTeacherSubmissions]);

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

      createdAssignmentId = response?.data?.assignment?.id;
      await uploadAssignmentMaterials(createdAssignmentId, materialFiles, removedMaterialIds);

      await loadTeacherData();
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

      await loadTeacherData();
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
      const normalized = (group || '').toString().trim();
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

  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user, loadTeacherData]);

  const value = {
    teacherAssignments: assignmentsWithSubmissions,
    submissions: allSubmissions,
    assignmentsMeta,
    submissionsMeta,
    assignmentsQuery,
    submissionsQuery,
    availableGroups,
    availableSubjects,
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
