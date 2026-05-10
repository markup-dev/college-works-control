import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import Modal from '../../UI/Modal/Modal';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import './AdminTeachingAssignmentsManagement.scss';

const PER_PAGE = 18;
const LIST_CAP = 200;

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'Без группировки' },
  { value: 'teacher', label: 'По преподавателю' },
  { value: 'subject', label: 'По предмету' },
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

const AdminTeachingAssignmentsManagement = () => {
  const { showSuccess, showError } = useNotification();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [groupBy, setGroupBy] = useState('none');
  const [page, setPage] = useState(1);

  const [loads, setLoads] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: PER_PAGE });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [specialtyOptions, setSpecialtyOptions] = useState([]);

  const [openMenuId, setOpenMenuId] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createTeacher, setCreateTeacher] = useState('');
  const [createSubject, setCreateSubject] = useState('');
  const [createGroupSearch, setCreateGroupSearch] = useState('');
  const [createSpecialty, setCreateSpecialty] = useState('');
  const [createSelectedGroups, setCreateSelectedGroups] = useState(() => new Set());
  const [createTeacherSearch, setCreateTeacherSearch] = useState('');
  const [createSubjectSearch, setCreateSubjectSearch] = useState('');
  const [createPrefill, setCreatePrefill] = useState(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [detailId, setDetailId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editPair, setEditPair] = useState(null);
  const [editGroupSearch, setEditGroupSearch] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editSelected, setEditSelected] = useState(() => new Set());
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [transferRow, setTransferRow] = useState(null);
  const [transferSearch, setTransferSearch] = useState('');
  const [transferTeacher, setTransferTeacher] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const [t, s, g] = await Promise.all([
          api.get('/admin/users', { params: { role: 'teacher', per_page: LIST_CAP, sort: 'name_asc' } }),
          api.get('/admin/subjects', { params: { per_page: LIST_CAP, sort: 'name_asc' } }),
          api.get('/admin/groups', { params: { per_page: LIST_CAP, sort: 'name_asc' } }),
        ]);
        if (c) return;
        setTeachers(Array.isArray(t.data?.data) ? t.data.data : []);
        setSubjects(Array.isArray(s.data?.data) ? s.data.data : []);
        setGroups(Array.isArray(g.data?.data) ? g.data.data : []);
        const setSp = new Set();
        (Array.isArray(g.data?.data) ? g.data.data : []).forEach((x) => {
          if (x.specialty && String(x.specialty).trim()) setSp.add(String(x.specialty).trim());
        });
        setSpecialtyOptions(Array.from(setSp).sort((a, b) => a.localeCompare(b, 'ru')));
      } catch {
        if (!c) {
          setTeachers([]);
          setSubjects([]);
          setGroups([]);
          setSpecialtyOptions([]);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const fetchLoads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        per_page: PER_PAGE,
        sort: 'teacher_asc',
      };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (teacherId) params.teacher_id = Number(teacherId);
      if (subjectId) params.subject_id = Number(subjectId);
      if (groupId) params.group_id = Number(groupId);
      if (specialty) params.specialty = specialty;

      const { data } = await api.get('/admin/teaching-loads', { params });
      setLoads(Array.isArray(data?.data) ? data.data : []);
      const m = data?.meta;
      setMeta({
        currentPage: m?.currentPage ?? page,
        lastPage: m?.lastPage ?? 1,
        total: m?.total ?? 0,
        perPage: m?.perPage ?? PER_PAGE,
      });
    } catch (e) {
      setLoads([]);
      setError(firstApiErrorMessage(e, 'Не удалось загрузить назначения'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, teacherId, subjectId, groupId, specialty]);

  useEffect(() => {
    void fetchLoads();
  }, [fetchLoads]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, teacherId, subjectId, groupId, specialty]);

  useEffect(() => {
    if (openMenuId == null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.admin-ta-card__menu-root')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenuId]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setTeacherId('');
    setSubjectId('');
    setGroupId('');
    setSpecialty('');
    setPage(1);
  }, []);

  const resetDisabled = useMemo(
    () => !search.trim() && !teacherId && !subjectId && !groupId && !specialty,
    [search, teacherId, subjectId, groupId, specialty],
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
    setCreateSpecialty('');
    setCreateTeacherSearch('');
    setCreateSubjectSearch('');
    const g = new Set();
    if (prefill?.groupId) g.add(Number(prefill.groupId));
    setCreateSelectedGroups(g);
    setCreateOpen(true);
  };

  const filteredTeachersCreate = useMemo(() => {
    const q = createTeacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((u) => {
      const blob = [u.lastName, u.firstName, u.middleName, u.login, u.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [teachers, createTeacherSearch]);

  const filteredSubjectsCreate = useMemo(() => {
    const q = createSubjectSearch.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => {
      const blob = `${s.name || ''} ${s.code || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [subjects, createSubjectSearch]);

  const groupsForCreate = useMemo(() => {
    let list = groups.filter((g) => g.status !== 'inactive');
    if (createSpecialty) {
      list = list.filter((g) => (g.specialty || '') === createSpecialty);
    }
    const q = createGroupSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => (g.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [groups, createSpecialty, createGroupSearch]);

  useEffect(() => {
    if (!createOpen || !createPrefill?.teacherId) return;
    setCreateTeacher(String(createPrefill.teacherId));
  }, [createOpen, createPrefill]);

  const submitCreate = async () => {
    if (!createTeacher || !createSubject || createSelectedGroups.size === 0) {
      showError('Выберите преподавателя, предмет и хотя бы одну группу.');
      return;
    }
    setCreateSubmitting(true);
    try {
      const { data } = await api.post('/admin/teaching-loads/batch', {
        teacherId: Number(createTeacher),
        subjectId: Number(createSubject),
        groupIds: Array.from(createSelectedGroups),
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
      showError(firstApiErrorMessage(e, 'Не удалось создать назначения'));
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
    } catch {
      showError('Не удалось загрузить детали');
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
    setEditSpecialty('');
    setEditSubmitting(false);
    try {
      const { data } = await api.get('/admin/teaching-loads', {
        params: { teacher_id: tid, subject_id: sid, per_page: 100, sort: 'group_asc' },
      });
      const list = Array.isArray(data?.data) ? data.data : [];
      const ids = new Set(list.map((x) => Number(x.groupId ?? x.group_id)));
      setEditSelected(ids);
      setEditPair((p) => ({ ...p, existingRows: list }));
    } catch {
      showError('Не удалось загрузить текущие группы');
      setEditPair(null);
    }
  };

  const groupsForEdit = useMemo(() => {
    let list = groups.filter((g) => g.status !== 'inactive');
    if (editSpecialty) list = list.filter((g) => (g.specialty || '') === editSpecialty);
    const q = editGroupSearch.trim().toLowerCase();
    if (q) list = list.filter((g) => (g.name || '').toLowerCase().includes(q));
    return list;
  }, [groups, editSpecialty, editGroupSearch]);

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
      showError(firstApiErrorMessage(e, 'Не удалось сохранить'));
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
      showError(firstApiErrorMessage(e, 'Не удалось сменить преподавателя'));
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
      showError(firstApiErrorMessage(e, 'Не удалось удалить'));
      throw e;
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const eligibleTransferTeachers = useMemo(() => {
    if (!transferRow) return [];
    const tid = transferRow.teacherId ?? transferRow.teacher_id;
    const q = transferSearch.trim().toLowerCase();
    return teachers
      .filter((u) => Number(u.id) !== Number(tid))
      .filter((u) => {
        if (!q) return true;
        const blob = [u.lastName, u.firstName, u.middleName, u.login].filter(Boolean).join(' ').toLowerCase();
        return blob.includes(q);
      });
  }, [teachers, transferRow, transferSearch]);

  const renderCard = (row) => {
    const sc = row.studentsCount ?? row.students_count ?? 0;
    const ac = row.assignmentsCount ?? row.assignments_count ?? 0;
    return (
      <div key={row.id} className="admin-ta-card">
        <div className="admin-ta-card__head">
          <div className="admin-ta-card__teacher">{teacherShort(row.teacher)}</div>
          <div className="admin-ta-card__menu-root">
            <button
              type="button"
              className="admin-ta-card__menu-btn"
              aria-label="Меню"
              onClick={() => setOpenMenuId((v) => (v === row.id ? null : row.id))}
            >
              ⋯
            </button>
            {openMenuId === row.id && (
              <ul className="admin-ta-card__menu" role="menu">
                <li>
                  <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); void openDetail(row.id); }}>
                    Детали назначения
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuId(null);
                      void openEditGroups(row);
                    }}
                  >
                    Изменить группы
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuId(null);
                      setTransferRow(row);
                      setTransferSearch('');
                      setTransferTeacher('');
                    }}
                  >
                    Сменить преподавателя
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-ta-card__menu-item--danger"
                    onClick={() => {
                      setOpenMenuId(null);
                      setDeleteRow(row);
                    }}
                  >
                    Удалить назначение
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
        <div className="admin-ta-card__subject">
          {row.subject?.name || '—'}
          {row.subject?.code ? ` (${row.subject.code})` : ''}
        </div>
        <div className="admin-ta-card__group">{row.group?.name || '—'}</div>
        <div className="admin-ta-card__stats">
          <span>👥 {ruStudents(sc)}</span>
          <span>📝 {ruAssignments(ac)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-teaching-assignments">
      <header className="admin-teaching-assignments__head">
        <div>
          <h1 className="admin-teaching-assignments__title">Назначения</h1>
          <p className="admin-teaching-assignments__lead">
            Одна карточка = преподаватель + предмет + группа. Поиск по ФИО, предмету, коду и названию группы.
          </p>
        </div>
      </header>

      <DashboardFilterToolbar
        className="admin-teaching-assignments__toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Глобальный поиск: преподаватель, предмет, код, группа…"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        popoverAlign="end"
        popoverAriaLabel="Фильтры назначений"
      >
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="ta-filter-teacher">Преподаватель</label>
          <select
            id="ta-filter-teacher"
            className="filter-select"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">Все</option>
            {teachers.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {teacherShort(u)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="ta-filter-subject">Предмет</label>
          <select
            id="ta-filter-subject"
            className="filter-select"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">Все</option>
            {subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.code ? `${s.name} (${s.code})` : s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="ta-filter-group">Группа</label>
          <select
            id="ta-filter-group"
            className="filter-select"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Все</option>
            {groups.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__field">
          <label className="filter-popover__label" htmlFor="ta-filter-spec">Специальность</label>
          <select
            id="ta-filter-spec"
            className="filter-select"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            <option value="">Все</option>
            {specialtyOptions.map((s) => (
              <option key={s} value={s}>
                {s}
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
        <div className="admin-teaching-assignments__banner admin-teaching-assignments__banner--error" role="alert">
          {error}
          <Button type="button" variant="secondary" size="small" onClick={() => void fetchLoads()}>
            Повторить
          </Button>
        </div>
      )}

      {loading ? (
        <p className="admin-teaching-assignments__hint">Загрузка…</p>
      ) : (
        groupedSections.map((section) => (
          <section key={section.key} className="admin-teaching-assignments__section">
            {section.title && (
              <div className="admin-teaching-assignments__section-head">
                <div>
                  <h2 className="admin-teaching-assignments__section-title">
                    {groupBy === 'group' && '📚 '}
                    {groupBy === 'teacher' && '👤 '}
                    {groupBy === 'subject' && '📖 '}
                    {section.title}
                    <span className="admin-teaching-assignments__section-count"> ({section.items.length})</span>
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
                <p className="admin-teaching-assignments__empty">Нет назначений по фильтру</p>
              ) : (
                section.items.map(renderCard)
              )}
            </div>
          </section>
        ))
      )}

      {!loading && meta.lastPage > 1 && (
        <div className="admin-teaching-assignments__pager">
          <Button
            type="button"
            variant="secondary"
            size="small"
            disabled={meta.currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Назад
          </Button>
          <span>
            {meta.currentPage} / {meta.lastPage}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="small"
            disabled={meta.currentPage >= meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд
          </Button>
        </div>
      )}

      <Modal
        isOpen={createOpen}
        title="Новое назначение"
        size="large"
        onClose={() => !createSubmitting && setCreateOpen(false)}
      >
          <div className="admin-ta-wizard">
            <div className="admin-ta-wizard__steps">
              <button type="button" className={createStep === 1 ? 'is-active' : ''} onClick={() => setCreateStep(1)}>
                1. Преподаватель
              </button>
              <button type="button" className={createStep === 2 ? 'is-active' : ''} onClick={() => createTeacher && setCreateStep(2)} disabled={!createTeacher}>
                2. Предмет
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
                  placeholder="Поиск преподавателя…"
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
                          onChange={() => setCreateTeacher(String(u.id))}
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
                  placeholder="Поиск предмета…"
                  value={createSubjectSearch}
                  onChange={(e) => setCreateSubjectSearch(e.target.value)}
                />
                <ul className="admin-ta-wizard__list">
                  {filteredSubjectsCreate.map((s) => (
                    <li key={s.id}>
                      <label className="admin-ta-wizard__radio">
                        <input
                          type="radio"
                          name="cta-s"
                          checked={String(createSubject) === String(s.id)}
                          onChange={() => setCreateSubject(String(s.id))}
                        />
                        <span>
                          {s.name} {s.code ? `(${s.code})` : ''}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {createStep === 3 && (
              <div className="admin-ta-wizard__panel">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Поиск группы…"
                  value={createGroupSearch}
                  onChange={(e) => setCreateGroupSearch(e.target.value)}
                />
                <div className="admin-ta-wizard__inline">
                  <label>
                    Специальность
                    <select className="filter-select" value={createSpecialty} onChange={(e) => setCreateSpecialty(e.target.value)}>
                      <option value="">Все</option>
                      {specialtyOptions.map((sp) => (
                        <option key={sp} value={sp}>
                          {sp}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    size="small"
                    variant="outline"
                    onClick={() => setCreateSelectedGroups(new Set(groupsForCreate.map((g) => g.id)))}
                  >
                    Выбрать все
                  </Button>
                  <Button type="button" size="small" variant="outline" onClick={() => setCreateSelectedGroups(new Set())}>
                    Снять все
                  </Button>
                  <Button
                    type="button"
                    size="small"
                    variant="outline"
                    onClick={() =>
                      setCreateSelectedGroups(
                        new Set(groupsForCreate.filter((g) => /^ИС/i.test(g.name || '')).map((g) => g.id)),
                      )
                    }
                  >
                    Все ИС-*
                  </Button>
                </div>
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
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="admin-ta-wizard__hint">
                  Выбрано групп: {createSelectedGroups.size}. Будет создано столько же назначений (дубликаты сервер пропустит).
                </p>
              </div>
            )}

            <div className="admin-ta-wizard__footer">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
                Отмена
              </Button>
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
                <Button type="button" variant="primary" onClick={() => void submitCreate()} disabled={createSubmitting}>
                  Создать {createSelectedGroups.size ? `${createSelectedGroups.size} ` : ''}
                  назначений
                </Button>
              )}
            </div>
          </div>
      </Modal>

      <Modal isOpen={!!detailId} title="Детали назначения" size="medium" onClose={() => setDetailId(null)}>
          {detailLoading && <p>Загрузка…</p>}
          {!detailLoading && detailData?.teachingLoad && (
            <div className="admin-ta-detail">
              <p>
                <strong>Преподаватель:</strong>{' '}
                {detailData.teachingLoad.teacher?.fullName || teacherShort(detailData.teachingLoad.teacher)}
              </p>
              <p>
                <strong>Email:</strong> {detailData.teachingLoad.teacher?.email || '—'}
              </p>
              <p>
                <strong>Предмет:</strong> {detailData.teachingLoad.subject?.name}{' '}
                {detailData.teachingLoad.subject?.code ? `(${detailData.teachingLoad.subject.code})` : ''}
              </p>
              <p>
                <strong>Группа:</strong> {detailData.teachingLoad.group?.name} ({ruStudents(detailData.stats?.studentsCount ?? detailData.stats?.students_count ?? 0)})
              </p>
              <div className="admin-ta-detail__stats">
                <p>Активных заданий: {detailData.stats?.assignmentsActive ?? detailData.stats?.assignments_active ?? 0}</p>
                <p>Всего заданий: {detailData.stats?.assignmentsTotal ?? detailData.stats?.assignments_total ?? 0}</p>
                <p>Сдано работ: {detailData.stats?.submissionsCount ?? detailData.stats?.submissions_count ?? 0}</p>
                <p>
                  Средний балл (оценённые):{' '}
                  {detailData.stats?.averageScore ?? detailData.stats?.average_score ?? '—'}
                </p>
              </div>
              {Array.isArray(detailData.recentAssignments) && detailData.recentAssignments.length > 0 && (
                <div>
                  <strong>Последние задания</strong>
                  <ul>
                    {detailData.recentAssignments.map((a) => (
                      <li key={a.id}>
                        {a.title} — {a.status}
                        {a.deadline ? ` (до ${a.deadline})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="admin-ta-detail__actions">
                <Button
                  type="button"
                  variant="secondary"
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
                  variant="secondary"
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
                <Button
                  type="button"
                  variant="outline"
                  size="small"
                  onClick={() => {
                    const tl = detailData.teachingLoad;
                    setDetailId(null);
                    setDeleteRow(tl);
                  }}
                >
                  Удалить назначение
                </Button>
              </div>
            </div>
          )}
      </Modal>

      <Modal
        isOpen={!!editPair}
        title="Изменить группы"
        size="medium"
        onClose={() => !editSubmitting && setEditPair(null)}
      >
        {editPair ? (
          <>
            <p>
              {teacherShort(editPair.teacher)} — {editPair.subject?.name}
            </p>
            <input
              type="search"
              className="search-input"
              placeholder="Поиск группы…"
              value={editGroupSearch}
              onChange={(e) => setEditGroupSearch(e.target.value)}
            />
            <select className="filter-select" value={editSpecialty} onChange={(e) => setEditSpecialty(e.target.value)}>
              <option value="">Специальность: все</option>
              {specialtyOptions.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
            <ul className="admin-ta-wizard__checks">
              {groupsForEdit.map((g) => (
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
                  </label>
                </li>
              ))}
            </ul>
            <p className="admin-ta-wizard__hint">
              Снять группу нельзя, если по ней уже есть учебные задания — сервер вернёт ошибку.
            </p>
            <div className="admin-ta-wizard__footer">
              <Button type="button" variant="secondary" onClick={() => setEditPair(null)} disabled={editSubmitting}>
                Отмена
              </Button>
              <Button type="button" variant="primary" onClick={() => void submitEditGroups()} disabled={editSubmitting}>
                Сохранить
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        isOpen={!!transferRow}
        title="Сменить преподавателя"
        size="medium"
        onClose={() => !transferSubmitting && setTransferRow(null)}
      >
        {transferRow ? (
          <>
            <p>
              Предмет: {transferRow.subject?.name}, группа: {transferRow.group?.name}
            </p>
            <p>Сейчас: {teacherShort(transferRow.teacher)}</p>
            <input
              type="search"
              className="search-input"
              placeholder="Поиск…"
              value={transferSearch}
              onChange={(e) => setTransferSearch(e.target.value)}
            />
            <ul className="admin-ta-wizard__list">
              {eligibleTransferTeachers.map((u) => (
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
            </ul>
            <p className="admin-ta-wizard__hint">
              Активные задания по этой связке будут закреплены за новым преподавателем.
            </p>
            <div className="admin-ta-wizard__footer">
              <Button type="button" variant="secondary" onClick={() => setTransferRow(null)} disabled={transferSubmitting}>
                Отмена
              </Button>
              <Button type="button" variant="primary" onClick={() => void submitTransfer()} disabled={transferSubmitting || !transferTeacher}>
                Сменить
              </Button>
            </div>
          </>
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
        cancelText="Отмена"
        danger
        onClose={() => !deleteSubmitting && setDeleteRow(null)}
        onConfirm={() => submitDelete()}
      />
    </div>
  );
};

export default AdminTeachingAssignmentsManagement;
