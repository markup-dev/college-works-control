import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import Button from '../../UI/Button/Button';
import { formatDate } from '../../../utils';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

const BROADCAST_DEFAULT_TEXT =
  'Здравствуйте! Напоминаю о заданиях, которые еще ожидают сдачи. Пожалуйста, проверьте сроки и отправьте работы на проверку. Если нужна помощь — напишите мне в этом чате.';

const BROADCAST_MAX_RECIPIENTS = 50;

const getErrorMessage = (err, fallback) => {
  const msg = err?.response?.data?.message;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
};

const PERIOD_OPTIONS = [
  { value: '0', label: 'Все время' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'not_submitted', label: 'Не сдано' },
  { value: 'submitted', label: 'На проверке' },
  { value: 'returned', label: 'На доработке' },
  { value: 'graded', label: 'Проверено' },
];

const statusLabel = (status) => {
  switch (status) {
    case 'not_submitted':
      return 'Не сдано';
    case 'submitted':
      return 'На проверке';
    case 'returned':
      return 'На доработке';
    case 'graded':
      return 'Проверено';
    default:
      return '—';
  }
};

const buildStudentReminderText = ({ fullName, groupName, debtsCount }) => {
  const debtorNote = Number(debtsCount) > 0
    ? `Сейчас у вас ${debtsCount} ${debtsCount === 1 ? 'долг' : 'долга'} по заданиям.`
    : 'Проверьте, пожалуйста, актуальные статусы заданий в личном кабинете.';

  return [
    `Здравствуйте, ${fullName || 'студент'}!`,
    groupName ? `Группа: ${groupName}.` : '',
    debtorNote,
    'Пожалуйста, отправьте работы на проверку в ближайшее время.',
    'Если нужна помощь или уточнение по заданию — напишите мне в ответ.',
  ].filter(Boolean).join('\n');
};

const INDENT_DEBT_SUBJECT = '      ';
const INDENT_DEBT_ASSIGNMENT = '            ';

const buildNestedDebtListText = ({ groupName = '', entries }) => {
  const validEntries = (entries || []).filter((e) => (e.items || []).length > 0);
  if (!validEntries.length) {
    return '';
  }
  const lines = [];
  if (groupName) {
    lines.push(`Группа: ${groupName}`);
    lines.push('');
  }
  validEntries.forEach((entry) => {
    lines.push(entry.fullName || 'Без имени');
    const bySubject = new Map();
    (entry.items || []).forEach((it) => {
      const subject = it.subjectName || 'Без предмета';
      if (!bySubject.has(subject)) {
        bySubject.set(subject, []);
      }
      bySubject.get(subject).push(it.assignmentTitle || 'Без названия');
    });
    const subjects = [...bySubject.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
    subjects.forEach((subject) => {
      lines.push(`${INDENT_DEBT_SUBJECT}${subject}`);
      const titles = [...new Set(bySubject.get(subject))].sort((a, b) => a.localeCompare(b, 'ru'));
      titles.forEach((title) => {
        lines.push(`${INDENT_DEBT_ASSIGNMENT}${title}`);
      });
    });
    lines.push('');
  });
  return lines.join('\n').trimEnd();
};

const sanitizeExportFilePart = (value) => {
  const raw = typeof value === 'string' ? value : '';
  const cleaned = raw.replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, '_').trim();
  return cleaned.slice(0, 96) || 'eksport';
};

const getDeadlineTone = (deadline) => {
  if (!deadline) {
    return 'normal';
  }
  const target = new Date(deadline);
  if (Number.isNaN(target.getTime())) {
    return 'normal';
  }
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDeadline = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.floor((startDeadline.getTime() - startToday.getTime()) / 86400000);

  if (diffDays < 0) {
    return 'overdue';
  }
  if (diffDays <= 3) {
    return 'soon';
  }
  return 'normal';
};

const TeacherStudentsSection = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [view, setView] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [groupData, setGroupData] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodDays, setPeriodDays] = useState('0');
  const [debtOnly, setDebtOnly] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastBody, setBroadcastBody] = useState(BROADCAST_DEFAULT_TEXT);
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPopoverRef = useRef(null);

  useBodyScrollLock(broadcastOpen);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/teacher/groups/overview');
      setGroups(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      showError(getErrorMessage(err, 'Не удалось загрузить группы'));
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadGroup = useCallback(async (groupId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/teacher/groups/${groupId}`, {
        params: {
          search: search || undefined,
          subject_id: subjectFilter !== 'all' ? Number(subjectFilter) : undefined,
          assignment_id: assignmentFilter !== 'all' ? Number(assignmentFilter) : undefined,
          debt_only: debtOnly ? 1 : 0,
        },
      });
      setGroupData(data);
    } catch (err) {
      showError(getErrorMessage(err, 'Не удалось загрузить статистику группы'));
    } finally {
      setLoading(false);
    }
  }, [search, subjectFilter, assignmentFilter, debtOnly, showError]);

  const loadStudent = useCallback(async (groupId, studentId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/teacher/groups/${groupId}/students/${studentId}`, {
        params: {
          search: search || undefined,
          subject_id: subjectFilter !== 'all' ? Number(subjectFilter) : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          debt_only: debtOnly ? 1 : 0,
          period_days: Number(periodDays) > 0 ? Number(periodDays) : undefined,
        },
      });
      setStudentData(data);
    } catch (err) {
      showError(getErrorMessage(err, 'Не удалось загрузить данные студента'));
    } finally {
      setLoading(false);
    }
  }, [search, subjectFilter, statusFilter, debtOnly, periodDays, showError]);

  const toggleSelectId = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const currentStudents = useMemo(() => {
    if (view === 'group') {
      return Array.isArray(groupData?.students) ? groupData.students : [];
    }
    return [];
  }, [view, groupData]);

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) {
      return groups;
    }
    return groups.filter((group) => (group.name || '').toLowerCase().includes(query));
  }, [groups, groupSearch]);

  const sortedStudentAssignments = useMemo(() => {
    const rows = Array.isArray(studentData?.assignments) ? [...studentData.assignments] : [];
    rows.sort((a, b) => {
      const aDebt = a.submissionStatus === 'not_submitted' ? 1 : 0;
      const bDebt = b.submissionStatus === 'not_submitted' ? 1 : 0;
      if (aDebt !== bDebt) {
        return bDebt - aDebt;
      }
      const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
      const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
      return aDeadline - bDeadline;
    });
    return rows;
  }, [studentData]);

  const groupDebtsExportText = useMemo(() => {
    if (view !== 'group' || !groupData?.group?.name) {
      return '';
    }
    const entries = currentStudents.map((s) => ({
      fullName: s.fullName,
      items: Array.isArray(s.debtItems) ? s.debtItems : [],
    }));
    return buildNestedDebtListText({ groupName: groupData.group.name, entries });
  }, [view, groupData, currentStudents]);

  const studentDebtsExportText = useMemo(() => {
    if (view !== 'student' || !selectedStudent?.fullName) {
      return '';
    }
    const items = sortedStudentAssignments
      .filter((r) => r.submissionStatus === 'not_submitted')
      .map((r) => ({
        subjectName: r.subjectName || 'Без предмета',
        assignmentTitle: r.title || '',
      }));
    return buildNestedDebtListText({
      groupName: selectedGroup?.name || '',
      entries: [{ fullName: selectedStudent.fullName, items }],
    });
  }, [view, selectedStudent, selectedGroup?.name, sortedStudentAssignments]);

  const copyDebtsList = useCallback(async (text) => {
    if (!text || !String(text).trim()) {
      showError('Нет задолженностей для копирования');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showSuccess('Список скопирован в буфер обмена');
      return;
    } catch {
      /* fall through */
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showSuccess('Список скопирован в буфер обмена');
    } catch {
      showError('Не удалось скопировать автоматически');
    }
  }, [showError, showSuccess]);

  const downloadDebtsList = useCallback((text, fileBaseName) => {
    if (!text || !String(text).trim()) {
      showError('Нет задолженностей для сохранения');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const safe = sanitizeExportFilePart(fileBaseName);
    const filename = `dolgi_${safe}_${date}.txt`;
    const blob = new Blob([`\uFEFF${text}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showSuccess('Файл скачан');
  }, [showError, showSuccess]);

  const selectAllFiltered = () => setSelectedIds(currentStudents.map((r) => r.id));

  const selectDebtorsFiltered = () =>
    setSelectedIds(currentStudents.filter((r) => (r.debtCount || 0) > 0).map((r) => r.id));

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedIds([]);
      }
      return !prev;
    });
  };

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (broadcastOpen) {
      setBroadcastBody(BROADCAST_DEFAULT_TEXT);
    }
  }, [broadcastOpen]);

  useEffect(() => {
    if (!isFilterOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFilterOpen]);

  useEffect(() => {
    setIsFilterOpen(false);
  }, [view]);

  useEffect(() => {
    if (view === 'group' && selectedGroup?.id) {
      loadGroup(selectedGroup.id);
    }
  }, [view, selectedGroup?.id, loadGroup]);

  useEffect(() => {
    if (view === 'student' && selectedGroup?.id && selectedStudent?.id) {
      loadStudent(selectedGroup.id, selectedStudent.id);
    }
  }, [view, selectedGroup?.id, selectedStudent?.id, loadStudent]);

  const sendBroadcast = async () => {
    const text = broadcastBody.trim();
    if (!text) {
      showError('Введите текст сообщения');
      return;
    }
    const ids = [...new Set(selectedIds.map(Number))].filter((id) => id > 0);
    if (ids.length === 0) {
      showError('Выберите получателей');
      return;
    }
    if (ids.length > BROADCAST_MAX_RECIPIENTS) {
      showError(`Не более ${BROADCAST_MAX_RECIPIENTS} получателей за одну отправку`);
      return;
    }
    setBroadcastSending(true);
    try {
      const { data } = await api.post('/teacher/messages/broadcast', {
        userIds: ids,
        body: text,
      });
      const sent = data?.data?.sent ?? 0;
      const skipped = data?.data?.skipped ?? 0;
      if (skipped > 0) {
        showSuccess(`Отправлено сообщений: ${sent}. Пропущено (нет доступа к чату): ${skipped}.`);
      } else {
        showSuccess(`Сообщение отправлено ${sent} студентам.`);
      }
      setBroadcastOpen(false);
      setSelectedIds([]);
    } catch (err) {
      showError(getErrorMessage(err, 'Не удалось отправить сообщения'));
    } finally {
      setBroadcastSending(false);
    }
  };

  const openGroup = (group) => {
    setSelectedGroup(group);
    setSelectedStudent(null);
    setStudentData(null);
    setSelectedIds([]);
    setSearch('');
    setSubjectFilter('all');
    setAssignmentFilter('all');
    setStatusFilter('all');
    setDebtOnly(true);
    setPeriodDays('0');
    setView('group');
  };

  const openStudent = (student) => {
    setSelectedStudent(student);
    setSubjectFilter('all');
    setStatusFilter('all');
    setDebtOnly(true);
    setPeriodDays('0');
    setView('student');
  };

  const resetGroupFilters = () => {
    setSearch('');
    setSubjectFilter('all');
    setAssignmentFilter('all');
    setDebtOnly(true);
  };

  const resetStudentFilters = () => {
    setSubjectFilter('all');
    setStatusFilter('all');
    setPeriodDays('0');
    setDebtOnly(true);
  };

  const resetCurrentFilters = () => {
    if (view === 'student') {
      resetStudentFilters();
      return;
    }
    resetGroupFilters();
  };

  return (
    <div className="teacher-students-section">
      <div className="section-header teacher-students-section__header">
        <h2>Группы</h2>
      </div>

      {view !== 'groups' && (
        <div className="teacher-students-section__breadcrumbs">
          <button type="button" onClick={() => { setView('groups'); setSelectedGroup(null); setSelectedStudent(null); }}>
            Группы
          </button>
          {selectedGroup?.name ? (
            <>
              <span> / </span>
              <button
                type="button"
                onClick={() => {
                  setView('group');
                  setSelectedStudent(null);
                }}
              >
                {selectedGroup.name}
              </button>
            </>
          ) : null}
          {view === 'student' && selectedStudent?.fullName ? <span> / {selectedStudent.fullName}</span> : null}
        </div>
      )}

      {view === 'group' && (
        <>
          <p className="teacher-students-section__hint">
            Должники — это студенты, которые не отправили работу на проверку. Можно выбрать студентов и отправить массовое напоминание.
          </p>
          <div className="teacher-students-section__filters filters-section">
            <div className="controls-row teacher-dashboard-filter-row">
              <div className="search-box teacher-dashboard-filter-search">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Поиск по ФИО или логину…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="teacher-filter-toolbar" ref={filterPopoverRef}>
                <button
                  type="button"
                  className={`teacher-filter-trigger${isFilterOpen ? ' teacher-filter-trigger--open' : ''}`}
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  aria-expanded={isFilterOpen}
                  aria-controls="teacher-groups-filter-popover"
                >
                  Фильтр
                </button>
                {isFilterOpen && (
                  <div className="teacher-filter-popover" id="teacher-groups-filter-popover" role="dialog" aria-label="Фильтры">
                    <div className="teacher-filter-field">
                      <label className="teacher-filter-popover__label" htmlFor="teacher-groups-subject-filter">
                        Предмет
                      </label>
                      <select
                        id="teacher-groups-subject-filter"
                        className="filter-select subject-filter"
                        value={subjectFilter}
                        onChange={(e) => setSubjectFilter(e.target.value)}
                      >
                        <option value="all">Все предметы</option>
                        {(groupData?.filters?.subjects || []).map((subject) => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="teacher-filter-field">
                      <label className="teacher-filter-popover__label" htmlFor="teacher-groups-assignment-filter">
                        Задание
                      </label>
                      <select
                        id="teacher-groups-assignment-filter"
                        className="filter-select assignment-filter"
                        value={assignmentFilter}
                        onChange={(e) => setAssignmentFilter(e.target.value)}
                      >
                        <option value="all">Все задания</option>
                        {(groupData?.filters?.assignments || []).map((assignment) => (
                          <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
                        ))}
                      </select>
                    </div>
                    <label className="teacher-students-section__checkbox-filter teacher-students-section__checkbox-filter--in-popover">
                      <input type="checkbox" checked={debtOnly} onChange={(e) => setDebtOnly(e.target.checked)} />
                      Только должники
                    </label>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="teacher-dashboard-filter-reset-btn"
                onClick={resetCurrentFilters}
              >
                Сбросить фильтры
              </Button>
            </div>
          </div>
        </>
      )}

      {view === 'groups' && (
        <div className="teacher-students-section__filters filters-section">
          <div className="controls-row teacher-dashboard-filter-row">
            <div className="search-box teacher-dashboard-filter-search">
              <input
                type="search"
                className="search-input"
                placeholder="Поиск по группе…"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      )}

      {view === 'student' && (
        <>
          <div className="teacher-students-section__filters filters-section">
            <div className="controls-row teacher-dashboard-filter-row">
              <div className="search-box teacher-dashboard-filter-search">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Поиск по названию задания…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="teacher-filter-toolbar" ref={filterPopoverRef}>
                <button
                  type="button"
                  className={`teacher-filter-trigger${isFilterOpen ? ' teacher-filter-trigger--open' : ''}`}
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  aria-expanded={isFilterOpen}
                  aria-controls="teacher-student-filter-popover"
                >
                  Фильтр
                </button>
                {isFilterOpen && (
                  <div className="teacher-filter-popover" id="teacher-student-filter-popover" role="dialog" aria-label="Фильтры">
                    <div className="teacher-filter-field">
                      <label className="teacher-filter-popover__label" htmlFor="teacher-student-subject-filter">
                        Предмет
                      </label>
                      <select
                        id="teacher-student-subject-filter"
                        className="filter-select subject-filter"
                        value={subjectFilter}
                        onChange={(e) => setSubjectFilter(e.target.value)}
                      >
                        <option value="all">Все предметы</option>
                        {(studentData?.filters?.subjects || []).map((subject) => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="teacher-filter-field">
                      <label className="teacher-filter-popover__label" htmlFor="teacher-student-status-filter">
                        Статус
                      </label>
                      <select
                        id="teacher-student-status-filter"
                        className="filter-select status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="teacher-filter-field">
                      <label className="teacher-filter-popover__label" htmlFor="teacher-student-period-filter">
                        Период
                      </label>
                      <select
                        id="teacher-student-period-filter"
                        className="filter-select deadline-filter"
                        value={periodDays}
                        onChange={(e) => setPeriodDays(e.target.value)}
                      >
                        {PERIOD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="teacher-dashboard-filter-reset-btn"
                onClick={resetCurrentFilters}
              >
                Сбросить фильтры
              </Button>
            </div>
          </div>
          {selectedStudent?.id ? (
            <div className="teacher-students-section__single-action">
              <label className="teacher-students-section__checkbox-filter">
                <input type="checkbox" checked={debtOnly} onChange={(e) => setDebtOnly(e.target.checked)} />
                Только долги
              </label>
              <div className="teacher-students-section__single-action-right">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => copyDebtsList(studentDebtsExportText)}
                  disabled={!studentDebtsExportText}
                  aria-label="Скопировать список несданных заданий"
                >
                  Скопировать список
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    downloadDebtsList(
                      studentDebtsExportText,
                      [selectedGroup?.name, selectedStudent.fullName].filter(Boolean).join('_'),
                    )}
                  disabled={!studentDebtsExportText}
                  aria-label="Скачать список несданных заданий в виде текстового файла"
                >
                  Скачать .txt
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="teacher-students-section__remind-btn"
                  onClick={() => {
                    setSelectedIds([selectedStudent.id]);
                    setBroadcastBody(
                      buildStudentReminderText({
                        fullName: selectedStudent.fullName,
                        groupName: selectedGroup?.name,
                        debtsCount: studentData?.stats?.debts ?? 0,
                      })
                    );
                    setBroadcastOpen(true);
                  }}
                >
                  Напомнить студенту о долгах
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {!loading && view === 'group' && currentStudents.length > 0 ? (
        <div className="teacher-students-section__bulk-bar">
          <div className="teacher-students-section__bulk-bar-main">
            {selectionMode ? (
              <>
                <span className="teacher-students-section__bulk-count">
                  Выбрано: <strong>{selectedIds.length}</strong>
                  {selectedIds.length > BROADCAST_MAX_RECIPIENTS ? (
                    <span className="teacher-students-section__bulk-warn">
                      {' '}
                      (лишние не будут отправлены — максимум {BROADCAST_MAX_RECIPIENTS})
                    </span>
                  ) : null}
                </span>
                <Button type="button" variant="secondary" onClick={selectDebtorsFiltered}>
                  Оставить только с долгами
                </Button>
                <Button type="button" variant="secondary" onClick={selectAllFiltered}>
                  Выбрать всех
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setBroadcastOpen(true)}
                  disabled={broadcastSending || selectedIds.length === 0}
                >
                  Отправить сообщение…
                </Button>
                <Button type="button" variant="secondary" onClick={toggleSelectionMode}>
                  Отменить выбор
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={toggleSelectionMode}>
                Выбрать
              </Button>
            )}
          </div>
          <div className="teacher-students-section__bulk-bar-export">
            <Button
              type="button"
              variant="secondary"
              onClick={() => copyDebtsList(groupDebtsExportText)}
              disabled={!groupDebtsExportText}
              aria-label="Скопировать вложенный список задолженностей в буфер обмена"
            >
              Скопировать список
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadDebtsList(groupDebtsExportText, groupData?.group?.name)}
              disabled={!groupDebtsExportText}
              aria-label="Скачать список задолженностей текстовым файлом"
            >
              Скачать .txt
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="teacher-students-section__muted">Загрузка…</p>
      ) : view === 'groups' ? (
        filteredGroups.length === 0 ? (
          <div className="empty-state">
            <p>{groups.length === 0 ? 'Нет закрепленных групп' : 'Группы не найдены'}</p>
          </div>
        ) : (
          <div className="teacher-students-section__cards">
            {filteredGroups.map((group) => (
              <button key={group.id} type="button" className="teacher-students-section__card" onClick={() => openGroup(group)}>
                <div className="teacher-students-section__card-top">
                  <h3>{group.name}</h3>
                  <span className="teacher-students-section__badge">Студентов: {group.studentsCount}</span>
                </div>
                <p>Должников: <strong>{group.debtorsCount}</strong> · На проверке: <strong>{group.onReviewCount}</strong></p>
                <p>Предметов: <strong>{(group.subjects || []).length}</strong> · Заданий: <strong>{group.assignmentsCount}</strong></p>
              </button>
            ))}
          </div>
        )
      ) : view === 'group' ? (
        (groupData?.students || []).length === 0 ? (
          <div className="empty-state">
            <p>По выбранным фильтрам студентов не найдено</p>
          </div>
        ) : (
          <div className="teacher-students-section__students-list">
            {groupData.students.map((student) => (
              <div
                key={student.id}
                className={`teacher-students-section__student-row${selectionMode ? ' is-selecting' : ''}`}
                onClick={() => {
                  if (selectionMode) {
                    toggleSelectId(student.id);
                    return;
                  }
                  openStudent(student);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (selectionMode) {
                      toggleSelectId(student.id);
                      return;
                    }
                    openStudent(student);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {selectionMode ? (
                  <span
                    className="teacher-students-section__student-check"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(student.id)}
                      onChange={() => toggleSelectId(student.id)}
                      aria-label={`Выбрать ${student.fullName}`}
                    />
                  </span>
                ) : null}
                <span className="teacher-students-section__student-main">
                  <strong>{student.fullName}</strong>
                  <span>
                    {student.nearestDebtDeadline
                      ? `Ближайший дедлайн долга: ${formatDate(student.nearestDebtDeadline)}`
                      : 'Ближайший дедлайн долга: —'}
                  </span>
                </span>
                <span className="teacher-students-section__student-stats">
                  Не сдано: <strong>{student.debtCount}</strong> · На проверке: <strong>{student.onReviewCount}</strong> · На доработке: <strong>{student.returnedCount}</strong> · Проверено: <strong>{student.gradedCount}</strong>
                </span>
              </div>
            ))}
          </div>
        )
      ) : sortedStudentAssignments.length === 0 ? (
        <div className="empty-state">
          <p>Нет заданий по выбранным фильтрам</p>
        </div>
      ) : (
        <div className="teacher-students-section__assignment-list">
          {sortedStudentAssignments.map((row) => (
            <article
              key={row.assignmentId}
              className="teacher-students-section__assignment-row"
              role="button"
              tabIndex={0}
              onClick={() => {
                const params = new URLSearchParams();
                params.set('assignment', String(row.assignmentId));
                if (row.submissionId) {
                  params.set('submission', String(row.submissionId));
                }
                navigate(`/teacher?${params.toString()}`);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  const params = new URLSearchParams();
                  params.set('assignment', String(row.assignmentId));
                  if (row.submissionId) {
                    params.set('submission', String(row.submissionId));
                  }
                  navigate(`/teacher?${params.toString()}`);
                }
              }}
            >
              <div className="teacher-students-section__assignment-main">
                <p className="teacher-students-section__assignment-title">{row.title}</p>
                <p className="teacher-students-section__assignment-subject">{row.subjectName}</p>
              </div>
              <div className={`teacher-students-section__assignment-deadline is-${getDeadlineTone(row.deadline)}`}>
                {row.deadline ? formatDate(row.deadline) : 'Без дедлайна'}
              </div>
              <div className="teacher-students-section__assignment-status">
                <span className={`teacher-students-section__badge status-${row.submissionStatus}`}>{statusLabel(row.submissionStatus)}</span>
              </div>
              <div className="teacher-students-section__assignment-score">
                {row.score != null ? `${row.score} / ${row.maxScore}` : '—'}
              </div>
              <div className="teacher-students-section__assignment-submitted-at">
                {row.submittedAt ? `Сдано: ${formatDate(row.submittedAt)}` : 'Не сдавалось'}
              </div>
            </article>
          ))}
        </div>
      )}

      {broadcastOpen
        ? createPortal(
            (
              <div
                className="teacher-students-broadcast-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="teacher-broadcast-title"
                onClick={() => {
                  if (!broadcastSending) setBroadcastOpen(false);
                }}
              >
                <div
                  className="teacher-students-broadcast"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="teacher-students-broadcast__head">
                    <h2 id="teacher-broadcast-title">Сообщение выбранным студентам</h2>
                    <button
                      type="button"
                      className="teacher-students-broadcast__close"
                      disabled={broadcastSending}
                      onClick={() => setBroadcastOpen(false)}
                      aria-label="Закрыть"
                    >
                      ×
                    </button>
                  </div>
                  <p className="teacher-students-broadcast__meta">
                    Получателей в списке: {selectedIds.length} (за один раз — не больше {BROADCAST_MAX_RECIPIENTS}). Каждый
                    студент увидит текст в «Сообщениях» как обычное входящее.
                  </p>
                  <textarea
                    className="teacher-students-broadcast__textarea"
                    rows={6}
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    disabled={broadcastSending}
                  />
                  <div className="teacher-students-broadcast__actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setBroadcastOpen(false)}
                      disabled={broadcastSending}
                    >
                      Отмена
                    </Button>
                    <Button type="button" variant="primary" onClick={sendBroadcast} disabled={broadcastSending}>
                      {broadcastSending ? 'Отправка…' : 'Отправить'}
                    </Button>
                  </div>
                </div>
              </div>
            ),
            document.body,
          )
        : null}
    </div>
  );
};

export default TeacherStudentsSection;
