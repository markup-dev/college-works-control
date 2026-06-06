import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { getApiErrorMessage } from '../../../utils/adminApiErrors';
import { formatDateLong } from '../../../utils/dateHelpers';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import EmptyState from '../../UI/EmptyState/EmptyState';
import EntityCard from '../../UI/EntityCard/EntityCard';
import ErrorBanner from '../../UI/ErrorBanner/ErrorBanner';
import LoadingState from '../../UI/LoadingState/LoadingState';
import Modal from '../../UI/Modal/Modal';
import ModalDangerZone from '../../UI/Modal/ModalDangerZone';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import TeacherRequestModeration from '../TeacherRequestModeration/TeacherRequestModeration';
import { ADMIN_CARD_GRID_PAGE_SIZE } from '../../../config/adminPagination';
import usePaginationClamp from '../../../hooks/usePaginationClamp';
import { parsePaginationMeta } from '../../../utils/pagination';
import './AdminTeachingAssignmentsManagement.scss';

const LIST_CAP = 100;

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'Без группировки' },
  { value: 'teacher', label: 'По преподавателю' },
  { value: 'subject', label: 'По дисциплине' },
  { value: 'group', label: 'По группе' },
];

const ruStudents = (n) => {
  const x = Math.abs(Number(n)) || 0;
  const m = x % 10;
  const h = x % 100;
  if (h >= 11 && h <= 14) return `${x} студентов`;
  if (m === 1) return `${x} студент`;
  if (m >= 2 && m <= 4) return `${x} студента`;
  return `${x} студентов`;
};

const ruAssignments = (n) => {
  const x = Math.abs(Number(n)) || 0;
  const m = x % 10;
  const h = x % 100;
  if (h >= 11 && h <= 14) return `${x} заданий`;
  if (m === 1) return `${x} задание`;
  if (m >= 2 && m <= 4) return `${x} задания`;
  return `${x} заданий`;
};

const teacherShort = (t) => {
  if (!t) return '—';
  const last = (t.lastName ?? t.last_name ?? '').trim();
  const a = (t.firstName ?? t.first_name ?? '').trim()?.[0];
  const b = (t.middleName ?? t.middle_name ?? '').trim()?.[0];
  const io = [a && `${a}.`, b && `${b}.`].filter(Boolean).join('');
  return io ? `${last} ${io}`.trim() : last || '—';
};

/** Показ среднего балла по связке (после правки расчёта на бэкенде). */
const formatTeachingLoadAvgScore = (raw) => {
  if (raw == null || raw === '') {
    return { primary: 'Нет данных', muted: true };
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { primary: 'Нет данных', muted: true };
  }
  const primary = `${new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(n)} из 100`;
  return { primary, muted: false };
};

const assignmentStatusLabel = (status) => {
  if (status === 'archived') return 'Закрыто';
  return 'Активно';
};

const parsePositiveId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
};

const getTeachingAssignmentFiltersFromSearchParams = (params) => ({
  teacherId: parsePositiveId(params.get('teacher_id')),
  subjectId: parsePositiveId(params.get('subject_id')),
  groupId: parsePositiveId(params.get('group_id')),
});

const AdminTeachingAssignmentsManagement = () => {
  const { showSuccess, showError } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const { teacherId, subjectId, groupId } = useMemo(
    () => getTeachingAssignmentFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const [groupBy, setGroupBy] = useState('none');
  const [page, setPage] = useState(1);

  const [loads, setLoads] = useState([]);
  const [meta, setMeta] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    perPage: ADMIN_CARD_GRID_PAGE_SIZE,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createTeacher, setCreateTeacher] = useState('');
  const [createSubject, setCreateSubject] = useState('');
  const [createGroupSearch, setCreateGroupSearch] = useState('');
  const [createSelectedGroups, setCreateSelectedGroups] = useState(() => new Set());
  const [createTeacherSearch, setCreateTeacherSearch] = useState('');
  const [createSubjectSearch, setCreateSubjectSearch] = useState('');
  const [createExistingGroupIds, setCreateExistingGroupIds] = useState(() => new Set());
  const [createPrefill, setCreatePrefill] = useState(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createEligibleSubjects, setCreateEligibleSubjects] = useState([]);
  const [createEligibleGroups, setCreateEligibleGroups] = useState([]);
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);

  const [detailId, setDetailId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editPair, setEditPair] = useState(null);
  const [editGroupSearch, setEditGroupSearch] = useState('');
  const [editSelected, setEditSelected] = useState(() => new Set());
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editEligibleGroups, setEditEligibleGroups] = useState([]);
  const [editGroupsLoading, setEditGroupsLoading] = useState(false);

  const [transferRow, setTransferRow] = useState(null);
  const [transferSearch, setTransferSearch] = useState('');
  const [transferTeacher, setTransferTeacher] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferEligibleTeachers, setTransferEligibleTeachers] = useState([]);
  const [transferTeachersLoading, setTransferTeachersLoading] = useState(false);

  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [t, s, g] = await Promise.all([
          api.get('/admin/users', { params: { role: 'teacher', per_page: LIST_CAP, sort: 'name_asc' } }),
          api.get('/admin/subjects', { params: { per_page: LIST_CAP, sort: 'name_asc', status: 'active' } }),
          api.get('/admin/groups', { params: { per_page: LIST_CAP, sort: 'name_asc' } }),
        ]);
        if (c) return;
        setTeachers(Array.isArray(t.data?.data) ? t.data.data : []);
        setSubjects(Array.isArray(s.data?.data) ? s.data.data : []);
        setGroups(Array.isArray(g.data?.data) ? g.data.data : []);
      } catch {
        if (!c) {
          setTeachers([]);
          setSubjects([]);
          setGroups([]);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchParams]);

  const applyListFilter = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, String(value));
      else next.delete(key);
      return next;
    }, { replace: true });
    setPage(1);
  }, [setSearchParams]);

  useEffect(() => {
    const st = location.state;
    if (!st || typeof st !== 'object') return;
    let consumed = false;
    const nextParams = new URLSearchParams(searchParams);
    if (st.filterTeacherId != null && st.filterTeacherId !== '') {
      nextParams.set('teacher_id', String(st.filterTeacherId));
      consumed = true;
    }
    if (st.filterSubjectId != null && st.filterSubjectId !== '') {
      nextParams.set('subject_id', String(st.filterSubjectId));
      consumed = true;
    }
    if (st.filterGroupId != null && st.filterGroupId !== '') {
      nextParams.set('group_id', String(st.filterGroupId));
      consumed = true;
    }
    if (st.groupBy) {
      setGroupBy(st.groupBy);
      consumed = true;
    }
    if (consumed) {
      navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, searchParams]);

  const fetchLoads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: ADMIN_CARD_GRID_PAGE_SIZE,
        sort: 'teacher_asc',
      };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (teacherId) params.teacher_id = Number(teacherId);
      if (subjectId) params.subject_id = Number(subjectId);
      if (groupId) params.group_id = Number(groupId);

      const { data } = await api.get('/admin/teaching-loads', { params });
      setLoads(Array.isArray(data?.data) ? data.data : []);
      const m = data?.meta;
      setMeta({
        ...parsePaginationMeta(m, page),
        perPage: m?.perPage ?? ADMIN_CARD_GRID_PAGE_SIZE,
      });
    } catch (e) {
      setLoads([]);
      setError(getApiErrorMessage(e, 'Не удалось загрузить назначения'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, teacherId, subjectId, groupId]);

  usePaginationClamp(page, meta.lastPage, setPage);

  useEffect(() => {
    void fetchLoads();
  }, [fetchLoads]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, teacherId, subjectId, groupId]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setPage(1);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const resetDisabled = useMemo(
    () => !search.trim() && !teacherId && !subjectId && !groupId,
    [search, teacherId, subjectId, groupId],
  );

  const groupedSections = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', title: null, subtitle: null, extra: null, items: loads }];
    }
    const map = new Map();
    for (const row of loads) {
      let key;
      let title;
      let subtitle = null;
      let extra = null;
      if (groupBy === 'teacher') {
        key = `t-${row.teacherId ?? row.teacher_id}`;
        title = row.teacher?.fullName ?? row.teacher?.full_name ?? teacherShort(row.teacher);
        subtitle = row.teacher?.email ?? row.teacher?.login ?? '';
      } else if (groupBy === 'subject') {
        key = `s-${row.subjectId ?? row.subject_id}`;
        const sub = row.subject;
        title = sub ? (sub.code ? `${sub.name} (${sub.code})` : sub.name) : '—';
      } else {
        key = `g-${row.groupId ?? row.group_id}`;
        const g = row.group;
        title = g ? `Группа ${g.name}` : '—';
        subtitle = g?.specialty || null;
        extra = g?.id
          ? (() => {
              const st = groups.find((x) => Number(x.id) === Number(g.id));
              const cnt = st?.studentsCount ?? st?.students_count;
              if (cnt != null) return `${cnt} студ. в справочнике`;
              return null;
            })()
          : null;
      }
      if (!map.has(key)) {
        map.set(key, { key, title, subtitle, extra, items: [] });
      }
      map.get(key).items.push(row);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));
    return arr;
  }, [loads, groupBy, groups]);

  const openCreate = (prefill = null) => {
    setCreatePrefill(prefill);
    setCreateStep(1);
    setCreateTeacher(prefill?.teacherId ? String(prefill.teacherId) : '');
    setCreateSubject(prefill?.subjectId ? String(prefill.subjectId) : '');
    setCreateGroupSearch('');
    setCreateTeacherSearch('');
    setCreateSubjectSearch('');
    setCreateExistingGroupIds(new Set());
    const g = new Set();
    if (prefill?.groupId) g.add(Number(prefill.groupId));
    setCreateSelectedGroups(g);
    setCreateOpen(true);
  };

  const filteredTeachersCreate = useMemo(() => {
    const activeTeachers = teachers.filter((u) => u.isActive !== false);
    const q = createTeacherSearch.trim().toLowerCase();
    if (!q) return activeTeachers;
    return activeTeachers.filter((u) => {
      const blob = [u.lastName, u.firstName, u.middleName, u.login, u.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [teachers, createTeacherSearch]);

  const filteredSubjectsCreate = useMemo(() => {
    const q = createSubjectSearch.trim().toLowerCase();
    const list = createEligibleSubjects;
    if (!q) return list;
    return list.filter((s) => {
      const blob = `${s.name || ''} ${s.code || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [createEligibleSubjects, createSubjectSearch]);

  const groupsForCreate = useMemo(() => {
    let list = createEligibleGroups.filter((g) => !createExistingGroupIds.has(Number(g.id)));
    const q = createGroupSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => `${g.name || ''} ${g.specialty || ''}`.toLowerCase().includes(q));
    }
    return list;
  }, [createEligibleGroups, createGroupSearch, createExistingGroupIds]);

  useEffect(() => {
    if (!createOpen || !createTeacher) {
      setCreateEligibleSubjects([]);
      return undefined;
    }
    let cancelled = false;
    setCreateOptionsLoading(true);
    (async () => {
      try {
        const { data } = await api.get('/admin/teaching-loads/form-options', {
          params: { teacher_id: Number(createTeacher) },
        });
        if (cancelled) return;
        const list = Array.isArray(data?.subjects) ? data.subjects : [];
        setCreateEligibleSubjects(list);
      } catch (e) {
        if (!cancelled) {
          setCreateEligibleSubjects([]);
          showError(getApiErrorMessage(e, 'Не удалось загрузить дисциплины преподавателя'));
        }
      } finally {
        if (!cancelled) setCreateOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen, createTeacher, showError]);

  useEffect(() => {
    if (!createOpen || !createTeacher || !createSubject) {
      setCreateEligibleGroups([]);
      return undefined;
    }
    let cancelled = false;
    setCreateOptionsLoading(true);
    (async () => {
      try {
        const { data } = await api.get('/admin/teaching-loads/form-options', {
          params: {
            teacher_id: Number(createTeacher),
            subject_id: Number(createSubject),
          },
        });
        if (cancelled) return;
        setCreateEligibleGroups(Array.isArray(data?.groups) ? data.groups : []);
      } catch (e) {
        if (!cancelled) {
          setCreateEligibleGroups([]);
          showError(getApiErrorMessage(e, 'Не удалось загрузить группы для дисциплины'));
        }
      } finally {
        if (!cancelled) setCreateOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen, createTeacher, createSubject, showError]);

  useEffect(() => {
    if (!createOpen || !createTeacher || !createSubject) {
      setCreateExistingGroupIds(new Set());
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/teaching-loads', {
          params: {
            teacher_id: Number(createTeacher),
            subject_id: Number(createSubject),
            per_page: 100,
            sort: 'group_asc',
          },
        });
        if (cancelled) return;
        const list = Array.isArray(data?.data) ? data.data : [];
        const existing = new Set(list.map((x) => Number(x.groupId ?? x.group_id)));
        setCreateExistingGroupIds(existing);
        setCreateSelectedGroups((prev) => new Set([...prev].filter((id) => !existing.has(Number(id)))));
      } catch {
        if (!cancelled) setCreateExistingGroupIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen, createTeacher, createSubject]);

  useEffect(() => {
    if (!createOpen || !createPrefill?.teacherId) return;
    setCreateTeacher(String(createPrefill.teacherId));
  }, [createOpen, createPrefill]);

  const submitCreate = async () => {
    if (!createTeacher || !createSubject || createSelectedGroups.size === 0) {
      showError('Выберите преподавателя, дисциплину и хотя бы одну группу.');
      return;
    }
    setCreateSubmitting(true);
    try {
      const groupIds = Array.from(createSelectedGroups).filter((id) => !createExistingGroupIds.has(Number(id)));
      if (groupIds.length === 0) {
        showError('Все выбранные группы уже назначены.');
        return;
      }
      const { data } = await api.post('/admin/teaching-loads/batch', {
        teacherId: Number(createTeacher),
        subjectId: Number(createSubject),
        groupIds,
        status: 'active',
      });
      const skipped = data?.skippedGroupIds ?? data?.skipped_group_ids ?? [];
      const n = Array.isArray(data?.created) ? data.created.length : 0;
      if (skipped.length && n === 0) {
        showError('Все выбранные группы уже назначены.');
      } else {
        showSuccess(
          skipped.length
            ? `Создано назначений: ${n}. Пропущено (уже есть): ${skipped.length}.`
            : `Создано назначений: ${n}.`,
        );
        setCreateOpen(false);
        void fetchLoads();
      }
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось создать назначения'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openDetail = async (id) => {
    setDetailId(id);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const { data } = await api.get(`/admin/teaching-loads/${id}/detail`);
      setDetailData(data);
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось загрузить детали'));
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openEditGroups = async (row) => {
    const tid = row.teacherId ?? row.teacher_id;
    const sid = row.subjectId ?? row.subject_id;
    setEditPair({ teacherId: tid, subjectId: sid, teacher: row.teacher, subject: row.subject });
    setEditGroupSearch('');
    setEditSubmitting(false);
    try {
      const { data } = await api.get('/admin/teaching-loads', {
        params: { teacher_id: tid, subject_id: sid, per_page: 100, sort: 'group_asc' },
      });
      const list = Array.isArray(data?.data) ? data.data : [];
      const ids = new Set(list.map((x) => Number(x.groupId ?? x.group_id)));
      setEditSelected(ids);
      setEditPair((p) => ({ ...p, existingRows: list }));
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось загрузить текущие группы'));
      setEditPair(null);
    }
  };

  const groupsForEdit = useMemo(() => {
    let list = editEligibleGroups;
    const q = editGroupSearch.trim().toLowerCase();
    if (q) list = list.filter((g) => `${g.name || ''} ${g.specialty || ''}`.toLowerCase().includes(q));
    return list;
  }, [editEligibleGroups, editGroupSearch]);

  useEffect(() => {
    if (!editPair?.subjectId) {
      setEditEligibleGroups([]);
      return undefined;
    }
    let cancelled = false;
    setEditGroupsLoading(true);
    (async () => {
      try {
        const { data } = await api.get('/admin/teaching-loads/form-options', {
          params: { subject_id: Number(editPair.subjectId) },
        });
        if (!cancelled) {
          setEditEligibleGroups(Array.isArray(data?.groups) ? data.groups : []);
        }
      } catch (e) {
        if (!cancelled) {
          setEditEligibleGroups([]);
          showError(getApiErrorMessage(e, 'Не удалось загрузить допустимые группы'));
        }
      } finally {
        if (!cancelled) setEditGroupsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editPair?.subjectId, showError]);

  const submitEditGroups = async () => {
    if (!editPair || editSelected.size === 0) {
      showError('Нужна хотя бы одна группа.');
      return;
    }
    setEditSubmitting(true);
    try {
      await api.put('/admin/teaching-loads/sync-pair', {
        teacherId: editPair.teacherId,
        subjectId: editPair.subjectId,
        groupIds: Array.from(editSelected),
      });
      showSuccess('Группы обновлены');
      setEditPair(null);
      void fetchLoads();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitTransfer = async () => {
    if (!transferRow || !transferTeacher) return;
    setTransferSubmitting(true);
    try {
      await api.put(`/admin/teaching-loads/${transferRow.id}/transfer-teacher`, {
        teacherId: Number(transferTeacher),
      });
      showSuccess('Преподаватель изменён, задания переданы');
      setTransferRow(null);
      void fetchLoads();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось сменить преподавателя'));
    } finally {
      setTransferSubmitting(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteRow) return;
    setDeleteSubmitting(true);
    try {
      await api.delete(`/admin/teaching-loads/${deleteRow.id}`);
      showSuccess('Назначение удалено');
      setDeleteRow(null);
      void fetchLoads();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось удалить'));
      throw e;
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const eligibleTransferTeachers = useMemo(() => {
    const q = transferSearch.trim().toLowerCase();
    return transferEligibleTeachers.filter((u) => {
      if (!q) return true;
      const blob = [u.lastName, u.firstName, u.middleName, u.login].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [transferEligibleTeachers, transferSearch]);

  useEffect(() => {
    if (!transferRow) {
      setTransferEligibleTeachers([]);
      return undefined;
    }
    const subjectId = transferRow.subjectId ?? transferRow.subject_id ?? transferRow.subject?.id;
    const teacherId = transferRow.teacherId ?? transferRow.teacher_id ?? transferRow.teacher?.id;
    if (!subjectId) {
      setTransferEligibleTeachers([]);
      return undefined;
    }
    let cancelled = false;
    setTransferTeachersLoading(true);
    (async () => {
      try {
        const { data } = await api.get('/admin/teaching-loads/form-options', {
          params: {
            subject_id: Number(subjectId),
            exclude_teacher_id: teacherId ? Number(teacherId) : undefined,
          },
        });
        if (!cancelled) {
          setTransferEligibleTeachers(Array.isArray(data?.teachers) ? data.teachers : []);
        }
      } catch (e) {
        if (!cancelled) {
          setTransferEligibleTeachers([]);
          showError(getApiErrorMessage(e, 'Не удалось загрузить подходящих преподавателей'));
        }
      } finally {
        if (!cancelled) setTransferTeachersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transferRow, showError]);

  const renderCard = (row) => {
    const sc = row.studentsCount ?? row.students_count ?? 0;
    const ac = row.assignmentsCount ?? row.assignments_count ?? 0;
    return (
      <EntityCard
        key={row.id}
        className="admin-ta-card"
        role="button"
        tabIndex={0}
        onClick={() => void openDetail(row.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            void openDetail(row.id);
          }
        }}
      >
        <h3 className="admin-ta-card__subject">
          {row.subject?.name || '—'}
          {row.subject?.code ? ` (${row.subject.code})` : ''}
        </h3>
        <p className="admin-ta-card__teacher">{teacherShort(row.teacher)}</p>
        <span className="admin-ta-card__group-tag">{row.group?.name || '—'}</span>
        <div className="admin-ta-card__metrics">
          <span className="admin-ta-card__metric">{ruStudents(sc)}</span>
          <span className="admin-ta-card__metric">{ruAssignments(ac)}</span>
        </div>
      </EntityCard>
    );
  };

  return (
    <div className="admin-teaching-assignments">
      <header className="admin-teaching-assignments__head">
        <div>
          <h1 className="admin-teaching-assignments__title">Назначения</h1>
        </div>
      </header>

      <TeacherRequestModeration
        kind="load"
        title="Заявки на назначения"
        emptyMessage="Новых заявок на назначения нет"
        onResolved={fetchLoads}
      />

      <DashboardFilterToolbar
        className="admin-teaching-assignments__toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по преподавателю, дисциплине, коду, группе или специальности…"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        popoverAlign="end"
        popoverAriaLabel="Фильтры назначений"
      >
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="ta-filter-teacher">
            Преподаватель
          </label>
          <select
            id="ta-filter-teacher"
            className="filter-select"
            value={teacherId}
            onChange={(e) => applyListFilter('teacher_id', e.target.value)}
          >
            <option value="">Все преподаватели</option>
            {teachers.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {teacherShort(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="ta-filter-subject">
            Дисциплина
          </label>
          <select
            id="ta-filter-subject"
            className="filter-select"
            value={subjectId}
            onChange={(e) => applyListFilter('subject_id', e.target.value)}
          >
            <option value="">Все дисциплины</option>
            {subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="ta-filter-group">
            Группа
          </label>
          <select
            id="ta-filter-group"
            className="filter-select"
            value={groupId}
            onChange={(e) => applyListFilter('group_id', e.target.value)}
          >
            <option value="">Все группы</option>
            {groups.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </DashboardFilterToolbar>

      <div className="admin-teaching-assignments__row">
        <div className="admin-teaching-assignments__grouping">
          <label className="admin-teaching-assignments__grouping-label" htmlFor="ta-group-by">
            Группировка
          </label>
          <select
            id="ta-group-by"
            className="filter-select admin-teaching-assignments__grouping-select"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            {GROUP_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <p className="admin-teaching-assignments__count">
          Показано: {meta.total} {meta.total === 1 ? 'назначение' : meta.total >= 2 && meta.total <= 4 ? 'назначения' : 'назначений'}
          {meta.lastPage > 1 ? ` (стр. ${meta.currentPage} / ${meta.lastPage})` : ''}
        </p>
        <Button type="button" variant="primary" onClick={() => openCreate(null)}>
          + Новое назначение
        </Button>
      </div>

      {error && (
        <ErrorBanner
          className="admin-teaching-assignments__error"
          title="Ошибка загрузки назначений"
          message={error}
          actionLabel="Повторить"
          onAction={() => void fetchLoads()}
        />
      )}

      {loading ? (
        <LoadingState message="Загрузка назначений..." className="admin-teaching-assignments__state" />
      ) : (
        groupedSections.map((section) => (
          <section key={section.key} className="admin-teaching-assignments__section">
            {section.title && (
              <div className="admin-teaching-assignments__section-head">
                <div className="admin-teaching-assignments__section-heading">
                  <h2 className={`admin-teaching-assignments__section-title admin-teaching-assignments__section-title--${groupBy}`}>
                    {section.title}
                    <span className="admin-teaching-assignments__section-count">{section.items.length}</span>
                  </h2>
                  {section.subtitle && (
                    <p className="admin-teaching-assignments__section-sub">{section.subtitle}</p>
                  )}
                  {section.extra && (
                    <p className="admin-teaching-assignments__section-extra">{section.extra}</p>
                  )}
                </div>
                {groupBy === 'teacher' && section.items[0] && (
                  <Button
                    type="button"
                    variant="outline"
                    size="small"
                    onClick={() =>
                      openCreate({
                        teacherId: section.items[0].teacherId ?? section.items[0].teacher_id,
                      })
                    }
                  >
                    + Назначение для этого преподавателя
                  </Button>
                )}
                {groupBy === 'group' && section.items[0] && (
                  <Button
                    type="button"
                    variant="outline"
                    size="small"
                    onClick={() =>
                      openCreate({
                        groupId: section.items[0].groupId ?? section.items[0].group_id,
                      })
                    }
                  >
                    + Назначение для этой группы
                  </Button>
                )}
              </div>
            )}
            <div className="admin-teaching-assignments__grid">
              {section.items.length === 0 ? (
                <EmptyState
                  asCard={false}
                  title="Нет назначений по фильтру"
                  message="Попробуйте изменить параметры поиска или фильтрации."
                  className="admin-teaching-assignments__empty"
                />
              ) : (
                section.items.map(renderCard)
              )}
            </div>
          </section>
        ))
      )}

      <Pagination
        className="admin-teaching-assignments__pagination"
        currentPage={meta.currentPage}
        lastPage={meta.lastPage}
        total={meta.total}
        fallbackCount={loads.length}
        disabled={loading}
        hideWhenSinglePage
        onPageChange={setPage}
      />

      <Modal
        isOpen={createOpen}
        title="Новое назначение"
        size="large"
        onClose={() => !createSubmitting && setCreateOpen(false)}
        footer={(
          <>
            {createStep < 3 ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => setCreateStep((s) => s + 1)}
                disabled={(createStep === 1 && !createTeacher) || (createStep === 2 && !createSubject)}
              >
                Далее
              </Button>
            ) : (
              <Button type="button" variant="primary" onClick={() => void submitCreate()} disabled={createSubmitting || createSelectedGroups.size === 0}>
                Создать {createSelectedGroups.size ? `${createSelectedGroups.size} ` : ''}
                назначений
              </Button>
            )}
          </>
        )}
      >
          <div className="admin-ta-wizard">
            <div className="admin-ta-wizard__steps">
              <button type="button" className={createStep === 1 ? 'is-active' : ''} onClick={() => setCreateStep(1)}>
                1. Преподаватель
              </button>
              <button type="button" className={createStep === 2 ? 'is-active' : ''} onClick={() => createTeacher && setCreateStep(2)} disabled={!createTeacher}>
                2. Дисциплина
              </button>
              <button type="button" className={createStep === 3 ? 'is-active' : ''} onClick={() => createSubject && setCreateStep(3)} disabled={!createSubject}>
                3. Группы
              </button>
            </div>

            {createStep === 1 && (
              <div className="admin-ta-wizard__panel">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Поиск по ФИО или логину преподавателя…"
                  value={createTeacherSearch}
                  onChange={(e) => setCreateTeacherSearch(e.target.value)}
                />
                <ul className="admin-ta-wizard__list">
                  {filteredTeachersCreate.map((u) => (
                    <li key={u.id}>
                      <label className="admin-ta-wizard__radio">
                        <input
                          type="radio"
                          name="cta-t"
                          checked={String(createTeacher) === String(u.id)}
                          onChange={() => {
                            setCreateTeacher(String(u.id));
                            setCreateSubject('');
                            setCreateSelectedGroups(new Set());
                          }}
                        />
                        <span>
                          {teacherShort(u)}
                          <small>{u.email || u.login}</small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {createStep === 2 && (
              <div className="admin-ta-wizard__panel">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Поиск по названию или коду дисциплины…"
                  value={createSubjectSearch}
                  onChange={(e) => setCreateSubjectSearch(e.target.value)}
                />
                {createOptionsLoading ? (
                  <LoadingState message="Загрузка дисциплин..." />
                ) : filteredSubjectsCreate.length === 0 ? (
                  <p className="admin-ta-wizard__empty">У преподавателя нет допусков к активным дисциплинам.</p>
                ) : (
                  <ul className="admin-ta-wizard__list">
                    {filteredSubjectsCreate.map((s) => (
                      <li key={s.id}>
                        <label className="admin-ta-wizard__radio">
                          <input
                            type="radio"
                            name="cta-s"
                            checked={String(createSubject) === String(s.id)}
                            onChange={() => {
                              setCreateSubject(String(s.id));
                              setCreateSelectedGroups(new Set());
                            }}
                          />
                          <span>
                            {s.name} {s.code ? `(${s.code})` : ''}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {createStep === 3 && (
              <div className="admin-ta-wizard__panel">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Поиск по группе или специальности…"
                  value={createGroupSearch}
                  onChange={(e) => setCreateGroupSearch(e.target.value)}
                />
                {createOptionsLoading ? (
                  <LoadingState message="Загрузка групп..." />
                ) : groupsForCreate.length === 0 ? (
                  <p className="admin-ta-wizard__empty">
                    {createEligibleGroups.length > 0
                      ? 'Все подходящие группы уже назначены этому преподавателю.'
                      : 'Нет активных групп с этой дисциплиной на текущем курсе.'}
                  </p>
                ) : (
                  <ul className="admin-ta-wizard__checks">
                    {groupsForCreate.map((g) => {
                      const st = g.studentsCount ?? g.students_count;
                      const labelSt = st != null ? ` (${st} студ.)` : '';
                      return (
                        <li key={g.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={createSelectedGroups.has(Number(g.id))}
                              onChange={(e) => {
                                const n = new Set(createSelectedGroups);
                                if (e.target.checked) n.add(Number(g.id));
                                else n.delete(Number(g.id));
                                setCreateSelectedGroups(n);
                              }}
                            />
                            {g.name}
                            {labelSt}
                            {g.specialty ? <small>{g.specialty}</small> : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="admin-ta-wizard__hint">
                  Выбрано групп: {createSelectedGroups.size}. Уже существующие назначения отмечаются сразу и не отправляются повторно.
                </p>
              </div>
            )}

          </div>
      </Modal>

      <Modal
        isOpen={!!detailId}
        title="Детали назначения"
        size="medium"
        contentClassName="admin-ta-detail-modal"
        footerClassName="admin-ta-detail-modal__footer"
        onClose={() => setDetailId(null)}
        footer={!detailLoading && detailData?.teachingLoad ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="small"
              onClick={() => {
                const tl = detailData.teachingLoad;
                setDetailId(null);
                void openEditGroups(tl);
              }}
            >
              Изменить группы
            </Button>
            <Button
              type="button"
              variant="outline"
              size="small"
              onClick={() => {
                const tl = detailData.teachingLoad;
                setDetailId(null);
                setTransferRow(tl);
                setTransferTeacher('');
                setTransferSearch('');
              }}
            >
              Сменить преподавателя
            </Button>
          </>
        ) : null}
      >
          {detailLoading && <LoadingState message="Загрузка..." className="admin-teaching-assignments__state" />}
          {!detailLoading && detailData?.teachingLoad && (() => {
            const tl = detailData.teachingLoad;
            const dept = (tl.teacher?.department || '').trim();
            const avg = formatTeachingLoadAvgScore(detailData.stats?.averageScore ?? detailData.stats?.average_score);

            return (
              <div className="admin-ta-detail">
                <div className="admin-ta-detail__identity">
                  <div>
                    <p className="admin-ta-detail__eyebrow">Назначение</p>
                    <h3>
                      {tl.subject?.name} {tl.subject?.code ? `(${tl.subject.code})` : ''}
                    </h3>
                  </div>
                  <div className="admin-ta-detail__meta-grid">
                    <div className="admin-ta-detail__meta-item">
                      <span>Преподаватель</span>
                      <strong>{tl.teacher?.fullName || teacherShort(tl.teacher)}</strong>
                    </div>
                    <div className="admin-ta-detail__meta-item">
                      <span>Кафедра</span>
                      <strong className={!dept ? 'admin-ta-detail__value-muted' : undefined}>{dept || '—'}</strong>
                    </div>
                    <div className="admin-ta-detail__meta-item">
                      <span>Группа</span>
                      <strong>{tl.group?.name || '—'}</strong>
                    </div>
                    <div className="admin-ta-detail__meta-item">
                      <span>Студенты</span>
                      <strong>{ruStudents(detailData.stats?.studentsCount ?? detailData.stats?.students_count ?? 0)}</strong>
                    </div>
                  </div>
                </div>
              <div className="admin-ta-detail__stats">
                <div className="admin-ta-detail__stat-card">
                  <span>Активных заданий</span>
                  <strong>{detailData.stats?.assignmentsActive ?? detailData.stats?.assignments_active ?? 0}</strong>
                </div>
                <div className="admin-ta-detail__stat-card">
                  <span>Всего заданий</span>
                  <strong>{detailData.stats?.assignmentsTotal ?? detailData.stats?.assignments_total ?? 0}</strong>
                </div>
                <div className="admin-ta-detail__stat-card">
                  <span>Сдано работ</span>
                  <strong>{detailData.stats?.submissionsCount ?? detailData.stats?.submissions_count ?? 0}</strong>
                </div>
                <div className="admin-ta-detail__stat-card">
                  <span>Средний балл</span>
                  <strong className={avg.muted ? 'admin-ta-detail__value-muted' : undefined}>{avg.primary}</strong>
                </div>
              </div>
              {Array.isArray(detailData.recentAssignments) && detailData.recentAssignments.length > 0 && (
                <div className="admin-ta-detail__recent">
                  <strong>Последние задания</strong>
                  <ul>
                    {detailData.recentAssignments.map((a) => (
                      <li
                        key={a.id}
                        className={`admin-ta-detail__recent-item admin-ta-detail__recent-item--${a.status || 'active'}`}
                      >
                        {a.title} — {assignmentStatusLabel(a.status)}
                        {a.deadline ? ` (до ${formatDateLong(a.deadline)})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ModalDangerZone
                title="Удаление назначения"
                description="Преподаватель потеряет связь с группой по этой дисциплине. Существующие задания сохранятся."
              >
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  onClick={() => {
                    setDetailId(null);
                    setDeleteRow(tl);
                  }}
                >
                  Удалить назначение
                </Button>
              </ModalDangerZone>
            </div>
          );
        })()}
      </Modal>

      <Modal
        isOpen={!!editPair}
        title="Изменить группы"
        size="medium"
        onClose={() => !editSubmitting && setEditPair(null)}
        footer={editPair ? (
          <>
            <Button type="button" variant="primary" onClick={() => void submitEditGroups()} disabled={editSubmitting}>
              Сохранить
            </Button>
          </>
        ) : null}
      >
        {editPair ? (
          <>
            <p>
              {teacherShort(editPair.teacher)} — {editPair.subject?.name}
            </p>
            <div className="admin-ta-wizard">
              <input
                type="search"
                className="search-input"
                placeholder="Поиск по группе или специальности…"
                value={editGroupSearch}
                onChange={(e) => setEditGroupSearch(e.target.value)}
              />
            <ul className="admin-ta-wizard__checks">
              {editGroupsLoading ? (
                <li className="admin-ta-wizard__empty">Загрузка групп...</li>
              ) : groupsForEdit.length === 0 ? (
                <li className="admin-ta-wizard__empty">Нет активных групп с этой дисциплиной на текущем курсе.</li>
              ) : groupsForEdit.map((g) => (
                <li key={g.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={editSelected.has(Number(g.id))}
                      onChange={(e) => {
                        const n = new Set(editSelected);
                        if (e.target.checked) n.add(Number(g.id));
                        else {
                          if (n.size <= 1) {
                            showError('Должна остаться хотя бы одна группа.');
                            return;
                          }
                          n.delete(Number(g.id));
                        }
                        setEditSelected(n);
                      }}
                    />
                    {g.name}
                    {g.specialty ? <small>{g.specialty}</small> : null}
                  </label>
                </li>
              ))}
            </ul>
            <p className="admin-ta-wizard__hint">
              Группы с уже созданными заданиями лучше оставлять в назначении.
            </p>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!transferRow}
        title="Сменить преподавателя"
        size="medium"
        onClose={() => !transferSubmitting && setTransferRow(null)}
        footer={transferRow ? (
          <>
            <Button type="button" variant="primary" onClick={() => void submitTransfer()} disabled={transferSubmitting || !transferTeacher}>
              Сменить
            </Button>
          </>
        ) : null}
      >
        {transferRow ? (
          <div className="admin-ta-wizard">
            <p>
              Дисциплина: {transferRow.subject?.name}, группа: {transferRow.group?.name}
            </p>
            <p>Сейчас: {teacherShort(transferRow.teacher)}</p>
            <input
              type="search"
              className="search-input"
              placeholder="Поиск по ФИО или логину преподавателя…"
              value={transferSearch}
              onChange={(e) => setTransferSearch(e.target.value)}
            />
            <ul className="admin-ta-wizard__list">
              {transferTeachersLoading ? (
                <li className="admin-ta-wizard__empty">Загрузка преподавателей...</li>
              ) : eligibleTransferTeachers.map((u) => (
                <li key={u.id}>
                  <label className="admin-ta-wizard__radio">
                    <input
                      type="radio"
                      name="tta"
                      checked={String(transferTeacher) === String(u.id)}
                      onChange={() => setTransferTeacher(String(u.id))}
                    />
                    <span>{teacherShort(u)}</span>
                  </label>
                </li>
              ))}
              {eligibleTransferTeachers.length === 0 && !transferTeachersLoading && (
                <li className="admin-ta-wizard__empty">Нет других преподавателей с допуском к этой дисциплине.</li>
              )}
            </ul>
            <p className="admin-ta-wizard__hint">
              Активные задания по этой связке будут закреплены за новым преподавателем.
            </p>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteRow}
        title="Удалить назначение?"
        message={
          deleteRow
            ? `${teacherShort(deleteRow.teacher)} · ${deleteRow.subject?.name} · ${deleteRow.group?.name}. Связанные задания останутся в системе; строка назначения будет удалена.`
            : ''
        }
        confirmText="Удалить"
        danger
        onClose={() => !deleteSubmitting && setDeleteRow(null)}
        onConfirm={() => submitDelete()}
      />
    </div>
  );
};

export default AdminTeachingAssignmentsManagement;
