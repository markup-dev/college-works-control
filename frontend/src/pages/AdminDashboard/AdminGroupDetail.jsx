import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/adminApiErrors';
import { formatDateLong } from '../../utils/dateHelpers';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import Button from '../../components/UI/Button/Button';
import ConfirmModal from '../../components/UI/Modal/ConfirmModal';
import EmptyState from '../../components/UI/EmptyState/EmptyState';
import ErrorBanner from '../../components/UI/ErrorBanner/ErrorBanner';
import LoadingState from '../../components/UI/LoadingState/LoadingState';
import Modal from '../../components/UI/Modal/Modal';
import ModalSection from '../../components/UI/Modal/ModalSection';
import StatusBadge from '../../components/UI/StatusBadge/StatusBadge';
import DashboardFilterToolbar from '../../components/Shared/DashboardFilterToolbar';
import {
  buildAdminHomeworkHref,
  buildAdminTeachingAssignmentsHref,
  buildAdminUsersHref,
  openAdminSubject,
  openAdminUser,
} from '../../utils/adminEntityLinks';
import './AdminEntityDetail.scss';

const contentTabs = [
  { id: 'overview', label: 'Обзор' },
  { id: 'program', label: 'Программа' },
  { id: 'students', label: 'Студенты' },
  { id: 'teaching', label: 'Преподаватели' },
];

const shortName = (lastName, firstName, middleName) => {
  const first = firstName?.trim()?.[0] ? `${firstName.trim()[0]}.` : '';
  const middle = middleName?.trim()?.[0] ? `${middleName.trim()[0]}.` : '';
  return [lastName, `${first}${middle}`].filter(Boolean).join(' ').trim() || '—';
};

const studentInitials = (student) => {
  const a = (student?.lastName || '').trim().charAt(0);
  const b = (student?.firstName || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
};

const studentFirstMiddle = (student) => (
  [student?.firstName, student?.middleName].filter(Boolean).join(' ') || '—'
);

const studentScorePresentation = (score) => {
  if (score == null) {
    return { value: '—', caption: 'Нет оценок', tone: 'neutral' };
  }
  if (score >= 75) return { value: String(score), caption: 'Средний балл', tone: 'good' };
  if (score >= 60) return { value: String(score), caption: 'Средний балл', tone: 'mid' };
  return { value: String(score), caption: 'Средний балл', tone: 'low' };
};

const subjectStatusLabel = (status) => {
  if (status === 'active') return 'Активна';
  if (status === 'future') return 'Будет позже';
  return 'Завершена';
};

const subjectStatusTone = (status) => {
  if (status === 'active') return 'success';
  if (status === 'future') return 'info';
  return 'neutral';
};

const groupCurriculumByCourse = (items) => {
  const byCourse = new Map();
  items.forEach((item) => {
    const course = Number(item.course || 1);
    if (!byCourse.has(course)) byCourse.set(course, []);
    byCourse.get(course).push(item);
  });

  return Array.from(byCourse.entries())
    .sort(([courseA], [courseB]) => courseA - courseB)
    .map(([course, courseItems]) => ({ course, items: courseItems }));
};

const pluralDisciplines = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'дисциплина';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дисциплины';
  return 'дисциплин';
};

const pluralAssignments = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'задание';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'задания';
  return 'заданий';
};

const pluralTeachers = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'преподаватель';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'преподавателя';
  return 'преподавателей';
};

const teacherInitials = (teacher) => {
  if (!teacher) return '?';
  const a = (teacher.lastName || '').trim().charAt(0);
  const b = (teacher.firstName || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
};

const teacherDisplayName = (teacher) => (
  teacher
    ? shortName(teacher.lastName, teacher.firstName, teacher.middleName)
    : 'Преподаватель не назначен'
);

const teacherFirstMiddle = (teacher) => (
  teacher
    ? [teacher.firstName, teacher.middleName].filter(Boolean).join(' ') || '—'
    : 'Не указано'
);

const teacherSortKey = (teacher) => (
  [teacher?.lastName, teacher?.firstName, teacher?.middleName].filter(Boolean).join(' ')
);

const groupSubjectBlocksByTeacher = (blocks) => {
  const map = new Map();
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const teacherKey = block.teacher?.id != null ? String(block.teacher.id) : 'none';
    if (!map.has(teacherKey)) {
      map.set(teacherKey, { key: teacherKey, teacher: block.teacher, items: [] });
    }
    map.get(teacherKey).items.push(block);
  });

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => String(a.subject?.name || '').localeCompare(String(b.subject?.name || ''), 'ru')),
      totalAssignments: group.items.reduce((sum, item) => sum + (item.activeAssignmentsCount ?? 0), 0),
    }))
    .sort((a, b) => teacherSortKey(a.teacher).localeCompare(teacherSortKey(b.teacher), 'ru'));
};

const AdminGroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showSuccess, showError } = useNotification();

  const tabParam = searchParams.get('tab');
  const activeTab = contentTabs.some((tab) => tab.id === tabParam) ? tabParam : 'overview';
  const editOpen = searchParams.get('edit') === '1';

  useEffect(() => {
    if (tabParam !== 'edit') return;
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    next.set('edit', '1');
    setSearchParams(next, { replace: true });
  }, [tabParam, searchParams, setSearchParams]);

  const [data, setData] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [programCourse, setProgramCourse] = useState('');
  const [programStatus, setProgramStatus] = useState('');
  const [programSearch, setProgramSearch] = useState('');
  const [expandedProgramCourses, setExpandedProgramCourses] = useState(() => new Set());
  const [expandedTeachers, setExpandedTeachers] = useState(() => new Set());
  const [closeConfirmName, setCloseConfirmName] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addGroupFilter, setAddGroupFilter] = useState('');
  const [addFilterGroups, setAddFilterGroups] = useState([]);
  const [addCandidates, setAddCandidates] = useState([]);
  const [addCandidatesLoading, setAddCandidatesLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const debouncedAddSearch = useDebouncedValue(addSearch, 300);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferStudent, setTransferStudent] = useState(null);
  const [transferTargetGroupId, setTransferTargetGroupId] = useState('');
  const [transferGroups, setTransferGroups] = useState([]);
  const [transferGroupsLoading, setTransferGroupsLoading] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [removeStudent, setRemoveStudent] = useState(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    specialtyId: '',
    admissionYear: '',
    currentCourse: '1',
  });

  const loadGroup = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get(`/admin/groups/${id}`);
      setData(response);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Не удалось загрузить группу'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    (async () => {
      try {
        const { data: response } = await api.get('/admin/groups/specialties');
        setSpecialties(Array.isArray(response?.data) ? response.data : []);
      } catch {
        setSpecialties([]);
      }
    })();
  }, []);

  const group = data?.group;
  const groupSpecialtyId = group?.specialtyId || group?.specialtyRef?.id;

  useEffect(() => {
    if (!group) return;
    setEditForm({
      name: group.name || '',
      specialtyId: String(group.specialtyId || group.specialtyRef?.id || ''),
      admissionYear: String(group.admissionYear || ''),
      currentCourse: String(group.currentCourse || 1),
    });
  }, [group]);

  const curriculum = useMemo(
    () => (Array.isArray(data?.curriculum) ? data.curriculum.flat() : []),
    [data?.curriculum],
  );

  const curriculumByCourse = useMemo(() => {
    const q = programSearch.trim().toLowerCase();
    const filtered = curriculum.filter((item) => {
      if (programCourse && Number(item.course) !== Number(programCourse)) return false;
      if (programStatus && item.status !== programStatus) return false;
      if (q && !String(item.subject?.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
    return groupCurriculumByCourse(filtered);
  }, [curriculum, programCourse, programSearch, programStatus]);

  const curriculumItemsCount = useMemo(
    () => curriculumByCourse.reduce((sum, section) => sum + section.items.length, 0),
    [curriculumByCourse],
  );

  const teachingByTeacher = useMemo(
    () => groupSubjectBlocksByTeacher(data?.subjectBlocks),
    [data?.subjectBlocks],
  );

  const teachingSummary = useMemo(() => ({
    loads: teachingByTeacher.reduce((sum, group) => sum + group.items.length, 0),
    teachers: teachingByTeacher.length,
    assignments: teachingByTeacher.reduce((sum, group) => sum + group.totalAssignments, 0),
  }), [teachingByTeacher]);

  const courses = useMemo(() => {
    const maxCourse = Math.max(Number(group?.studyYears || 1), ...curriculum.map((item) => Number(item.course || 1)));
    return Array.from({ length: maxCourse }, (_, index) => index + 1);
  }, [curriculum, group?.studyYears]);

  const setTab = (tabId) => {
    setSearchParams(tabId === 'overview' ? {} : { tab: tabId });
  };

  const openEdit = () => {
    const next = new URLSearchParams();
    if (activeTab !== 'overview') next.set('tab', activeTab);
    next.set('edit', '1');
    setSearchParams(next);
  };

  const closeEdit = () => {
    setSearchParams(activeTab === 'overview' ? {} : { tab: activeTab });
  };

  const resetProgramFilters = () => {
    setProgramCourse('');
    setProgramStatus('');
    setProgramSearch('');
  };

  const programFiltersResetDisabled = !programCourse && !programStatus && !programSearch.trim();

  useEffect(() => {
    if (programCourse) {
      setExpandedProgramCourses(new Set([Number(programCourse)]));
      return;
    }
    if (activeTab === 'program' && group?.currentCourse) {
      setExpandedProgramCourses(new Set([Number(group.currentCourse)]));
    }
  }, [programCourse, group?.currentCourse, activeTab]);

  const toggleProgramCourse = (course) => {
    setExpandedProgramCourses((prev) => {
      const next = new Set(prev);
      if (next.has(course)) next.delete(course);
      else next.add(course);
      return next;
    });
  };

  const toggleTeacher = (teacherKey) => {
    setExpandedTeachers((prev) => {
      const next = new Set(prev);
      if (next.has(teacherKey)) next.delete(teacherKey);
      else next.add(teacherKey);
      return next;
    });
  };

  const saveGroup = async () => {
    if (!group) return;
    setSaving(true);
    try {
      await api.put(`/admin/groups/${group.id}`, {
        name: editForm.name.trim(),
        specialtyId: editForm.specialtyId ? Number(editForm.specialtyId) : undefined,
        admissionYear: editForm.admissionYear ? Number(editForm.admissionYear) : undefined,
        currentCourse: Number(editForm.currentCourse),
      });
      showSuccess('Группа сохранена');
      await loadGroup();
      closeEdit();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось сохранить группу'));
    } finally {
      setSaving(false);
    }
  };

  const closeGroup = async () => {
    if (!group || closeConfirmName.trim() !== group.name) {
      showError('Введите точное название группы для подтверждения');
      return;
    }
    try {
      await api.put(`/admin/groups/${group.id}`, { status: 'inactive' });
      showSuccess('Группа закрыта');
      setCloseConfirmName('');
      await loadGroup();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось закрыть группу'));
    }
  };

  const reopenGroup = async () => {
    if (!group) return;
    setReopenSubmitting(true);
    try {
      await api.put(`/admin/groups/${group.id}`, { status: 'active' });
      showSuccess('Группа снова активна');
      setShowReopenConfirm(false);
      await loadGroup();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось открыть группу'));
      throw e;
    } finally {
      setReopenSubmitting(false);
    }
  };

  const loadAddCandidates = useCallback(async () => {
    setAddCandidatesLoading(true);
    try {
      const params = {
        role: 'student',
        per_page: 100,
        sort: 'name_asc',
      };
      const q = debouncedAddSearch.trim();
      if (q) params.search = q;
      if (addGroupFilter === 'none') {
        params.without_group = 1;
      } else if (addGroupFilter) {
        params.group_id = Number(addGroupFilter);
      }

      const { data: response } = await api.get('/admin/users', { params });
      const items = Array.isArray(response?.data) ? response.data : [];
      setAddCandidates(items.filter((student) => Number(student.groupId || student.group_id) !== Number(id)));
    } catch {
      setAddCandidates([]);
      showError('Не удалось загрузить список студентов');
    } finally {
      setAddCandidatesLoading(false);
    }
  }, [addGroupFilter, debouncedAddSearch, id, showError]);

  const loadAddFilterGroups = useCallback(async () => {
    try {
      const { data: response } = await api.get('/admin/groups', {
        params: { per_page: 100, sort: 'name_asc' },
      });
      const items = Array.isArray(response?.data) ? response.data : [];
      setAddFilterGroups(items.filter((item) => Number(item.id) !== Number(id)));
    } catch {
      setAddFilterGroups([]);
    }
  }, [id]);

  useEffect(() => {
    if (!addModalOpen) return;
    void loadAddCandidates();
  }, [addModalOpen, loadAddCandidates]);

  const resetAddFilters = () => {
    setAddSearch('');
    setAddGroupFilter('');
  };

  const addFiltersResetDisabled = !addSearch.trim() && !addGroupFilter;

  const openAddStudentsModal = () => {
    setAddSearch('');
    setAddGroupFilter('');
    setSelectedStudentIds([]);
    setAddModalOpen(true);
    void loadAddFilterGroups();
  };

  const toggleAddStudent = (studentId) => {
    setSelectedStudentIds((prev) => (
      prev.includes(studentId)
        ? prev.filter((value) => value !== studentId)
        : [...prev, studentId]
    ));
  };

  const submitAddStudents = async () => {
    if (!group || selectedStudentIds.length === 0) {
      showError('Выберите хотя бы одного студента');
      return;
    }
    setAddSubmitting(true);
    try {
      await api.post(`/admin/groups/${group.id}/students/bulk`, {
        student_ids: selectedStudentIds,
      });
      showSuccess(`Добавлено студентов: ${selectedStudentIds.length}`);
      setAddModalOpen(false);
      setSelectedStudentIds([]);
      await loadGroup();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось добавить студентов'));
    } finally {
      setAddSubmitting(false);
    }
  };

  const loadTransferGroups = useCallback(async () => {
    setTransferGroupsLoading(true);
    try {
      const { data: response } = await api.get('/admin/groups', {
        params: { per_page: 100, sort: 'name_asc' },
      });
      const items = Array.isArray(response?.data) ? response.data : [];
      setTransferGroups(items.filter((item) => Number(item.id) !== Number(id)));
    } catch {
      setTransferGroups([]);
      showError('Не удалось загрузить список групп');
    } finally {
      setTransferGroupsLoading(false);
    }
  }, [id, showError]);

  const openTransferModal = (student) => {
    setTransferStudent(student);
    setTransferTargetGroupId('');
    setTransferModalOpen(true);
    void loadTransferGroups();
  };

  const submitTransferStudent = async () => {
    if (!transferStudent || !transferTargetGroupId) {
      showError('Выберите группу для перевода');
      return;
    }
    setTransferSubmitting(true);
    try {
      await api.post(`/admin/groups/${transferTargetGroupId}/students/bulk`, {
        student_ids: [transferStudent.id],
      });
      showSuccess('Студент переведён в другую группу');
      setTransferModalOpen(false);
      setTransferStudent(null);
      await loadGroup();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось перевести студента'));
    } finally {
      setTransferSubmitting(false);
    }
  };

  const submitRemoveStudent = async () => {
    if (!group || !removeStudent) return;
    setRemoveSubmitting(true);
    try {
      await api.delete(`/admin/groups/${group.id}/students/${removeStudent.id}`);
      showSuccess('Студент исключён из группы');
      setRemoveStudent(null);
      await loadGroup();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось исключить студента'));
    } finally {
      setRemoveSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Загрузка группы..." />;
  }

  if (error || !group) {
    return (
      <ErrorBanner
        title="Не удалось открыть группу"
        message={error || 'Группа не найдена'}
        actionLabel="К списку групп"
        onAction={() => navigate('/admin/groups')}
      />
    );
  }

  return (
    <div className={`admin-entity-detail${editOpen ? ' admin-entity-detail--edit-open' : ''}`}>
      <div className="admin-entity-detail__topbar">
        <Button type="button" variant="outline" onClick={() => navigate('/admin/groups')}>
          Назад к группам
        </Button>
        <div className="admin-entity-detail__actions">
          {!editOpen && group.status === 'inactive' ? (
            <Button
              type="button"
              variant="primary"
              disabled={(group.studentsCount ?? 0) < 1}
              title={(group.studentsCount ?? 0) < 1 ? 'Сначала добавьте хотя бы одного студента' : undefined}
              onClick={() => setShowReopenConfirm(true)}
            >
              Открыть группу
            </Button>
          ) : null}
          <Button
            type="button"
            variant={editOpen ? 'secondary' : 'outline'}
            onClick={() => (editOpen ? closeEdit() : openEdit())}
          >
            {editOpen ? 'Закрыть' : 'Редактировать'}
          </Button>
        </div>
      </div>

      <section className="admin-entity-detail__hero">
        <div>
          <p className="admin-entity-detail__eyebrow">Группа</p>
          <h1>{group.name}</h1>
          <p>{group.specialty || 'Специальность не указана'}</p>
        </div>
        <StatusBadge tone={group.status === 'active' ? 'success' : 'neutral'}>
          {group.status === 'active' ? 'Активна' : group.status === 'graduated' ? 'Выпущена' : 'Закрыта'}
        </StatusBadge>
      </section>

      <nav className="dashboard-tabs admin-entity-detail__tabs" aria-label="Разделы группы">
        {contentTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn${activeTab === tab.id ? ' tab-btn--active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            <span className="tab-btn__label">{tab.label}</span>
            {activeTab === tab.id && <span className="tab-btn__indicator" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      {editOpen && (
        <ModalSection title="Редактирование группы">
          <div className="admin-entity-detail__form-grid">
            <label>
              Название
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Например: ИС-31"
                autoComplete="off"
              />
            </label>
            <label>
              Специальность
              <select value={editForm.specialtyId} onChange={(event) => setEditForm((prev) => ({ ...prev, specialtyId: event.target.value }))}>
                <option value="">Выберите специальность</option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={String(specialty.id)}>{specialty.name}</option>
                ))}
              </select>
            </label>
            <label>
              Год начала
              <input
                type="number"
                min="2000"
                max="2100"
                value={editForm.admissionYear}
                onChange={(event) => setEditForm((prev) => ({ ...prev, admissionYear: event.target.value }))}
                placeholder="2025"
              />
            </label>
            <label>
              Текущий курс
              <input
                type="number"
                min="1"
                max="6"
                value={editForm.currentCourse}
                onChange={(event) => setEditForm((prev) => ({ ...prev, currentCourse: event.target.value }))}
                placeholder="1"
              />
            </label>
          </div>
          <div className="admin-entity-detail__form-actions">
            <Button type="button" variant="primary" loading={saving} onClick={() => void saveGroup()}>
              Сохранить изменения
            </Button>
          </div>

          {group.status === 'active' && (
            <div className="admin-entity-detail__danger-zone">
              <h3>Закрытие группы</h3>
              <p>После закрытия активные назначения преподавателей будут отключены.</p>
              <div className="admin-entity-detail__danger-row">
                <input
                  value={closeConfirmName}
                  onChange={(event) => setCloseConfirmName(event.target.value)}
                  placeholder={`Введите ${group.name}`}
                />
                <Button type="button" variant="danger" onClick={() => void closeGroup()}>
                  Закрыть группу
                </Button>
              </div>
            </div>
          )}
        </ModalSection>
      )}

      {!editOpen && activeTab === 'overview' && (
        <div className="admin-entity-detail__stack">
          <ModalSection title="Основная информация">
            <div className="admin-entity-detail__info-grid">
              <div className="admin-entity-detail__info-card">
                <span>Специальность</span>
                <strong>{group.specialty || '—'}</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Период обучения</span>
                <strong>{group.admissionYear || '—'}–{group.graduationYear || '—'}</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Текущий курс</span>
                <strong>{group.currentCourse || 1}</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Студентов</span>
                <strong>{group.studentsCount ?? 0}</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Преподавателей</span>
                <strong>{group.teachersCount ?? 0}</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Создана</span>
                <strong>{formatDateLong(group.createdAt)}</strong>
              </div>
            </div>
          </ModalSection>

          <ModalSection title="Быстрые ссылки" variant="soft">
            <div className="admin-entity-detail__link-row">
              <Button type="button" variant="outline" onClick={() => setTab('program')}>
                Вся программа ({curriculum.length})
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(buildAdminUsersHref({ role: 'student', groupId: group.id }))}
              >
                Все студенты ({group.studentsCount ?? 0})
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(buildAdminTeachingAssignmentsHref({ groupId: group.id }))}
              >
                Назначения ({group.teachersCount ?? 0})
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(buildAdminHomeworkHref({ groupId: group.id }))}
              >
                Задания группы
              </Button>
              {groupSpecialtyId ? (
                <Button type="button" variant="outline" onClick={() => navigate(`/admin/specialties/${groupSpecialtyId}`)}>
                  Специальность
                </Button>
              ) : null}
            </div>
          </ModalSection>
        </div>
      )}

      {!editOpen && activeTab === 'program' && (
        <ModalSection title="Программа группы" variant="soft">
          <DashboardFilterToolbar
            className="admin-entity-detail__filter-toolbar"
            searchValue={programSearch}
            onSearchChange={setProgramSearch}
            searchPlaceholder="Поиск по дисциплине…"
            onReset={resetProgramFilters}
            resetDisabled={programFiltersResetDisabled}
            popoverAlign="end"
            popoverAriaLabel="Фильтры программы группы"
          >
            <div className="filter-popover__section">
              <label className="filter-popover__label" htmlFor="group-program-course">
                Курс
              </label>
              <select
                id="group-program-course"
                className="filter-popover__select"
                value={programCourse}
                onChange={(event) => setProgramCourse(event.target.value)}
              >
                <option value="">Все курсы</option>
                {courses.map((course) => (
                  <option key={course} value={String(course)}>{course} курс</option>
                ))}
              </select>
            </div>
            <div className="filter-popover__section">
              <label className="filter-popover__label" htmlFor="group-program-status">
                Статус
              </label>
              <select
                id="group-program-status"
                className="filter-popover__select"
                value={programStatus}
                onChange={(event) => setProgramStatus(event.target.value)}
              >
                <option value="">Все статусы</option>
                <option value="active">Активные</option>
                <option value="completed">Завершенные</option>
                <option value="future">Будущие</option>
              </select>
            </div>
          </DashboardFilterToolbar>
          <div className="admin-entity-detail__form-actions admin-entity-detail__form-actions--top">
            {groupSpecialtyId ? (
              <Button type="button" variant="outline" onClick={() => navigate(`/admin/specialties/${groupSpecialtyId}?tab=program`)}>
                Программа специальности
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => navigate('/admin/subjects')}>
              Справочник дисциплин
            </Button>
          </div>
          {curriculumItemsCount === 0 ? (
            <EmptyState title="Дисциплины не найдены" message="Измените фильтры или проверьте программу группы." />
          ) : (
            <div className="admin-entity-detail__program-accordion">
              {curriculumByCourse.map(({ course, items }) => {
                const isOpen = expandedProgramCourses.has(course);
                return (
                  <div
                    key={course}
                    className={`admin-entity-detail__program-accordion-item${isOpen ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="admin-entity-detail__program-accordion-trigger"
                      aria-expanded={isOpen}
                      onClick={() => toggleProgramCourse(course)}
                    >
                      <span className="admin-entity-detail__program-accordion-title">{course} курс</span>
                      <span className="admin-entity-detail__program-accordion-meta">
                        {items.length} {pluralDisciplines(items.length)}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="admin-entity-detail__program-accordion-panel">
                        <div className="admin-entity-detail__item-list">
                          {items.map((item) => (
                            <article
                              key={item.id}
                              className={`admin-entity-detail__item-card${item.subject?.id ? ' admin-entity-detail__item-card--clickable' : ''}`}
                              role={item.subject?.id ? 'button' : undefined}
                              tabIndex={item.subject?.id ? 0 : undefined}
                              onClick={item.subject?.id ? () => openAdminSubject(navigate, item.subject.id) : undefined}
                              onKeyDown={item.subject?.id ? (event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  openAdminSubject(navigate, item.subject.id);
                                }
                              } : undefined}
                            >
                              <div>
                                <h3>{item.subject?.name || '—'}</h3>
                                <p>{item.subject?.code || '—'}</p>
                                {item.note && <p>{item.note}</p>}
                              </div>
                              <div className="admin-entity-detail__item-card-meta">
                                <StatusBadge tone={subjectStatusTone(item.status)}>
                                  {subjectStatusLabel(item.status)}
                                </StatusBadge>
                                {item.closedAt && (
                                  <span className="admin-entity-detail__item-card-date">
                                    Закрыта: {formatDateLong(item.closedAt)}
                                  </span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ModalSection>
      )}

      {!editOpen && activeTab === 'students' && (
        <ModalSection title={`Студенты (${group.studentsCount ?? 0})`}>
          <div className="admin-entity-detail__form-actions admin-entity-detail__form-actions--top">
            <Button type="button" variant="primary" onClick={openAddStudentsModal}>
              Добавить студентов
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(buildAdminUsersHref({ role: 'student', groupId: group.id }))}
            >
              Открыть в списке пользователей
            </Button>
          </div>

          {(!data.students || data.students.length === 0) ? (
            <EmptyState
              title="Студентов пока нет"
              message="Добавьте существующих студентов из других групп или без группы."
            />
          ) : (
            <div className="admin-entity-detail__students-grid">
              {data.students.map((student) => {
                const score = studentScorePresentation(student.avgScore);
                const overdue = student.overdueAssignments ?? 0;
                return (
                  <article
                    key={student.id}
                    className="admin-entity-detail__student-card admin-entity-detail__student-card--clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => openAdminUser(navigate, student.id, { role: 'student', groupId: group.id })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openAdminUser(navigate, student.id, { role: 'student', groupId: group.id });
                      }
                    }}
                  >
                    <div className="admin-entity-detail__student-card-top">
                      <div className="admin-entity-detail__student-card-avatar" aria-hidden>
                        {studentInitials(student)}
                      </div>
                      <div className="admin-entity-detail__student-card-name">
                        <div className="admin-entity-detail__student-card-lastname">
                          {student.lastName || '—'}
                        </div>
                        <div className="admin-entity-detail__student-card-first">
                          {studentFirstMiddle(student)}
                        </div>
                      </div>
                    </div>

                    <div className="admin-entity-detail__student-card-fields">
                      <div className="admin-entity-detail__student-card-row">
                        <span className="admin-entity-detail__student-card-label">{score.caption}</span>
                        <span className={`admin-entity-detail__student-card-value admin-entity-detail__student-card-value--${score.tone}`}>
                          {score.value}
                        </span>
                      </div>
                      <div className="admin-entity-detail__student-card-row">
                        <span className="admin-entity-detail__student-card-label">Просрочено</span>
                        <span className={`admin-entity-detail__student-card-value${overdue > 0 ? ' admin-entity-detail__student-card-value--warn' : ''}`}>
                          {overdue > 0 ? overdue : '0'}
                        </span>
                      </div>
                    </div>

                    <div className="admin-entity-detail__student-card-actions">
                      <Button
                        type="button"
                        variant="outline"
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          openTransferModal(student);
                        }}
                      >
                        Перевести
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          setRemoveStudent(student);
                        }}
                      >
                        Исключить
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </ModalSection>
      )}

      {!editOpen && activeTab === 'teaching' && (
        <ModalSection title="Преподаватели и дисциплины">
          <div className="admin-entity-detail__form-actions admin-entity-detail__form-actions--top">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(buildAdminTeachingAssignmentsHref({ groupId: group.id }))}
            >
              Назначения группы
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(buildAdminHomeworkHref({ groupId: group.id }))}
            >
              Задания группы
            </Button>
          </div>

          {teachingByTeacher.length > 0 && (
            <div className="admin-entity-detail__loads-summary">
              <span className="admin-entity-detail__teaching-stat-chip">
                {teachingSummary.loads} {pluralDisciplines(teachingSummary.loads)}
              </span>
              <span className="admin-entity-detail__teaching-stat-chip">
                {teachingSummary.teachers} {pluralTeachers(teachingSummary.teachers)}
              </span>
              <span className={`admin-entity-detail__teaching-stat-chip${teachingSummary.assignments > 0 ? ' admin-entity-detail__teaching-stat-chip--active' : ''}`}>
                {teachingSummary.assignments} активных {pluralAssignments(teachingSummary.assignments)}
              </span>
            </div>
          )}

          {teachingByTeacher.length === 0 ? (
            <EmptyState title="Назначений пока нет" message="Назначьте преподавателей в разделе «Назначения»." />
          ) : (
            <div className="admin-entity-detail__teaching-accordion">
              {teachingByTeacher.map((teacherGroup) => {
                const isOpen = expandedTeachers.has(teacherGroup.key);
                const teacher = teacherGroup.teacher;

                return (
                  <div
                    key={teacherGroup.key}
                    className={`admin-entity-detail__teaching-accordion-item${isOpen ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="admin-entity-detail__teaching-accordion-trigger"
                      aria-expanded={isOpen}
                      onClick={() => toggleTeacher(teacherGroup.key)}
                    >
                      <span className="admin-entity-detail__teaching-accordion-head">
                        <span className="admin-entity-detail__teaching-accordion-avatar" aria-hidden>
                          {teacherInitials(teacher)}
                        </span>
                        <span className="admin-entity-detail__teaching-accordion-identity">
                          <span className="admin-entity-detail__teaching-accordion-lastname">
                            {teacher?.lastName || teacherDisplayName(teacher)}
                          </span>
                          {teacher && (
                            <span className="admin-entity-detail__teaching-accordion-first">
                              {teacherFirstMiddle(teacher)}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="admin-entity-detail__teaching-accordion-stats">
                        <span className="admin-entity-detail__teaching-stat-chip">
                          {teacherGroup.items.length} {pluralDisciplines(teacherGroup.items.length)}
                        </span>
                        <span className={`admin-entity-detail__teaching-stat-chip${teacherGroup.totalAssignments > 0 ? ' admin-entity-detail__teaching-stat-chip--active' : ''}`}>
                          {teacherGroup.totalAssignments} {pluralAssignments(teacherGroup.totalAssignments)}
                        </span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="admin-entity-detail__teaching-accordion-panel">
                        <div className="admin-entity-detail__discipline-list">
                          {teacherGroup.items.map((block, index) => {
                            const activeCount = block.activeAssignmentsCount ?? 0;
                            const totalCount = block.assignmentsTotal ?? 0;
                            const submissionsCount = block.submissionsCount ?? 0;
                            const homeworkHref = buildAdminHomeworkHref({
                              groupId: group.id,
                              teacherId: block.teacher?.id,
                              subjectId: block.subject?.id,
                            });

                            return (
                              <article
                                key={`${block.subject?.id}-${block.teacher?.id}-${index}`}
                                className="admin-entity-detail__discipline-row"
                              >
                                <div className="admin-entity-detail__discipline-row-main">
                                  <h3>{block.subject?.name || '—'}</h3>
                                  {block.subject?.code ? <p>{block.subject.code}</p> : null}
                                </div>
                                <div className="admin-entity-detail__discipline-row-meta">
                                  <div className="admin-entity-detail__discipline-row-stats">
                                    <div className={`admin-entity-detail__discipline-stat${activeCount > 0 ? ' admin-entity-detail__discipline-stat--active' : ''}`}>
                                      <span className="admin-entity-detail__discipline-stat-label">Активных</span>
                                      <strong>{activeCount}</strong>
                                    </div>
                                    <div className="admin-entity-detail__discipline-stat">
                                      <span className="admin-entity-detail__discipline-stat-label">Всего</span>
                                      <strong>{totalCount}</strong>
                                    </div>
                                    <div className="admin-entity-detail__discipline-stat">
                                      <span className="admin-entity-detail__discipline-stat-label">Сдано</span>
                                      <strong>{submissionsCount}</strong>
                                    </div>
                                  </div>
                                  {totalCount > 0 ? (
                                    <button
                                      type="button"
                                      className="admin-entity-detail__discipline-row-link"
                                      onClick={() => navigate(homeworkHref)}
                                    >
                                      Задания ({activeCount > 0 ? activeCount : totalCount})
                                    </button>
                                  ) : (
                                    <span className="admin-entity-detail__discipline-row-empty">Заданий пока нет</span>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ModalSection>
      )}

      <Modal
        isOpen={addModalOpen}
        onClose={() => !addSubmitting && setAddModalOpen(false)}
        title="Добавить студентов"
        subtitle="Выберите студентов из других групп или без группы"
        size="medium"
        closeDisabled={addSubmitting}
        footer={(
          <>
            <Button
              variant="primary"
              loading={addSubmitting}
              disabled={selectedStudentIds.length === 0}
              onClick={() => void submitAddStudents()}
            >
              Добавить ({selectedStudentIds.length})
            </Button>
          </>
        )}
      >
        <DashboardFilterToolbar
          className="admin-entity-detail__filter-toolbar"
          searchValue={addSearch}
          onSearchChange={setAddSearch}
          searchPlaceholder="Поиск по ФИО, логину или email..."
          onReset={resetAddFilters}
          resetDisabled={addFiltersResetDisabled}
          popoverAlign="end"
          popoverAriaLabel="Фильтры студентов"
          searchDisabled={addCandidatesLoading}
          disabled={addCandidatesLoading}
        >
          <div className="filter-popover__section">
            <label className="filter-popover__label" htmlFor="add-student-group-filter">
              Группа
            </label>
            <select
              id="add-student-group-filter"
              className="filter-popover__select"
              value={addGroupFilter}
              onChange={(event) => setAddGroupFilter(event.target.value)}
            >
              <option value="">Все группы</option>
              <option value="none">Без группы</option>
              {addFilterGroups.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </DashboardFilterToolbar>
        {addCandidatesLoading ? (
          <LoadingState message="Загрузка студентов..." />
        ) : addCandidates.length === 0 ? (
          <EmptyState title="Студенты не найдены" message="Измените запрос или создайте нового студента в разделе пользователей." />
        ) : (
          <div className="admin-entity-detail__picker-list">
            {addCandidates.map((student) => (
              <label key={student.id} className="admin-checkbox admin-entity-detail__picker-item">
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(student.id)}
                  onChange={() => toggleAddStudent(student.id)}
                />
                <span>
                  {shortName(student.lastName, student.firstName, student.middleName)}
                  {' · '}
                  {student.studentGroup?.name || 'Без группы'}
                </span>
              </label>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={transferModalOpen}
        onClose={() => !transferSubmitting && setTransferModalOpen(false)}
        title="Перевести студента"
        subtitle={transferStudent
          ? shortName(transferStudent.lastName, transferStudent.firstName, transferStudent.middleName)
          : ''}
        size="small"
        closeDisabled={transferSubmitting}
        footer={(
          <>
            <Button
              variant="primary"
              loading={transferSubmitting}
              disabled={!transferTargetGroupId}
              onClick={() => void submitTransferStudent()}
            >
              Перевести
            </Button>
          </>
        )}
      >
        {transferGroupsLoading ? (
          <LoadingState message="Загрузка групп..." />
        ) : (
          <label className="admin-entity-detail__modal-field">
            Целевая группа
            <select
              value={transferTargetGroupId}
              onChange={(event) => setTransferTargetGroupId(event.target.value)}
            >
              <option value="">Выберите группу</option>
              {transferGroups.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                  {item.status !== 'active' ? ' (закрыта)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </Modal>

      <ConfirmModal
        isOpen={showReopenConfirm}
        onClose={() => !reopenSubmitting && setShowReopenConfirm(false)}
        onConfirm={reopenGroup}
        title={group ? `Открыть группу ${group.name}?` : 'Открыть группу?'}
        message={
          (group?.studentsCount ?? 0) < 1
            ? 'В группе нет студентов — открыть её нельзя. Добавьте студентов и попробуйте снова.'
            : 'Группа снова станет активной. После открытия проверьте назначения преподавателей.'
        }
        confirmText="Открыть"
        loading={reopenSubmitting}
      />

      <ConfirmModal
        isOpen={Boolean(removeStudent)}
        onClose={() => !removeSubmitting && setRemoveStudent(null)}
        onConfirm={submitRemoveStudent}
        title="Исключить студента из группы?"
        message={removeStudent
          ? `${shortName(removeStudent.lastName, removeStudent.firstName, removeStudent.middleName)} будет откреплён от группы ${group.name}. Студент останется в системе без группы.`
          : ''}
        confirmText="Исключить"
        danger
        loading={removeSubmitting}
      />
    </div>
  );
};

export default AdminGroupDetail;
