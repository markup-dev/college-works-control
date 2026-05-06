import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';
import { PAGINATION_DEFAULTS } from '../utils';

const normalizeUser = (user) => ({
  ...user,
  fullName: [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ').trim(),
  group: user.group || user.studentGroup?.name || '',
  status: user.isActive ? 'active' : 'inactive',
});

const normalizeGroup = (group) => ({
  ...group,
  studentsCount: group.studentsCount ?? group.students_count ?? 0,
  teachingLoadsCount: group.teachingLoadsCount ?? group.teaching_loads_count ?? 0,
});

const normalizeSubject = (subject) => ({
  ...subject,
  teachingLoadsCount: subject.teachingLoadsCount ?? subject.teaching_loads_count ?? 0,
});

const normalizeTeachingLoad = (load) => ({
  ...load,
  teacherId: load.teacherId ?? load.teacher_id ?? load.teacher?.id ?? null,
  subjectId: load.subjectId ?? load.subject_id ?? load.subject?.id ?? null,
  groupId: load.groupId ?? load.group_id ?? load.group?.id ?? null,
});

const normalizeMeta = (meta) => ({
  currentPage: meta?.currentPage || 1,
  lastPage: meta?.lastPage || 1,
  perPage: meta?.perPage || PAGINATION_DEFAULTS.adminLogs,
  total: meta?.total || 0,
});

const areQueriesEqual = (left, right) => {
  const leftKeys = Object.keys(left || {});
  const rightKeys = Object.keys(right || {});
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
};

const withApiPagination = (params = {}) => {
  const { perPage, ...rest } = params;
  return {
    ...rest,
    per_page: perPage,
  };
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
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [teachingLoads, setTeachingLoads] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);

  const [usersMeta, setUsersMeta] = useState(normalizeMeta());
  const [groupsMeta, setGroupsMeta] = useState(normalizeMeta());
  const [subjectsMeta, setSubjectsMeta] = useState(normalizeMeta());
  const [teachingLoadsMeta, setTeachingLoadsMeta] = useState(normalizeMeta());
  const [logsMeta, setLogsMeta] = useState(normalizeMeta());

  const [usersQuery, setUsersQuery] = useState({ page: 1, perPage: PAGINATION_DEFAULTS.adminUsers, sort: 'newest' });
  const [groupsQuery, setGroupsQuery] = useState({ page: 1, perPage: PAGINATION_DEFAULTS.adminGroups, sort: 'name_asc' });
  const [subjectsQuery, setSubjectsQuery] = useState({ page: 1, perPage: PAGINATION_DEFAULTS.adminSubjects, sort: 'name_asc' });
  const [teachingLoadsQuery, setTeachingLoadsQuery] = useState({ page: 1, perPage: PAGINATION_DEFAULTS.adminSubjects, sort: 'teacher_asc' });
  const [logsQuery, setLogsQuery] = useState({ page: 1, perPage: PAGINATION_DEFAULTS.adminLogs, sort: 'newest' });
  const usersQueryRef = useRef(usersQuery);
  const groupsQueryRef = useRef(groupsQuery);
  const subjectsQueryRef = useRef(subjectsQuery);
  const teachingLoadsQueryRef = useRef(teachingLoadsQuery);
  const logsQueryRef = useRef(logsQuery);

  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalGroups: 0,
    totalSubjects: 0,
    activeSubjects: 0,
    totalAssignments: 0,
    totalSubmissions: 0,
    pendingSubmissions: 0,
    gradedSubmissions: 0,
    returnedSubmissions: 0,
    systemUptime: '100%',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    usersQueryRef.current = usersQuery;
  }, [usersQuery]);

  useEffect(() => {
    groupsQueryRef.current = groupsQuery;
  }, [groupsQuery]);

  useEffect(() => {
    subjectsQueryRef.current = subjectsQuery;
  }, [subjectsQuery]);

  useEffect(() => {
    teachingLoadsQueryRef.current = teachingLoadsQuery;
  }, [teachingLoadsQuery]);

  useEffect(() => {
    logsQueryRef.current = logsQuery;
  }, [logsQuery]);

  const loadStats = useCallback(async () => {
    const response = await api.get('/admin/stats');
    setAdminStats(response.data || {});
  }, []);

  const fetchUsers = useCallback(async (nextParams = {}, append = false) => {
    const params = { ...usersQueryRef.current, ...nextParams };
    if (!areQueriesEqual(usersQueryRef.current, params)) {
      usersQueryRef.current = params;
      setUsersQuery(params);
    }
    const response = await api.get('/admin/users', { params: withApiPagination(params) });
    const list = (response.data?.data || []).map(normalizeUser);
    setUsers((prev) => (append ? [...prev, ...list] : list));
    setUsersMeta(normalizeMeta(response.data?.meta));
    return response.data;
  }, []);

  const searchStudentsForTransfer = useCallback(async (searchTerm) => {
    const response = await api.get('/admin/users', {
      params: withApiPagination({
        role: 'student',
        search: searchTerm?.trim() || undefined,
        sort: 'name_asc',
        page: 1,
        perPage: 60,
      }),
    });
    return (response.data?.data || []).map(normalizeUser);
  }, []);

  const fetchTeacherOptions = useCallback(async () => {
    const perPage = 100;
    let page = 1;
    let lastPage = 1;
    const teachers = [];

    do {
      // eslint-disable-next-line no-await-in-loop
      const response = await api.get('/admin/users', {
        params: { role: 'teacher', page, per_page: perPage, sort: 'name_asc' },
      });

      const list = (response.data?.data || []).map(normalizeUser);
      teachers.push(...list);
      lastPage = Number(response.data?.meta?.lastPage || response.data?.meta?.last_page || 1);
      page += 1;
    } while (page <= lastPage);

    const uniqueTeachers = Array.from(
      new Map(teachers.map((teacher) => [teacher.id, teacher])).values()
    ).sort((left, right) => (left.fullName || '').localeCompare((right.fullName || ''), 'ru'));

    setTeacherOptions(uniqueTeachers);
    return uniqueTeachers;
  }, []);

  const fetchGroups = useCallback(async (nextParams = {}, append = false) => {
    const params = { ...groupsQueryRef.current, ...nextParams };
    if (!areQueriesEqual(groupsQueryRef.current, params)) {
      groupsQueryRef.current = params;
      setGroupsQuery(params);
    }
    const response = await api.get('/admin/groups', { params: withApiPagination(params) });
    const list = (response.data?.data || []).map(normalizeGroup);
    setGroups((prev) => (append ? [...prev, ...list] : list));
    setGroupsMeta(normalizeMeta(response.data?.meta));
    return response.data;
  }, []);

  const fetchSubjects = useCallback(async (nextParams = {}, append = false) => {
    const params = { ...subjectsQueryRef.current, ...nextParams };
    if (!areQueriesEqual(subjectsQueryRef.current, params)) {
      subjectsQueryRef.current = params;
      setSubjectsQuery(params);
    }
    const response = await api.get('/admin/subjects', { params: withApiPagination(params) });
    const list = (response.data?.data || []).map(normalizeSubject);
    setSubjects((prev) => (append ? [...prev, ...list] : list));
    setSubjectsMeta(normalizeMeta(response.data?.meta));
    return response.data;
  }, []);

  const fetchTeachingLoads = useCallback(async (nextParams = {}, append = false) => {
    const params = { ...teachingLoadsQueryRef.current, ...nextParams };
    if (!areQueriesEqual(teachingLoadsQueryRef.current, params)) {
      teachingLoadsQueryRef.current = params;
      setTeachingLoadsQuery(params);
    }
    const response = await api.get('/admin/teaching-loads', { params: withApiPagination(params) });
    const list = (response.data?.data || []).map(normalizeTeachingLoad);
    setTeachingLoads((prev) => (append ? [...prev, ...list] : list));
    setTeachingLoadsMeta(normalizeMeta(response.data?.meta));
    return response.data;
  }, []);

  const fetchLogs = useCallback(async (nextParams = {}, append = false) => {
    const params = { ...logsQueryRef.current, ...nextParams };
    if (!areQueriesEqual(logsQueryRef.current, params)) {
      logsQueryRef.current = params;
      setLogsQuery(params);
    }
    const response = await api.get('/admin/logs', { params: withApiPagination(params) });
    const list = response.data?.data || [];
    setSystemLogs((prev) => (append ? [...prev, ...list] : list));
    setLogsMeta(normalizeMeta(response.data?.meta));
    return response.data;
  }, []);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStats(), fetchUsers(), fetchGroups(), fetchSubjects(), fetchTeachingLoads(), fetchLogs(), fetchTeacherOptions()]);
    } catch (err) {
      setError('Ошибка загрузки данных администратора');
    } finally {
      setLoading(false);
    }
  }, [fetchGroups, fetchLogs, fetchSubjects, fetchTeacherOptions, fetchTeachingLoads, fetchUsers, loadStats]);

  const wrapMutation = useCallback(async (request, onSuccess) => {
    try {
      const response = await request();
      if (typeof onSuccess === 'function') {
        await onSuccess(response?.data);
      }
      return { success: true, data: response?.data };
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Операция не выполнена';
      return { success: false, error: message, data: requestError.response?.data || null };
    }
  }, []);

  const createUser = useCallback(async (userData) => {
    return wrapMutation(
      () => api.post('/admin/users', userData),
      async () => {
        await Promise.all([loadStats(), fetchUsers({ page: 1 }), fetchTeacherOptions()]);
      }
    );
  }, [fetchTeacherOptions, fetchUsers, loadStats, wrapMutation]);

  const updateUser = useCallback(async (userId, userData) => {
    return wrapMutation(
      () => api.put(`/admin/users/${userId}`, userData),
      async () => {
        await Promise.all([loadStats(), fetchUsers(), fetchTeacherOptions()]);
      }
    );
  }, [fetchTeacherOptions, fetchUsers, loadStats, wrapMutation]);

  const deleteUser = useCallback(async (userId) => {
    return wrapMutation(
      () => api.delete(`/admin/users/${userId}`),
      async () => {
        await Promise.all([loadStats(), fetchUsers(), fetchTeacherOptions()]);
      }
    );
  }, [fetchTeacherOptions, fetchUsers, loadStats, wrapMutation]);

  const previewUsersImport = useCallback(async (file) => {
    return wrapMutation(() => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/admin/users/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });
  }, [wrapMutation]);

  const importUsers = useCallback(async (rows, mode = 'strict', sendCredentials = true) => {
    return wrapMutation(
      () => api.post('/admin/users/import', { rows, mode, sendCredentials }),
      async () => {
        await Promise.all([loadStats(), fetchUsers({ page: 1 }), fetchTeacherOptions()]);
      }
    );
  }, [fetchTeacherOptions, fetchUsers, loadStats, wrapMutation]);

  const createGroup = useCallback(async (groupData) => {
    return wrapMutation(
      () => api.post('/admin/groups', groupData),
      async () => {
        await Promise.all([loadStats(), fetchGroups({ page: 1 })]);
      }
    );
  }, [fetchGroups, loadStats, wrapMutation]);

  const createGroupWithStudents = useCallback(async (payload) => {
    return wrapMutation(
      () => api.post('/admin/groups/create-with-students', payload),
      async () => {
        await Promise.all([loadStats(), fetchGroups({ page: 1 }), fetchUsers({ page: 1 })]);
      }
    );
  }, [fetchGroups, fetchUsers, loadStats, wrapMutation]);

  const bulkAttachStudentsToGroup = useCallback(async (groupId, payload) => {
    return wrapMutation(
      () => api.post(`/admin/groups/${groupId}/students/bulk`, payload),
      async () => {
        await Promise.all([loadStats(), fetchGroups(), fetchUsers()]);
      }
    );
  }, [fetchGroups, fetchUsers, loadStats, wrapMutation]);

  const updateGroup = useCallback(async (groupId, payload) => {
    return wrapMutation(
      () => api.put(`/admin/groups/${groupId}`, payload),
      async () => {
        await Promise.all([loadStats(), fetchGroups(), fetchUsers()]);
      }
    );
  }, [fetchGroups, fetchUsers, loadStats, wrapMutation]);

  const previewGroupsImport = useCallback(async (file) => {
    return wrapMutation(() => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/admin/groups/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });
  }, [wrapMutation]);

  const importGroups = useCallback(async (rows, mode = 'strict') => {
    return wrapMutation(
      () => api.post('/admin/groups/import', { rows, mode }),
      async () => {
        await Promise.all([loadStats(), fetchGroups({ page: 1 })]);
      }
    );
  }, [fetchGroups, loadStats, wrapMutation]);

  const deleteGroup = useCallback(async (groupId) => {
    return wrapMutation(
      () => api.delete(`/admin/groups/${groupId}`),
      async () => {
        await Promise.all([loadStats(), fetchGroups()]);
      }
    );
  }, [fetchGroups, loadStats, wrapMutation]);

  const createSubject = useCallback(async (subjectData) => {
    return wrapMutation(
      () => api.post('/admin/subjects', subjectData),
      async () => {
        await Promise.all([loadStats(), fetchSubjects({ page: 1 })]);
      }
    );
  }, [fetchSubjects, loadStats, wrapMutation]);

  const updateSubject = useCallback(async (subjectId, subjectData) => {
    return wrapMutation(
      () => api.put(`/admin/subjects/${subjectId}`, subjectData),
      async () => {
        await Promise.all([loadStats(), fetchSubjects()]);
      }
    );
  }, [fetchSubjects, loadStats, wrapMutation]);

  const deleteSubject = useCallback(async (subjectId) => {
    return wrapMutation(
      () => api.delete(`/admin/subjects/${subjectId}`),
      async () => {
        await Promise.all([loadStats(), fetchSubjects()]);
      }
    );
  }, [fetchSubjects, loadStats, wrapMutation]);

  const previewSubjectsImport = useCallback(async (file) => {
    return wrapMutation(() => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/admin/subjects/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    });
  }, [wrapMutation]);

  const importSubjects = useCallback(async (rows, mode = 'strict') => {
    return wrapMutation(
      () => api.post('/admin/subjects/import', { rows, mode }),
      async () => {
        await Promise.all([loadStats(), fetchSubjects({ page: 1 })]);
      }
    );
  }, [fetchSubjects, loadStats, wrapMutation]);

  const createTeachingLoad = useCallback(async (payload) => {
    return wrapMutation(
      () => api.post('/admin/teaching-loads', payload),
      async () => {
        await Promise.all([loadStats(), fetchTeachingLoads({ page: 1 }), fetchGroups(), fetchSubjects()]);
      }
    );
  }, [fetchGroups, fetchSubjects, fetchTeachingLoads, loadStats, wrapMutation]);

  const updateTeachingLoad = useCallback(async (loadId, payload) => {
    return wrapMutation(
      () => api.put(`/admin/teaching-loads/${loadId}`, payload),
      async () => {
        await Promise.all([loadStats(), fetchTeachingLoads(), fetchGroups(), fetchSubjects()]);
      }
    );
  }, [fetchGroups, fetchSubjects, fetchTeachingLoads, loadStats, wrapMutation]);

  const deleteTeachingLoad = useCallback(async (loadId) => {
    return wrapMutation(
      () => api.delete(`/admin/teaching-loads/${loadId}`),
      async () => {
        await Promise.all([loadStats(), fetchTeachingLoads(), fetchGroups(), fetchSubjects()]);
      }
    );
  }, [fetchGroups, fetchSubjects, fetchTeachingLoads, loadStats, wrapMutation]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const value = {
    users,
    groups,
    teacherOptions,
    subjects,
    teachingLoads,
    systemLogs,
    usersMeta,
    groupsMeta,
    subjectsMeta,
    teachingLoadsMeta,
    logsMeta,
    usersQuery,
    groupsQuery,
    subjectsQuery,
    teachingLoadsQuery,
    logsQuery,
    adminStats,
    loading,
    error,
    loadAdminData,
    loadStats,
    fetchUsers,
    searchStudentsForTransfer,
    fetchTeacherOptions,
    fetchGroups,
    fetchSubjects,
    fetchTeachingLoads,
    fetchLogs,
    createUser,
    updateUser,
    deleteUser,
    previewUsersImport,
    importUsers,
    createGroup,
    createGroupWithStudents,
    bulkAttachStudentsToGroup,
    updateGroup,
    previewGroupsImport,
    importGroups,
    deleteGroup,
    createSubject,
    updateSubject,
    deleteSubject,
    previewSubjectsImport,
    importSubjects,
    createTeachingLoad,
    updateTeachingLoad,
    deleteTeachingLoad,
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
