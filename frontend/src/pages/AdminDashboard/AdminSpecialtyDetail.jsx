import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/adminApiErrors';
import Button from '../../components/UI/Button/Button';
import ConfirmModal from '../../components/UI/Modal/ConfirmModal';
import EmptyState from '../../components/UI/EmptyState/EmptyState';
import EntityCard from '../../components/UI/EntityCard/EntityCard';
import ErrorBanner from '../../components/UI/ErrorBanner/ErrorBanner';
import LoadingState from '../../components/UI/LoadingState/LoadingState';
import ModalSection from '../../components/UI/Modal/ModalSection';
import StatusBadge from '../../components/UI/StatusBadge/StatusBadge';
import SearchableSelect from '../../components/UI/SearchableSelect/SearchableSelect';
import { toSubjectSelectOptions } from '../../utils/selectOptions';
import DashboardFilterToolbar from '../../components/Shared/DashboardFilterToolbar';
import {
  buildAdminGroupsHref,
  openAdminSubject,
} from '../../utils/adminEntityLinks';
import './AdminEntityDetail.scss';

const contentTabs = [
  { id: 'overview', label: 'Обзор' },
  { id: 'program', label: 'Программа' },
  { id: 'history', label: 'История' },
  { id: 'groups', label: 'Группы' },
];

const emptyForm = {
  code: '',
  name: '',
  studyYears: 4,
  status: 'active',
};

const resolveSubjectId = (item) => {
  const id = item?.subjectId ?? item?.subject?.id;
  return id ? String(id) : '';
};

const mapProgramSubjectToItem = (item) => ({
  id: item.id,
  course: item.course || 1,
  subjectId: resolveSubjectId(item),
  subjectName: item.subject?.name || '',
  subjectCode: item.subject?.code || '',
  position: item.position || 0,
  note: item.note || '',
});

const mapSnapshotItemToView = (item) => ({
  id: item.id,
  course: item.course || 1,
  note: item.note || '',
  subject: item.subject,
});

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

const pluralGroups = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'группа';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'группы';
  return 'групп';
};

const pluralCourses = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'курс';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'курса';
  return 'курсов';
};

const pluralStudents = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'студент';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'студента';
  return 'студентов';
};

const pluralVersions = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'версия';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'версии';
  return 'версий';
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatPeriod = (from, to) => `С ${formatDate(from)} по ${formatDate(to)}`;

const groupStatusPresentation = (group) => {
  if (group.status === 'graduated') {
    return { label: 'Выпущена', tone: 'neutral' };
  }
  if (group.status === 'active') {
    return { label: 'Активна', tone: 'success' };
  }
  return { label: 'Закрыта', tone: 'neutral' };
};

const formatStudyYears = (group) => {
  const from = group.admissionYear;
  const to = group.graduationYear;
  if (from && to) return `${from}–${to}`;
  if (from && group.studyYears) return `${from}–${from + group.studyYears}`;
  if (from) return String(from);
  return '—';
};

const formatCourseLabel = (group, specialtyStudyYears) => {
  const course = group.currentCourse;
  if (!course) return '—';
  const total = group.studyYears || specialtyStudyYears;
  if (total) return `${course} из ${total}`;
  return `${course} курс`;
};

const AdminSpecialtyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showSuccess, showError } = useNotification();

  const tabParam = searchParams.get('tab');
  const normalizedTab = tabParam === 'archive' ? 'history' : tabParam;
  const activeTab = contentTabs.some((tab) => tab.id === normalizedTab) ? normalizedTab : 'overview';
  const editOpen = searchParams.get('edit') === '1';

  useEffect(() => {
    if (tabParam !== 'edit') return;
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    next.set('edit', '1');
    setSearchParams(next, { replace: true });
  }, [tabParam, searchParams, setSearchParams]);

  const [specialty, setSpecialty] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [programSaving, setProgramSaving] = useState(false);
  const [programEditing, setProgramEditing] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [programCourse, setProgramCourse] = useState('');
  const [programSearch, setProgramSearch] = useState('');
  const [expandedProgramCourses, setExpandedProgramCourses] = useState(() => new Set());
  const [expandedHistorySnapshots, setExpandedHistorySnapshots] = useState(() => new Set());
  const [expandedHistoryCourses, setExpandedHistoryCourses] = useState(() => new Map());
  const [form, setForm] = useState(emptyForm);
  const [programItems, setProgramItems] = useState([]);

  const canSaveSpecialty = useMemo(
    () => Boolean(form.code.trim()) && Boolean(form.name.trim()),
    [form.code, form.name],
  );

  const loadSpecialty = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/admin/specialties/${id}`);
      setSpecialty(data?.specialty || null);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Не удалось загрузить специальность'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSpecialty();
  }, [loadSpecialty]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/admin/subjects', { params: { per_page: 100, sort: 'name_asc', status: 'active' } });
        setSubjects(Array.isArray(data?.data) ? data.data : []);
      } catch {
        setSubjects([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!specialty) return;
    setForm({
      code: specialty.code || '',
      name: specialty.name || '',
      studyYears: specialty.studyYears || 4,
      status: specialty.status || 'active',
    });
  }, [specialty]);

  const programSubjects = useMemo(
    () => (Array.isArray(specialty?.programSubjects) ? specialty.programSubjects : []),
    [specialty?.programSubjects],
  );

  const programHistory = useMemo(
    () => (Array.isArray(specialty?.programSnapshots) ? specialty.programSnapshots : []),
    [specialty?.programSnapshots],
  );

  const resetProgramItems = useCallback(() => {
    setProgramItems(programSubjects.map(mapProgramSubjectToItem));
  }, [programSubjects]);

  useEffect(() => {
    if (!specialty || programEditing) return;
    resetProgramItems();
  }, [specialty, programEditing, resetProgramItems]);

  useEffect(() => {
    if (activeTab !== 'program' && programEditing) {
      setProgramEditing(false);
      resetProgramItems();
    }
  }, [activeTab, programEditing, resetProgramItems]);

  const subjectCatalog = useMemo(() => {
    const byId = new Map(subjects.map((subject) => [Number(subject.id), subject]));

    programSubjects.forEach((row) => {
      const subjectId = Number(resolveSubjectId(row));
      if (!subjectId) return;

      if (!byId.has(subjectId) && row.subject) {
        byId.set(subjectId, row.subject);
      } else if (!byId.has(subjectId) && row.subjectName) {
        byId.set(subjectId, {
          id: subjectId,
          name: row.subjectName,
          code: row.subjectCode || '',
        });
      }
    });

    return Array.from(byId.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
  }, [programSubjects, subjects]);

  const subjectOptionsForRow = (item, rowIndex) => {
    const course = Number(item.course);
    const currentSubjectId = Number(item.subjectId);
    const usedSubjectIds = new Set(
      programItems
        .filter((row, idx) => Number(row.course) === course && idx !== rowIndex && row.subjectId)
        .map((row) => Number(row.subjectId)),
    );

    const available = subjectCatalog.filter((subject) => {
      const id = Number(subject.id);
      if (currentSubjectId === id) return true;
      return !usedSubjectIds.has(id);
    });

    if (
      currentSubjectId
      && !available.some((subject) => Number(subject.id) === currentSubjectId)
      && item.subjectName
    ) {
      available.unshift({
        id: currentSubjectId,
        name: item.subjectName,
        code: item.subjectCode || '',
      });
    }

    return available;
  };

  const isActiveCatalogSubject = (subjectId) => {
    const subjectNumericId = Number(subjectId);
    if (!subjectNumericId) return false;
    return subjectCatalog.some((subject) => Number(subject.id) === subjectNumericId);
  };

  const groups = useMemo(
    () => (Array.isArray(specialty?.groups) ? specialty.groups : []),
    [specialty?.groups],
  );

  const courses = useMemo(() => {
    const maxCourse = Math.max(
      Number(specialty?.studyYears || form.studyYears || 1),
      ...programSubjects.map((item) => Number(item.course || 1)),
      ...programItems.map((item) => Number(item.course || 1)),
    );
    return Array.from({ length: maxCourse }, (_, index) => index + 1);
  }, [form.studyYears, programItems, programSubjects, specialty?.studyYears]);

  const filterProgramItems = useCallback((items) => {
    const q = programSearch.trim().toLowerCase();
    return items.filter((item) => {
      if (programCourse && Number(item.course) !== Number(programCourse)) return false;
      if (q && !String(item.subject?.name || item.subjectName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [programCourse, programSearch]);

  const filteredCurrentProgram = useMemo(
    () => filterProgramItems(programSubjects),
    [filterProgramItems, programSubjects],
  );

  const groupsSummary = useMemo(() => ({
    groups: groups.length,
    students: groups.reduce((sum, group) => sum + (group.studentsCount ?? 0), 0),
    active: groups.filter((group) => group.status === 'active').length,
  }), [groups]);

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
    setProgramSearch('');
  };

  const programFiltersResetDisabled = !programCourse && !programSearch.trim();

  useEffect(() => {
    if (programCourse && !programEditing) {
      setExpandedProgramCourses(new Set([Number(programCourse)]));
    }
  }, [programCourse, programEditing]);

  const toggleProgramCourse = (course) => {
    setExpandedProgramCourses((prev) => {
      const next = new Set(prev);
      if (next.has(course)) next.delete(course);
      else next.add(course);
      return next;
    });
  };

  const toggleHistorySnapshot = (snapshotId) => {
    setExpandedHistorySnapshots((prev) => {
      const next = new Set(prev);
      if (next.has(snapshotId)) next.delete(snapshotId);
      else next.add(snapshotId);
      return next;
    });
  };

  const toggleHistoryCourse = (snapshotId, course) => {
    setExpandedHistoryCourses((prev) => {
      const next = new Map(prev);
      const courses = new Set(next.get(snapshotId) || []);
      if (courses.has(course)) courses.delete(course);
      else courses.add(course);
      next.set(snapshotId, courses);
      return next;
    });
  };

  const startProgramEdit = () => {
    resetProgramItems();
    setExpandedProgramCourses(new Set(courses));
    setProgramEditing(true);
  };

  const cancelProgramEdit = () => {
    setProgramEditing(false);
    resetProgramItems();
  };

  const addProgramItem = (course) => {
    setProgramItems((prev) => [
      ...prev,
      {
        course,
        subjectId: '',
        subjectName: '',
        subjectCode: '',
        position: prev.filter((item) => Number(item.course) === Number(course)).length,
        note: '',
      },
    ]);
    setExpandedProgramCourses((prev) => new Set(prev).add(Number(course)));
  };

  const updateProgramItem = (index, patch) => {
    setProgramItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const removeProgramItem = (index) => {
    setProgramItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const validateProgramItems = (items) => {
    const filled = items.filter((item) => item.subjectId);

    const emptyRow = items.find((item) => !item.subjectId);
    if (emptyRow) {
      showError('Выберите дисциплину для каждой строки или удалите пустую');
      return false;
    }

    const invalidItem = filled.find((item) => !isActiveCatalogSubject(item.subjectId));
    if (invalidItem) {
      showError('В программу можно добавлять только активные дисциплины из справочника');
      return false;
    }

    const pairKey = (item) => `${Number(item.course)}:${Number(item.subjectId)}`;
    const pairs = filled.map(pairKey);
    if (pairs.length !== new Set(pairs).size) {
      showError('На одном курсе не может быть две одинаковые дисциплины');
      return false;
    }

    return true;
  };

  const saveProgram = async () => {
    if (!specialty) return;
    if (!validateProgramItems(programItems)) return;

    setProgramSaving(true);
    try {
      const items = programItems.map((item, index) => ({
        subjectId: Number(item.subjectId),
        course: Number(item.course),
        position: Number(item.position ?? index),
        note: item.note || null,
      }));

      const { data } = await api.put(`/admin/specialties/${specialty.id}/program`, { items });
      setSpecialty(data?.specialty || specialty);
      setProgramEditing(false);
      showSuccess('Программа сохранена');
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось сохранить программу'));
    } finally {
      setProgramSaving(false);
    }
  };

  const saveSpecialty = async () => {
    if (!specialty) return;
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      studyYears: Number(form.studyYears),
      status: form.status,
    };
    if (!payload.code || !payload.name) {
      showError('Заполните код и название специальности');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/admin/specialties/${specialty.id}`, payload);
      showSuccess('Данные специальности сохранены');
      await loadSpecialty();
      closeEdit();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось сохранить специальность'));
    } finally {
      setSaving(false);
    }
  };

  const archiveSpecialty = async () => {
    if (!specialty) return;
    setArchiveSubmitting(true);
    try {
      await api.delete(`/admin/specialties/${specialty.id}`);
      showSuccess('Специальность архивирована');
      setShowArchiveConfirm(false);
      await loadSpecialty();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось архивировать специальность'));
      throw e;
    } finally {
      setArchiveSubmitting(false);
    }
  };

  const renderProgramNotice = () => (
    <div className="admin-entity-detail__program-notice">
      <strong>Шаблон программы</strong>
      <p>
        Здесь показана актуальная программа после последнего сохранения.
        {groups.length > 0
          ? ` Она используется для новых групп; уже созданные (${groups.length}) не меняются автоматически.`
          : ' При создании группы дисциплины копируются из этой программы.'}
      </p>
    </div>
  );

  const renderProgramList = (items, emptyTitle, {
    interactive = true,
    expandedCourses = expandedProgramCourses,
    onToggleCourse = toggleProgramCourse,
  } = {}) => {
    const sections = groupCurriculumByCourse(items);

    if (items.length === 0) {
      return (
        <EmptyState title={emptyTitle} message="Измените фильтры или проверьте программу обучения." />
      );
    }

    return (
      <div className="admin-entity-detail__program-accordion">
        {sections.map(({ course, items: courseItems }) => {
          const isOpen = expandedCourses.has(course);
          return (
            <div
              key={course}
              className={`admin-entity-detail__program-accordion-item${isOpen ? ' is-open' : ''}`}
            >
              <button
                type="button"
                className="admin-entity-detail__program-accordion-trigger"
                aria-expanded={isOpen}
                onClick={() => onToggleCourse(course)}
              >
                <span className="admin-entity-detail__program-accordion-title">{course} курс</span>
                <span className="admin-entity-detail__program-accordion-meta">
                  {courseItems.length} {pluralDisciplines(courseItems.length)}
                </span>
              </button>
              {isOpen && (
                <div className="admin-entity-detail__program-accordion-panel">
                  <div className="admin-entity-detail__program-discipline-list">
                    {courseItems.map((item) => {
                      const subjectId = item.subject?.id;
                      const clickable = interactive && subjectId;

                      return (
                        <article
                          key={item.id || `${course}-${subjectId}`}
                          className={`admin-entity-detail__program-discipline${clickable ? ' admin-entity-detail__program-discipline--clickable' : ''}`}
                          role={clickable ? 'button' : undefined}
                          tabIndex={clickable ? 0 : undefined}
                          onClick={clickable ? () => openAdminSubject(navigate, subjectId) : undefined}
                          onKeyDown={clickable ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openAdminSubject(navigate, subjectId);
                            }
                          } : undefined}
                        >
                          <div className="admin-entity-detail__program-discipline-main">
                            <strong>{item.subject?.name || item.subjectName || '—'}</strong>
                            <span>{item.subject?.code || item.subjectCode || '—'}</span>
                          </div>
                          {item.note ? (
                            <p className="admin-entity-detail__program-discipline-note">{item.note}</p>
                          ) : null}
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
    );
  };

  const renderProgramEditor = () => (
    <div className="admin-entity-detail__edit-program">
      {courses.map((course) => {
        const courseRows = programItems
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => Number(item.course) === Number(course));
        const isOpen = expandedProgramCourses.has(course);

        return (
          <div
            key={course}
            className={`admin-entity-detail__program-accordion-item admin-entity-detail__program-accordion-item--edit${isOpen ? ' is-open' : ''}`}
          >
            <div className="admin-entity-detail__program-accordion-head">
              <button
                type="button"
                className="admin-entity-detail__program-accordion-trigger"
                aria-expanded={isOpen}
                onClick={() => toggleProgramCourse(course)}
              >
                <span className="admin-entity-detail__program-accordion-title">{course} курс</span>
                <span className="admin-entity-detail__program-accordion-meta">
                  {courseRows.length} {pluralDisciplines(courseRows.length)}
                </span>
              </button>
              {isOpen && (
                <Button type="button" size="small" variant="primary" onClick={() => addProgramItem(course)}>
                  Добавить
                </Button>
              )}
            </div>
            {isOpen && (
              <div className="admin-entity-detail__program-accordion-panel">
                {courseRows.length === 0 && (
                  <p className="admin-entity-detail__muted">Дисциплины не добавлены</p>
                )}
                {courseRows.length > 0 && (
                  <div className="admin-entity-detail__program-edit-table">
                    <div className="admin-entity-detail__program-edit-head" aria-hidden="true">
                      <span>Дисциплина</span>
                      <span>Комментарий</span>
                      <span />
                    </div>
                    {courseRows.map(({ item, index }) => (
                      <div key={item.id || `${course}-${index}`} className="admin-entity-detail__program-row">
                        <SearchableSelect
                          value={item.subjectId}
                          onChange={(subjectId) => {
                            const subject = subjectCatalog.find((entry) => String(entry.id) === subjectId)
                              || subjectOptionsForRow(item, index).find((entry) => String(entry.id) === subjectId);
                            updateProgramItem(index, {
                              subjectId,
                              subjectName: subject?.name || '',
                              subjectCode: subject?.code || '',
                            });
                          }}
                          options={toSubjectSelectOptions(subjectOptionsForRow(item, index))}
                          placeholder="Выберите дисциплину"
                          searchPlaceholder="Найти дисциплину…"
                          emptyMessage="На этом курсе все дисциплины уже добавлены"
                          ariaLabel="Дисциплина"
                        />
                        <input
                          aria-label="Комментарий"
                          value={item.note}
                          placeholder="Комментарий"
                          onChange={(event) => updateProgramItem(index, { note: event.target.value })}
                        />
                        <button
                          type="button"
                          className="admin-entity-detail__program-remove"
                          aria-label="Убрать дисциплину"
                          title="Убрать"
                          onClick={() => removeProgramItem(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="admin-entity-detail__program-edit-actions">
        <Button type="button" variant="secondary" disabled={programSaving} onClick={cancelProgramEdit}>
          Отмена
        </Button>
        <Button type="button" variant="primary" loading={programSaving} onClick={() => void saveProgram()}>
          Сохранить программу
        </Button>
      </div>
    </div>
  );

  const renderHistory = () => {
    if (programHistory.length === 0) {
      return (
        <EmptyState
          title="История пока пуста"
          message="После первого изменения программы здесь появятся предыдущие версии с датами действия."
        />
      );
    }

    return (
      <div className="admin-entity-detail__history-list">
        {programHistory.map((snapshot) => {
          const snapshotItems = Array.isArray(snapshot.items)
            ? filterProgramItems(snapshot.items.map(mapSnapshotItemToView))
            : [];
          const isOpen = expandedHistorySnapshots.has(snapshot.id);
          const totalItems = Array.isArray(snapshot.items) ? snapshot.items.length : 0;

          return (
            <section
              key={snapshot.id}
              className={`admin-entity-detail__history-version${isOpen ? ' is-open' : ''}`}
            >
              <button
                type="button"
                className="admin-entity-detail__history-version-trigger"
                aria-expanded={isOpen}
                onClick={() => toggleHistorySnapshot(snapshot.id)}
              >
                <div>
                  <h3>{formatPeriod(snapshot.effectiveFrom, snapshot.effectiveTo)}</h3>
                  <p>
                    {totalItems} {pluralDisciplines(totalItems)}
                    {groupCurriculumByCourse(snapshot.items || []).length > 0 && (
                      <> · {groupCurriculumByCourse(snapshot.items || []).length} {pluralCourses(groupCurriculumByCourse(snapshot.items || []).length)}</>
                    )}
                  </p>
                </div>
              </button>
              {isOpen && (
                <div className="admin-entity-detail__history-version-panel">
                  {renderProgramList(snapshotItems, 'В этой версии дисциплин нет', {
                    interactive: true,
                    expandedCourses: expandedHistoryCourses.get(snapshot.id) || new Set(),
                    onToggleCourse: (course) => toggleHistoryCourse(snapshot.id, course),
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <LoadingState message="Загрузка специальности..." />;
  }

  if (error || !specialty) {
    return (
      <ErrorBanner
        title="Не удалось открыть специальность"
        message={error || 'Специальность не найдена'}
        actionLabel="К списку специальностей"
        onAction={() => navigate('/admin/specialties')}
      />
    );
  }

  return (
    <div className={`admin-entity-detail${editOpen ? ' admin-entity-detail--edit-open' : ''}`}>
      <div className="admin-entity-detail__topbar">
        <Button type="button" variant="outline" onClick={() => navigate('/admin/specialties')}>
          Назад к специальностям
        </Button>
        <div className="admin-entity-detail__actions">
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
          <p className="admin-entity-detail__eyebrow">Специальность</p>
          <h1>{specialty.name}</h1>
          <p>{specialty.code} · {specialty.studyYears} г. обучения</p>
        </div>
        <StatusBadge tone={specialty.status === 'active' ? 'success' : 'neutral'}>
          {specialty.status === 'active' ? 'Активна' : 'Архив'}
        </StatusBadge>
      </section>

      <nav className="dashboard-tabs admin-entity-detail__tabs" aria-label="Разделы специальности">
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
        <ModalSection title="Редактирование специальности">
          <p className="admin-entity-detail__muted">
            Программу обучения редактируйте на вкладке «Программа».
          </p>

          <div className="admin-entity-detail__form-grid">
            <label>
              Код
              <input
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="09.02.07"
                autoComplete="off"
              />
            </label>
            <label>
              Название
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Например: Прикладная информатика"
                autoComplete="off"
              />
            </label>
            <label>
              Срок обучения
              <input
                type="number"
                min="1"
                max="6"
                value={form.studyYears}
                onChange={(event) => setForm((prev) => ({ ...prev, studyYears: event.target.value }))}
                placeholder="4"
              />
            </label>
            <label>
              Статус
              <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="active">Активна</option>
                <option value="archived">Архив</option>
              </select>
            </label>
          </div>

          <div className="admin-entity-detail__form-actions">
            <Button
              type="button"
              variant="primary"
              loading={saving}
              disabled={saving || !canSaveSpecialty}
              onClick={() => void saveSpecialty()}
            >
              Сохранить
            </Button>
          </div>

          {specialty.status === 'active' && (
            <div className="admin-entity-detail__danger-zone">
              <h3>Архивирование специальности</h3>
              <p>После архивации создание новых групп по этой специальности станет недоступно.</p>
              <div className="admin-entity-detail__danger-row">
                <Button type="button" variant="danger" onClick={() => setShowArchiveConfirm(true)}>
                  Архивировать специальность
                </Button>
              </div>
            </div>
          )}
        </ModalSection>
      )}

      {!editOpen && activeTab === 'program' && (
        <ModalSection title="Текущая программа" variant="soft">
          {renderProgramNotice()}

          {!programEditing && (
            <>
              <div className="admin-entity-detail__program-meta">
                <div className="admin-entity-detail__program-meta-card">
                  <span>Действует с</span>
                  <strong>{formatDate(specialty.programUpdatedAt || specialty.createdAt)}</strong>
                </div>
                <div className="admin-entity-detail__program-meta-card">
                  <span>Дисциплин</span>
                  <strong>{programSubjects.length}</strong>
                </div>
                <div className="admin-entity-detail__program-meta-card">
                  <span>Курсов</span>
                  <strong>{groupCurriculumByCourse(programSubjects).length}</strong>
                </div>
              </div>

              <DashboardFilterToolbar
                className="admin-entity-detail__filter-toolbar"
                searchValue={programSearch}
                onSearchChange={setProgramSearch}
                searchPlaceholder="Поиск по дисциплине…"
                onReset={resetProgramFilters}
                resetDisabled={programFiltersResetDisabled}
                popoverAlign="end"
                popoverAriaLabel="Фильтры программы специальности"
              >
                <div className="filter-popover__section">
                  <label className="filter-popover__label" htmlFor="specialty-program-course">
                    Курс
                  </label>
                  <select
                    id="specialty-program-course"
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
              </DashboardFilterToolbar>

              <div className="admin-entity-detail__program-toolbar">
                <Button type="button" variant="outline" onClick={() => navigate('/admin/subjects')}>
                  Справочник дисциплин
                </Button>
                <Button type="button" variant="primary" onClick={startProgramEdit}>
                  Редактировать программу
                </Button>
              </div>

              {renderProgramList(filteredCurrentProgram, 'Дисциплин пока нет')}
            </>
          )}

          {programEditing && renderProgramEditor()}
        </ModalSection>
      )}

      {!editOpen && activeTab === 'history' && (
        <ModalSection title="История программы" variant="soft">
          <div className="admin-entity-detail__program-notice admin-entity-detail__program-notice--neutral">
            <strong>Как читать историю</strong>
            <p>
              Каждый блок — программа, которая действовала в указанный период.
              Текущая актуальная версия всегда на вкладке «Программа».
            </p>
          </div>

          {programHistory.length > 0 && (
            <div className="admin-entity-detail__loads-summary">
              <span className="admin-entity-detail__teaching-stat-chip">
                {programHistory.length} {pluralVersions(programHistory.length)} в истории
              </span>
            </div>
          )}

          {renderHistory()}
        </ModalSection>
      )}

      {!editOpen && activeTab === 'overview' && (
        <div className="admin-entity-detail__stack">
          <ModalSection title="Основная информация">
            <div className="admin-entity-detail__info-grid">
              <div className="admin-entity-detail__info-card">
                <span>Код</span>
                <strong>{specialty.code}</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Срок обучения</span>
                <strong>{specialty.studyYears} г.</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Дисциплин сейчас</span>
                <strong>{programSubjects.length}</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Версий в истории</span>
                <strong>{programHistory.length}</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Групп</span>
                <strong>{groups.length}</strong>
              </div>
              <div className="admin-entity-detail__info-card">
                <span>Обновлена</span>
                <strong>{formatDate(specialty.programUpdatedAt || specialty.createdAt)}</strong>
              </div>
            </div>
          </ModalSection>
          <ModalSection title="Быстрые ссылки" variant="soft">
            <div className="admin-entity-detail__link-row">
              <Button type="button" variant="outline" onClick={() => setTab('program')}>Текущая программа</Button>
              <Button type="button" variant="outline" onClick={() => setTab('history')}>История программы</Button>
              <Button type="button" variant="outline" onClick={() => setTab('groups')}>Группы специальности</Button>
              <Button type="button" variant="outline" onClick={() => navigate(buildAdminGroupsHref({ specialtyId: specialty.id }))}>
                Все группы ({groups.length})
              </Button>
            </div>
          </ModalSection>
        </div>
      )}

      {!editOpen && activeTab === 'groups' && (
        <ModalSection title={`Группы специальности (${groups.length})`}>
          <div className="admin-entity-detail__form-actions admin-entity-detail__form-actions--top">
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate('/admin/groups', { state: { openCreateGroup: true } })}
            >
              Создать группу
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(buildAdminGroupsHref({ specialtyId: specialty.id }))}
            >
              Все группы
            </Button>
          </div>

          {groups.length > 0 && (
            <div className="admin-entity-detail__loads-summary">
              <span className="admin-entity-detail__teaching-stat-chip">
                {groupsSummary.groups} {pluralGroups(groupsSummary.groups)}
              </span>
              <span className="admin-entity-detail__teaching-stat-chip">
                {groupsSummary.students} {pluralStudents(groupsSummary.students)}
              </span>
              {groupsSummary.active > 0 && (
                <span className="admin-entity-detail__teaching-stat-chip admin-entity-detail__teaching-stat-chip--active">
                  {groupsSummary.active} активных
                </span>
              )}
            </div>
          )}

          {groups.length === 0 ? (
            <EmptyState title="Групп пока нет" message="Создайте группы на базе этой специальности." />
          ) : (
            <div className="admin-entity-detail__linked-groups-grid">
              {groups.map((group) => {
                const stud = group.studentsCount ?? 0;
                const teach = group.teachersCount ?? 0;
                const st = groupStatusPresentation(group);

                return (
                  <EntityCard
                    key={group.id}
                    className="admin-entity-detail__linked-group-card"
                    padding="small"
                    role="button"
                    tabIndex={0}
                    interactive
                    onClick={() => navigate(`/admin/groups/${group.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/admin/groups/${group.id}`);
                      }
                    }}
                  >
                    <div className="admin-entity-detail__linked-group-card-body">
                      <div className="admin-entity-detail__linked-group-card-top">
                        <div className="admin-entity-detail__linked-group-card-title">
                          <div className="admin-entity-detail__linked-group-card-name">{group.name}</div>
                        </div>
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                      </div>

                      <div className="admin-entity-detail__linked-group-card-fields">
                        <div className="admin-entity-detail__linked-group-card-row">
                          <span className="admin-entity-detail__linked-group-card-label">Курс</span>
                          <span className="admin-entity-detail__linked-group-card-value">
                            {formatCourseLabel(group, specialty.studyYears)}
                          </span>
                        </div>
                        <div className="admin-entity-detail__linked-group-card-row">
                          <span className="admin-entity-detail__linked-group-card-label">Годы</span>
                          <span className="admin-entity-detail__linked-group-card-value">
                            {formatStudyYears(group)}
                          </span>
                        </div>
                        <div className="admin-entity-detail__linked-group-card-row">
                          <span className="admin-entity-detail__linked-group-card-label">Студентов</span>
                          <span className="admin-entity-detail__linked-group-card-value">{stud}</span>
                        </div>
                        <div className="admin-entity-detail__linked-group-card-row">
                          <span className="admin-entity-detail__linked-group-card-label">Преподавателей</span>
                          <span className="admin-entity-detail__linked-group-card-value">{teach}</span>
                        </div>
                      </div>
                    </div>
                  </EntityCard>
                );
              })}
            </div>
          )}
        </ModalSection>
      )}

      <ConfirmModal
        isOpen={showArchiveConfirm}
        onClose={() => !archiveSubmitting && setShowArchiveConfirm(false)}
        onConfirm={archiveSpecialty}
        title="Архивировать специальность?"
        message={specialty
          ? `Специальность «${specialty.name}» будет переведена в архив. Создание новых групп по ней станет недоступно.`
          : 'Специальность будет переведена в архив.'}
        confirmText="Архивировать"
        danger
        loading={archiveSubmitting}
      />
    </div>
  );
};

export default AdminSpecialtyDetail;
