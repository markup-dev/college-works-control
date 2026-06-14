import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import Modal from '../../UI/Modal/Modal';
import ModalDangerZone from '../../UI/Modal/ModalDangerZone';
import ModalSection from '../../UI/Modal/ModalSection';
import TextArea from '../../UI/TextArea/TextArea';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import SearchableSelect from '../../UI/SearchableSelect/SearchableSelect';
import { toReassignTeacherSelectOptions } from '../../../utils/selectOptions';
import Pagination from '../../UI/Pagination/Pagination';
import { ADMIN_CARD_GRID_PAGE_SIZE } from '../../../config/adminPagination';
import usePaginationClamp from '../../../hooks/usePaginationClamp';
import { parsePaginationMeta } from '../../../utils/pagination';
import './AdminAssignmentManagement.scss';

const FILTER_OPTIONS_LIMIT = 20;

const SORT_OPTIONS = [
  { value: 'deadline_asc', label: 'Дедлайн (ближайшие)' },
  { value: 'deadline_desc', label: 'Дедлайн (дальние)' },
  { value: 'created_desc', label: 'Созданы (новые)' },
  { value: 'created_asc', label: 'Созданы (старые)' },
  { value: 'submissions_desc', label: 'Больше сдач' },
  { value: 'submissions_asc', label: 'Меньше сдач' },
];

const STATUS_PACK_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активно' },
  { value: 'overdue', label: 'Просрочен дедлайн' },
  { value: 'stale_review', label: 'На проверке > 3 дн.' },
  { value: 'archived', label: 'Закрыто' },
];

const SORT_VALUES = new Set(SORT_OPTIONS.map((option) => option.value));
const STATUS_PACK_VALUES = new Set(STATUS_PACK_OPTIONS.map((option) => option.value));

const parsePositiveId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
};

const getAssignmentFiltersFromSearchParams = (params) => {
  const status = params.get('status') || '';
  const filter = params.get('filter') || '';
  const sort = params.get('sort') || 'deadline_asc';

  return {
    search: params.get('search') || '',
    teacherId: parsePositiveId(params.get('teacher_id')),
    subjectId: parsePositiveId(params.get('subject_id')),
    groupId: parsePositiveId(params.get('group_id')),
    statusPack: filter === 'overdue_checks'
      ? 'stale_review'
      : STATUS_PACK_VALUES.has(status)
        ? status
        : 'all',
    sort: SORT_VALUES.has(sort) ? sort : 'deadline_asc',
  };
};

const statusBadge = (row) => {
  if (row.displayOverdue) {
    return { tone: 'danger', label: 'Просрочено' };
  }
  if (row.status === 'archived') {
    return { tone: 'neutral', label: 'Закрыто' };
  }
  return { tone: 'success', label: 'Активно' };
};

const assignmentStatusLabel = (status) => statusBadge({ status }).label;

const isNaturallyClosedAssignment = (row) => {
  if (row?.isNaturallyClosed != null) return Boolean(row.isNaturallyClosed);
  const st = row?.stats || {};
  const total = st.totalStudents ?? 0;
  return row?.status === 'archived'
    && total > 0
    && (st.submitted ?? 0) === total
    && (st.graded ?? 0) === total;
};

const rowFromDetail = (detailData, detailId) => {
  const assignment = detailData?.assignment;
  if (!assignment) return null;
  return {
    id: assignment.id ?? detailId,
    title: assignment.title,
    deadline: assignment.deadline,
    status: assignment.status,
    displayOverdue: false,
    isNaturallyClosed: detailData?.isNaturallyClosed ?? assignment.isNaturallyClosed,
    stats: detailData?.stats ?? {},
    groups: assignment.groups,
    subject: assignment.subject,
    teacher: assignment.teacher,
  };
};

const NOT_SUBMITTED_PREVIEW = 7;

const pluralStudents = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'студент';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'студента';
  return 'студентов';
};

const buildNotSubmittedGroups = (students) => {
  const map = new Map();
  for (const student of students) {
    const groupKey = student.groupId ?? student.groupName ?? 'unknown';
    const groupName = student.groupName || 'Без группы';
    if (!map.has(groupKey)) {
      map.set(groupKey, { groupId: student.groupId, groupName, students: [] });
    }
    map.get(groupKey).students.push(student);
  }
  return [...map.values()].sort((a, b) => a.groupName.localeCompare(b.groupName, 'ru'));
};

const buildNotSubmittedDisplayGroups = (students, assignmentGroups) => {
  const assignmentGroupList = Array.isArray(assignmentGroups) ? assignmentGroups : [];
  if (assignmentGroupList.length <= 1) {
    return buildNotSubmittedGroups(students);
  }

  const studentsByGroupId = new Map();
  for (const student of students) {
    const key = String(student.groupId ?? student.groupName ?? 'unknown');
    if (!studentsByGroupId.has(key)) {
      studentsByGroupId.set(key, []);
    }
    studentsByGroupId.get(key).push(student);
  }

  return assignmentGroupList
    .map((group) => {
      const key = String(group.id);
      const groupStudents = studentsByGroupId.get(key) ?? [];
      return {
        groupId: group.id,
        groupName: group.name,
        students: [...groupStudents].sort((a, b) => (a.shortName || '').localeCompare(b.shortName || '', 'ru')),
      };
    })
    .filter((group) => group.students.length > 0);
};

const buildNotSubmittedCopyText = (groups, multiGroup) => groups
  .map((group) => {
    const lines = group.students.map((s) => `- ${s.shortName}`);
    if (multiGroup) {
      return `${group.groupName}:\n${lines.join('\n')}`;
    }
    return lines.join('\n');
  })
  .join('\n\n');

const NotSubmittedStudentsBlock = ({
  students,
  assignmentGroups,
  detailId,
  showSuccess,
  showError,
}) => {
  const [listOpen, setListOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [expandedShowAll, setExpandedShowAll] = useState(() => new Set());

  useEffect(() => {
    setListOpen(false);
    setExpandedGroups(new Set());
    setExpandedShowAll(new Set());
  }, [students, detailId]);

  if (!Array.isArray(students) || students.length === 0) {
    return null;
  }

  const multiGroup = (assignmentGroups?.length ?? 0) > 1;
  const groups = buildNotSubmittedDisplayGroups(students, assignmentGroups);
  const count = students.length;
  const allOverdue = students.every((s) => s.overdue);

  const summaryText = allOverdue
    ? `${count} ${pluralStudents(count)} не ${count === 1 ? 'сдал' : 'сдали'} работу. Дедлайн просрочен.`
    : `${count} ${pluralStudents(count)} не ${count === 1 ? 'сдал' : 'сдали'} работу.`;

  const groupBreakdown = multiGroup
    ? groups.map((group) => `${group.groupName} — ${group.students.length}`).join(' · ')
    : '';

  const groupKey = (group) => String(group.groupId ?? group.groupName);

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const openList = () => {
    setListOpen(true);
  };

  const closeList = () => {
    setListOpen(false);
    setExpandedGroups(new Set());
    setExpandedShowAll(new Set());
  };

  const showAllInGroup = (key) => {
    setExpandedShowAll((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const renderGroupStudents = (group) => {
    const key = groupKey(group);
    const showAll = expandedShowAll.has(key);
    const visible = showAll ? group.students : group.students.slice(0, NOT_SUBMITTED_PREVIEW);
    const hasMore = !showAll && group.students.length > NOT_SUBMITTED_PREVIEW;

    return (
      <>
        <ul className="admin-assignment-detail__not-list">
          {visible.map((s) => (
            <li key={s.id}>{s.shortName}</li>
          ))}
        </ul>
        {hasMore && (
          <Button
            type="button"
            variant="outline"
            size="small"
            className="admin-assignment-detail__not-show-all"
            onClick={() => showAllInGroup(key)}
          >
            Показать всех ({group.students.length})
          </Button>
        )}
      </>
    );
  };

  const copyList = async () => {
    const text = buildNotSubmittedCopyText(groups, multiGroup);
    if (!text.trim()) {
      showError('Список пуст');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showSuccess('Список скопирован');
    } catch {
      showError('Не удалось скопировать');
    }
  };

  return (
    <div className="admin-assignment-detail__not-submitted">
      <p className="admin-assignment-detail__not-summary">{summaryText}</p>
      {groupBreakdown ? (
        <p className="admin-assignment-detail__not-breakdown">{groupBreakdown}</p>
      ) : null}
      <div className="admin-assignment-detail__not-toolbar">
        <Button
          type="button"
          variant="outline"
          size="small"
          onClick={() => {
            if (listOpen) closeList();
            else openList();
          }}
        >
          {listOpen ? 'Скрыть список' : `Показать список (${count})`}
        </Button>
        <Button type="button" variant="outline" size="small" onClick={() => void copyList()}>
          Скопировать
        </Button>
      </div>
      {listOpen && (
        <div className="admin-assignment-detail__not-groups">
          {multiGroup ? (
            <div className="admin-assignment-detail__accordion">
              {groups.map((group) => {
                const key = groupKey(group);
                const isOpen = expandedGroups.has(key);
                return (
                  <div
                    key={key}
                    className={`admin-assignment-detail__accordion-item${isOpen ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="admin-assignment-detail__accordion-trigger"
                      aria-expanded={isOpen}
                      onClick={() => toggleGroup(key)}
                    >
                      <span className="admin-assignment-detail__accordion-title">{group.groupName}</span>
                      <span className="admin-assignment-detail__accordion-meta">
                        {group.students.length} {pluralStudents(group.students.length)}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="admin-assignment-detail__accordion-panel">
                        {renderGroupStudents(group)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            groups.map((group) => (
              <div key={groupKey(group)} className="admin-assignment-detail__not-group">
                {renderGroupStudents(group)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const AssignmentFilterCombobox = ({
  label,
  value,
  onChange,
  type,
  allLabel,
  placeholder,
  emptyMessage,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const requestRef = useRef(0);
  const reactId = useId().replace(/:/g, '');
  const inputId = `aam-${type}-filter-${reactId}`;

  const loadOptions = useCallback(async (searchValue, selectedId) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setLoadError('');

    try {
      const params = {
        type,
        limit: FILTER_OPTIONS_LIMIT,
      };
      const trimmed = searchValue.trim();
      if (trimmed) params.search = trimmed;
      if (selectedId) params.selected_id = Number(selectedId);

      const { data } = await api.get('/admin/assignments/filter-options', { params });
      if (requestRef.current !== requestId) return;

      const nextOptions = Array.isArray(data?.data) ? data.data : [];
      setOptions(nextOptions);
      if (selectedId) {
        const selected = nextOptions.find((option) => String(option.id) === String(selectedId));
        if (selected) setSelectedOption(selected);
      } else {
        setSelectedOption(null);
      }
    } catch {
      if (requestRef.current !== requestId) return;
      setOptions([]);
      setLoadError('Не удалось загрузить варианты');
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [type]);

  useEffect(() => {
    void loadOptions(debouncedQuery, value);
  }, [debouncedQuery, loadOptions, value]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocMouseDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [open]);

  const displayLabel = selectedOption?.label || allLabel;
  const hasSelectedValue = Boolean(value);

  const selectOption = (option) => {
    setSelectedOption(option);
    onChange(String(option.id));
    setOpen(false);
  };

  const clearSelection = () => {
    setSelectedOption(null);
    onChange('');
    setOpen(false);
  };

  return (
    <div className="assignment-filter-combobox" ref={rootRef}>
      <label className="filter-popover__label" htmlFor={inputId}>
        {label}
      </label>
      <button
        type="button"
        className={`assignment-filter-combobox__trigger${open ? ' assignment-filter-combobox__trigger--open' : ''}${hasSelectedValue ? ' assignment-filter-combobox__trigger--selected' : ''}`}
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="assignment-filter-combobox__trigger-text">{displayLabel}</span>
        <span className="assignment-filter-combobox__chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="assignment-filter-combobox__panel">
          <input
            id={inputId}
            ref={inputRef}
            type="search"
            className="assignment-filter-combobox__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
          />
          <div className="assignment-filter-combobox__list" role="listbox">
            <button
              type="button"
              className={`assignment-filter-combobox__option${!hasSelectedValue ? ' assignment-filter-combobox__option--active' : ''}`}
              onClick={clearSelection}
            >
              <span className="assignment-filter-combobox__option-label">{allLabel}</span>
              <span className="assignment-filter-combobox__option-meta">Без ограничения</span>
            </button>

            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`assignment-filter-combobox__option${String(option.id) === String(value) ? ' assignment-filter-combobox__option--active' : ''}`}
                onClick={() => selectOption(option)}
                role="option"
                aria-selected={String(option.id) === String(value)}
              >
                <span className="assignment-filter-combobox__option-label">{option.label}</span>
                {option.meta ? <span className="assignment-filter-combobox__option-meta">{option.meta}</span> : null}
              </button>
            ))}

            {loading && <div className="assignment-filter-combobox__state">Загрузка...</div>}
            {!loading && !loadError && options.length === 0 && (
              <div className="assignment-filter-combobox__state">{emptyMessage}</div>
            )}
            {!loading && loadError && <div className="assignment-filter-combobox__state assignment-filter-combobox__state--error">{loadError}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const buildAssignmentSearchParams = ({
  search = '',
  teacherId = '',
  subjectId = '',
  groupId = '',
  statusPack = 'all',
  sort = 'deadline_asc',
} = {}) => {
  const next = new URLSearchParams();
  const q = search.trim();
  if (q) next.set('search', q);
  if (teacherId) next.set('teacher_id', teacherId);
  if (subjectId) next.set('subject_id', subjectId);
  if (groupId) next.set('group_id', groupId);
  if (statusPack === 'stale_review') next.set('filter', 'overdue_checks');
  else if (statusPack === 'overdue') next.set('status', 'overdue');
  else if (statusPack !== 'all') next.set('status', statusPack);
  if (sort !== 'deadline_asc') next.set('sort', sort);
  return next;
};

const AdminAssignmentManagement = () => {
  const { showSuccess, showError } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = useMemo(() => getAssignmentFiltersFromSearchParams(searchParams), [searchParams]);
  const { teacherId, subjectId, groupId, statusPack, sort } = urlFilters;

  const [search, setSearch] = useState(() => getAssignmentFiltersFromSearchParams(searchParams).search);
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [reassignRow, setReassignRow] = useState(null);
  const [eligibleTeachers, setEligibleTeachers] = useState([]);
  const [reassignTeacherId, setReassignTeacherId] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [quickLoadTeacherId, setQuickLoadTeacherId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmTitle, setDeleteConfirmTitle] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    setSearch(urlFilters.search);
    setPage(1);
  }, [urlFilters.search, searchParams]);

  const applyAssignmentFilter = useCallback((patch) => {
    const current = getAssignmentFiltersFromSearchParams(searchParams);
    const next = buildAssignmentSearchParams({
      search: 'search' in patch ? patch.search : current.search,
      teacherId: 'teacherId' in patch ? patch.teacherId : current.teacherId,
      subjectId: 'subjectId' in patch ? patch.subjectId : current.subjectId,
      groupId: 'groupId' in patch ? patch.groupId : current.groupId,
      statusPack: 'statusPack' in patch ? patch.statusPack : current.statusPack,
      sort: 'sort' in patch ? patch.sort : current.sort,
    });
    setSearchParams(next, { replace: true });
    setPage(1);
  }, [searchParams, setSearchParams]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: ADMIN_CARD_GRID_PAGE_SIZE, sort };
      const q = debouncedSearch.trim();
      if (q) params.search = q;
      if (teacherId) params.teacher_id = Number(teacherId);
      if (subjectId) params.subject_id = Number(subjectId);
      if (groupId) params.group_id = Number(groupId);

      if (statusPack === 'stale_review') {
        params.filter = 'review_stale';
      } else if (statusPack === 'overdue') {
        params.status = 'overdue';
      } else if (statusPack !== 'all') {
        params.status = statusPack;
      }

      const { data } = await api.get('/admin/homework', { params });
      const list = Array.isArray(data?.data) ? data.data : [];
      setRows(
        list.map((r) => ({
          id: r.id,
          title: r.title,
          teacher: r.teacher,
          subject: r.subject,
          groups: r.groups ?? [],
          status: r.status,
          displayOverdue: r.displayOverdue,
          deadline: r.deadline,
          createdAt: r.createdAt,
          isNaturallyClosed: r.isNaturallyClosed,
          stats: r.stats ?? {},
        })),
      );
      const m = data?.meta;
      setMeta(parsePaginationMeta(m, page));
    } catch (e) {
      setRows([]);
      setError(getApiErrorMessage(e, 'Не удалось загрузить задания'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, teacherId, subjectId, groupId, statusPack, sort]);

  usePaginationClamp(page, meta.lastPage, setPage);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, teacherId, subjectId, groupId, statusPack, sort]);

  useEffect(() => {
    if (detailId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const { data } = await api.get(`/admin/assignments/${detailId}`);
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          showError(getApiErrorMessage(e, 'Не удалось загрузить задание'));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId, showError]);

  const loadEligibleTeachers = useCallback(async (preserveSelection = false) => {
    if (!reassignRow?.id) {
      setEligibleTeachers([]);
      if (!preserveSelection) {
        setReassignTeacherId('');
      }
      return;
    }

    try {
      const { data } = await api.get(`/admin/assignments/${reassignRow.id}/eligible-teachers`);
      const list = Array.isArray(data?.data) ? data.data : [];
      const currentTeacherId = reassignRow?.teacher?.id ?? reassignRow?.teacherId ?? reassignRow?.teacher_id;
      setEligibleTeachers(list.filter((teacher) => Number(teacher.id) !== Number(currentTeacherId)));
      if (!preserveSelection) {
        setReassignTeacherId('');
      }
    } catch (e) {
      setEligibleTeachers([]);
      showError(getApiErrorMessage(e, 'Не удалось загрузить список преподавателей'));
    }
  }, [reassignRow, showError]);

  useEffect(() => {
    if (!reassignRow?.id) {
      setEligibleTeachers([]);
      setReassignTeacherId('');
      setQuickLoadTeacherId(null);
      return;
    }
    void loadEligibleTeachers();
  }, [reassignRow?.id, loadEligibleTeachers]);

  const reassignSubjectId = useMemo(() => {
    const subject = reassignRow?.subject;
    return Number(subject?.id ?? reassignRow?.subjectId ?? reassignRow?.subject_id ?? 0) || null;
  }, [reassignRow]);

  const reassignGroupLabels = useMemo(() => {
    const groups = Array.isArray(reassignRow?.groups) ? reassignRow.groups : [];
    return groups.reduce((acc, group) => {
      const id = Number(group?.id ?? 0);
      if (id > 0) {
        acc[id] = group?.name || `Группа ${id}`;
      }
      return acc;
    }, {});
  }, [reassignRow]);

  const reassignReadyTeachers = useMemo(
    () => eligibleTeachers.filter((teacher) => teacher.canReassign !== false),
    [eligibleTeachers],
  );

  const reassignMissingLoadTeachers = useMemo(
    () => eligibleTeachers.filter((teacher) => teacher.canReassign === false),
    [eligibleTeachers],
  );

  const reassignTeacherOptions = useMemo(
    () => toReassignTeacherSelectOptions(reassignReadyTeachers),
    [reassignReadyTeachers],
  );

  const resetFilters = useCallback(() => {
    setSearch('');
    setPage(1);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const resetDisabled = useMemo(
    () =>
      !search.trim() && !teacherId && !subjectId && !groupId && statusPack === 'all' && sort === 'deadline_asc',
    [search, teacherId, subjectId, groupId, statusPack, sort],
  );

  const openEdit = (row) => {
    if (isNaturallyClosedAssignment(row)) {
      showError('Задание закрыто автоматически — редактирование запрещено');
      return;
    }
    setDetailId(null);
    setEditRow(row);
    setEditTitle(row.title || '');
    setEditDescription('');
    setEditDeadline(row.deadline || '');
    setEditStatus(row.status || 'active');
    (async () => {
      try {
        const { data } = await api.get(`/admin/assignments/${row.id}`);
        const a = data?.assignment;
        if (a) {
          setEditTitle(a.title || '');
          setEditDescription(a.description || '');
          setEditDeadline(a.deadline || '');
          setEditStatus(a.status || 'active');
        }
      } catch {
        /* use row only */
      }
    })();
  };

  const submitEdit = async () => {
    if (!editRow) return;
    const eid = editRow.id;
    setEditSubmitting(true);
    try {
      await api.put(`/admin/assignments/${eid}`, {
        title: editTitle.trim(),
        description: editDescription,
        deadline: editDeadline,
        status: editStatus,
      });
      showSuccess('Изменения сохранены');
      setEditRow(null);
      void fetchList();
      if (detailId === eid) {
        const { data } = await api.get(`/admin/assignments/${eid}`);
        setDetail(data);
      }
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitQuickTeachingLoad = async (teacher) => {
    const teacherId = Number(teacher?.id ?? 0);
    const groupIds = (teacher?.missingGroupIds ?? teacher?.missing_group_ids ?? [])
      .map((id) => Number(id))
      .filter((id) => id > 0);

    if (!teacherId || !reassignSubjectId || groupIds.length === 0) {
      showError('Не удалось определить группы для назначения');
      return;
    }

    setQuickLoadTeacherId(teacherId);
    try {
      const { data } = await api.post('/admin/teaching-loads/batch', {
        teacherId,
        subjectId: reassignSubjectId,
        groupIds,
        status: 'active',
      });
      const createdCount = Array.isArray(data?.created) ? data.created.length : 0;
      if (createdCount === 0) {
        showError('Назначение уже существует или не удалось его создать');
        await loadEligibleTeachers(true);
        return;
      }
      showSuccess('Назначение добавлено — можно передать задание');
      setReassignTeacherId(String(teacherId));
      await loadEligibleTeachers(true);
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось добавить назначение'));
    } finally {
      setQuickLoadTeacherId(null);
    }
  };

  const submitReassign = async () => {
    if (!reassignRow?.id || !reassignTeacherId) {
      showError('Выберите преподавателя');
      return;
    }
    const rid = reassignRow.id;
    setReassignSubmitting(true);
    try {
      await api.put(`/admin/assignments/${rid}/teacher`, {
        teacherId: Number(reassignTeacherId),
      });
      showSuccess('Преподаватель обновлён');
      setReassignRow(null);
      void fetchList();
      if (detailId === rid) {
        const { data } = await api.get(`/admin/assignments/${rid}`);
        setDetail(data);
      }
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось сменить преподавателя'));
    } finally {
      setReassignSubmitting(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    const did = deleteTarget.id;
    if (deleteConfirmTitle.trim() !== deleteTarget.title) {
      showError('Введите точное название задания');
      return;
    }
    setDeleteSubmitting(true);
    try {
      await api.delete(`/admin/assignments/${did}`);
      showSuccess('Задание удалено');
      setDeleteTarget(null);
      setDeleteConfirmTitle('');
      if (detailId === did) setDetailId(null);
      void fetchList();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось удалить'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const a = detail?.assignment;
  const stats = detail?.stats ?? {};
  const detailRow = useMemo(() => {
    const fromList = rows.find((r) => r.id === detailId);
    if (fromList) return fromList;
    return rowFromDetail(detail, detailId);
  }, [detail, detailId, rows]);
  const detailLocked = isNaturallyClosedAssignment(detailRow);
  const totalStudents = stats.totalStudents ?? 0;
  const submitted = stats.submitted ?? 0;
  const pct = totalStudents > 0 ? Math.round((submitted / totalStudents) * 100) : 0;
  const dist = detail?.gradeDistribution ?? {};

  return (
    <div className="admin-assignment-management">
      <div className="admin-assignment-management__head">
        <div>
          <h1 className="admin-assignment-management__title">Задания</h1>
        </div>
      </div>

      <DashboardFilterToolbar
        className="admin-assignment-management__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по заданию, дисциплине или преподавателю…"
        onReset={resetFilters}
        resetDisabled={resetDisabled}
        popoverAlign="end"
        popoverAriaLabel="Фильтры заданий"
      >
        <div className="filter-popover__section">
          <label className="filter-popover__label" htmlFor="aam-sort">
            Сортировка
          </label>
          <select id="aam-sort" className="filter-popover__select" value={sort} onChange={(e) => applyAssignmentFilter({ sort: e.target.value })}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__section">
          <label className="filter-popover__label" htmlFor="aam-status">
            Статус / контроль
          </label>
          <select id="aam-status" className="filter-popover__select" value={statusPack} onChange={(e) => applyAssignmentFilter({ statusPack: e.target.value })}>
            {STATUS_PACK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-popover__section">
          <AssignmentFilterCombobox
            type="teacher"
            label="Преподаватель"
            value={teacherId}
            onChange={(value) => applyAssignmentFilter({ teacherId: value })}
            allLabel="Все преподаватели"
            placeholder="ФИО, логин или кафедра"
            emptyMessage="Преподаватели не найдены"
          />
        </div>
        <div className="filter-popover__section">
          <AssignmentFilterCombobox
            type="subject"
            label="Дисциплина"
            value={subjectId}
            onChange={(value) => applyAssignmentFilter({ subjectId: value })}
            allLabel="Все дисциплины"
            placeholder="Название или код дисциплины"
            emptyMessage="Дисциплины не найдены"
          />
        </div>
        <div className="filter-popover__section">
          <AssignmentFilterCombobox
            type="group"
            label="Группа"
            value={groupId}
            onChange={(value) => applyAssignmentFilter({ groupId: value })}
            allLabel="Все группы"
            placeholder="Название группы или специальность"
            emptyMessage="Группы не найдены"
          />
        </div>
      </DashboardFilterToolbar>

      {error && (
        <ErrorBanner
          className="admin-assignment-management__error"
          title="Ошибка загрузки заданий"
          message={error}
          actionLabel="Повторить"
          onAction={() => void fetchList()}
        />
      )}

      <div className={`admin-assignment-management__grid-wrap${loading ? ' admin-assignment-management__grid-wrap--loading' : ''}`}>
        {loading && <LoadingState message="Загрузка заданий..." className="admin-assignment-management__state" />}
        {!loading && rows.length === 0 && !error && (
          <EmptyState
            title="Задания не найдены"
            message="Попробуйте изменить параметры поиска или фильтрации"
            className="admin-assignment-management__state"
          />
        )}
        {!loading && rows.length > 0 && (
          <div className="admin-assignment-management__grid">
            {rows.map((row) => {
              const b = statusBadge(row);
              const st = row.stats || {};
              return (
                <EntityCard
                  key={row.id}
                  className="admin-assignment-card"
                  padding="medium"
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailId(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailId(row.id);
                    }
                  }}
                >
                  <div className="admin-assignment-card__head">
                    <h3 className="admin-assignment-card__title">{row.title}</h3>
                    <StatusBadge tone={b.tone} className="admin-assignment-card__status">
                      {b.label}
                    </StatusBadge>
                  </div>
                  <div className="admin-assignment-card__meta">
                    <p className="admin-assignment-card__meta-line">{row.teacher?.shortName ?? '—'}</p>
                    <p className="admin-assignment-card__meta-line">
                      {row.subject
                        ? `${row.subject.name}${row.subject.code ? ` (${row.subject.code})` : ''}`
                        : '—'}
                    </p>
                    <div className="admin-assignment-card__groups">
                      {(row.groups?.length ?? 0) > 0 ? (
                        row.groups.map((group) => (
                          <span key={group.id} className="admin-assignment-card__group-tag">
                            {group.name}
                          </span>
                        ))
                      ) : (
                        <span className="admin-assignment-card__group-tag">—</span>
                      )}
                    </div>
                  </div>
                  <div className="admin-assignment-card__foot">
                    <div className="admin-assignment-card__deadline">
                      <span className="admin-assignment-card__deadline-label">Дедлайн</span>
                      <span className="admin-assignment-card__deadline-value">{formatDateLong(row.deadline)}</span>
                    </div>
                    <div className="admin-assignment-card__metrics">
                      <span className="admin-assignment-card__metric">
                        Сдано {st.submitted ?? 0}/{st.totalStudents ?? 0}
                      </span>
                      <span className="admin-assignment-card__metric">
                        Проверено {st.graded ?? 0}
                      </span>
                      <span className="admin-assignment-card__metric">
                        Ждут проверки {st.pendingReview ?? 0}
                      </span>
                      {st.avgScore != null ? (
                        <span className="admin-assignment-card__metric admin-assignment-card__metric--score">
                          Средний балл {st.avgScore}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </EntityCard>
              );
            })}
          </div>
        )}
      </div>

      <Pagination
        className="admin-assignment-management__pagination"
        currentPage={meta.currentPage}
        lastPage={meta.lastPage}
        total={meta.total}
        fallbackCount={rows.length}
        disabled={loading}
        hideWhenSinglePage
        onPageChange={setPage}
      />

      <Modal
        isOpen={detailId != null}
        onClose={() => !detailLoading && setDetailId(null)}
        title={a?.title || 'Задание'}
        size="large"
        contentClassName="admin-assignment-detail"
        footer={!detailLoading && a ? (
          detailLocked ? (
            <p className="admin-assignment-detail__lock-hint">
              Задание закрыто автоматически: все работы сданы и проверены. Редактирование недоступно.
            </p>
          ) : (
            <>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  if (detailRow) openEdit(detailRow);
                }}
              >
                Редактировать
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (detailRow) setReassignRow(detailRow);
                }}
              >
                Сменить преподавателя
              </Button>
            </>
          )
        ) : null}
      >
        {detailLoading && <LoadingState message="Загрузка..." className="admin-assignment-management__state" />}
        {!detailLoading && a && (
          <>
            <ModalSection title="Информация">
              <dl className="admin-assignment-detail__dl">
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Дисциплина</dt>
                  <dd className="admin-assignment-detail__dd">
                    {a.subject ? `${a.subject.name}${a.subject.code ? ` (${a.subject.code})` : ''}` : '—'}
                  </dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Преподаватель</dt>
                  <dd className="admin-assignment-detail__dd">{a.teacher?.shortName ?? '—'}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Группы</dt>
                  <dd className="admin-assignment-detail__dd">
                    {(a.groups?.length ?? 0) > 1 ? (
                      <ul className="admin-assignment-detail__group-list">
                        {a.groups.map((group) => (
                          <li key={group.id}>{group.name}</li>
                        ))}
                      </ul>
                    ) : (
                      a.groups?.[0]?.name ?? '—'
                    )}
                  </dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Статус</dt>
                  <dd className="admin-assignment-detail__dd">
                    {assignmentStatusLabel(a.status)}
                    {detailLocked ? ' · завершено полностью' : ''}
                  </dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Дата создания</dt>
                  <dd className="admin-assignment-detail__dd">{formatDateLong(a.createdAt)}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Дедлайн</dt>
                  <dd className="admin-assignment-detail__dd">{formatDateLong(a.deadline)}</dd>
                </div>
              </dl>
            </ModalSection>
            <ModalSection title="Сдачи" variant="soft">
              <div className="admin-assignment-detail__bar">
                <div className="admin-assignment-detail__bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <dl className="admin-assignment-detail__dl">
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Всего</dt>
                  <dd className="admin-assignment-detail__dd">{totalStudents}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Сдано</dt>
                  <dd className="admin-assignment-detail__dd">{submitted}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Проверено</dt>
                  <dd className="admin-assignment-detail__dd">{stats.graded ?? 0}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Ждут проверки</dt>
                  <dd className="admin-assignment-detail__dd">{stats.pendingReview ?? 0}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Не сдали</dt>
                  <dd className="admin-assignment-detail__dd">{stats.notSubmitted ?? 0}</dd>
                </div>
                <div className="admin-assignment-detail__row">
                  <dt className="admin-assignment-detail__dt">Средний балл</dt>
                  <dd className="admin-assignment-detail__dd">{stats.avgScore ?? '—'}</dd>
                </div>
              </dl>
              {['5', '4', '3', '2'].some((k) => (dist[k] ?? 0) > 0) && (
                <ul className="admin-assignment-detail__grades">
                  {[5, 4, 3, 2].map((n) => ((dist[String(n)] ?? 0) > 0 ? <li key={n}>{`Оценка ${n}: ${dist[String(n)]}`}</li> : null))}
                </ul>
              )}
              {Array.isArray(detail?.notSubmitted) && detail.notSubmitted.length > 0 && (
                <NotSubmittedStudentsBlock
                  students={detail.notSubmitted}
                  assignmentGroups={a?.groups}
                  detailId={detailId}
                  showSuccess={showSuccess}
                  showError={showError}
                />
              )}
            </ModalSection>

            <ModalDangerZone
              title="Удаление задания"
              description="Будут удалены задание, все сдачи и оценки. Действие необратимо."
            >
                <Button
                  type="button"
                  variant="danger"
                  size="small"
                  onClick={() => {
                    if (detailRow) {
                      setDeleteTarget(detailRow);
                      setDeleteConfirmTitle('');
                    }
                  }}
                >
                  Удалить задание
                </Button>
            </ModalDangerZone>
          </>
        )}
      </Modal>

      <Modal
        isOpen={!!editRow}
        onClose={() => !editSubmitting && setEditRow(null)}
        title="Редактирование задания"
        size="medium"
        contentClassName="admin-assignment-form"
        footer={(
          <>
            <Button
              type="button"
              variant="primary"
              loading={editSubmitting}
              disabled={editSubmitting || !editTitle.trim()}
              onClick={() => void submitEdit()}
            >
              Сохранить
            </Button>
          </>
        )}
      >
        <ModalSection title="Данные задания">
          <label className="admin-assignment-form__label" htmlFor="aam-edit-title">
            Название
          </label>
          <input
            id="aam-edit-title"
            className="admin-assignment-form__input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Название задания"
            autoComplete="off"
          />
          <TextArea
            label="Описание"
            value={editDescription}
            onChange={setEditDescription}
            className="admin-textarea admin-assignment-form__textarea"
            rows={4}
            placeholder="Описание задания (необязательно)"
          />
          <label className="admin-assignment-form__label" htmlFor="aam-edit-deadline">
            Дедлайн
          </label>
          <input
            id="aam-edit-deadline"
            type="date"
            className="admin-assignment-form__input"
            value={editDeadline}
            onChange={(e) => setEditDeadline(e.target.value)}
          />
          <label className="admin-assignment-form__label" htmlFor="aam-edit-status">
            Статус
          </label>
          <select id="aam-edit-status" className="admin-assignment-form__select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
            <option value="active">Активно</option>
            <option value="archived">Закрыто</option>
          </select>
        </ModalSection>
      </Modal>

      <Modal
        isOpen={!!reassignRow}
        onClose={() => !reassignSubmitting && quickLoadTeacherId == null && setReassignRow(null)}
        title="Сменить преподавателя"
        size="large"
        className="admin-assignment-reassign-modal"
        contentClassName="admin-assignment-form admin-assignment-reassign-modal__content"
        footer={(
          <>
            <Button
              type="button"
              variant="primary"
              loading={reassignSubmitting}
              disabled={!reassignTeacherId || quickLoadTeacherId != null}
              onClick={() => void submitReassign()}
            >
              Сменить
            </Button>
          </>
        )}
      >
        <ModalSection title="Новый преподаватель">
          <p className="admin-assignment-form__note">
            Выберите преподавателя, у которого уже есть учебное назначение на все группы этого задания.
            Назначение текущего преподавателя не снимается — у нового создаётся отдельная строка.
          </p>
          <label className="admin-assignment-form__label" htmlFor="aam-reassign-t">
            Преподаватель с назначением
          </label>
          <SearchableSelect
            value={reassignTeacherId}
            onChange={setReassignTeacherId}
            options={reassignTeacherOptions}
            placeholder="Выберите преподавателя"
            searchPlaceholder="Найти преподавателя…"
            emptyMessage="Пока нет подходящих преподавателей"
            disabled={quickLoadTeacherId != null}
            ariaLabel="Новый преподаватель"
          />
          {reassignReadyTeachers.length === 0 && reassignMissingLoadTeachers.length === 0 && (
            <p className="admin-assignment-form__hint">
              Нет преподавателей с допуском к дисциплине этого задания.
            </p>
          )}
          {reassignReadyTeachers.length === 0 && reassignMissingLoadTeachers.length > 0 && (
            <p className="admin-assignment-form__hint">
              Сначала добавьте назначение нужному преподавателю — кнопкой ниже или в разделе «Назначения».
            </p>
          )}
          {reassignMissingLoadTeachers.length > 0 && (
            <div className="admin-assignment-form__warning">
              <p className="admin-assignment-form__warning-title">
                Есть допуск к дисциплине, но нет назначения на группы задания
              </p>
              <ul className="admin-assignment-form__warning-list">
                {reassignMissingLoadTeachers.map((teacher) => {
                  const teacherId = Number(teacher.id);
                  const missingGroupIds = (teacher.missingGroupIds ?? teacher.missing_group_ids ?? [])
                    .map((id) => Number(id))
                    .filter((id) => id > 0);
                  const missingGroupNames = missingGroupIds
                    .map((id) => reassignGroupLabels[id] || `группа ${id}`)
                    .join(', ');

                  return (
                    <li key={teacher.id} className="admin-assignment-form__warning-item">
                      <div className="admin-assignment-form__warning-copy">
                        <strong>{teacher.shortName ?? teacher.short_name ?? 'Преподаватель'}</strong>
                        {missingGroupNames ? (
                          <span>{missingGroupNames}</span>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="small"
                        variant="outline"
                        loading={quickLoadTeacherId === teacherId}
                        disabled={quickLoadTeacherId != null && quickLoadTeacherId !== teacherId}
                        onClick={() => void submitQuickTeachingLoad(teacher)}
                      >
                        Добавить назначение
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </ModalSection>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleteSubmitting && setDeleteTarget(null)}
        title="Удалить задание"
        size="medium"
        contentClassName="admin-assignment-form"
        footer={(
          <>
            <Button
              type="button"
              variant="danger"
              loading={deleteSubmitting}
              disabled={deleteSubmitting || deleteConfirmTitle.trim() !== (deleteTarget?.title ?? '')}
              onClick={() => void submitDelete()}
            >
              Удалить
            </Button>
          </>
        )}
      >
        <ModalSection title="Подтверждение удаления" variant="danger">
          <p className="admin-assignment-form__hint">
            Будут удалены задание и все сданные работы. Введите название задания для подтверждения.
          </p>
          <label className="admin-assignment-form__label" htmlFor="aam-del-title">
             Название
          </label>
          <input
            id="aam-del-title"
            className="admin-assignment-form__input"
            value={deleteConfirmTitle}
            onChange={(e) => setDeleteConfirmTitle(e.target.value)}
            placeholder={deleteTarget?.title || ''}
            autoComplete="off"
          />
        </ModalSection>
      </Modal>
    </div>
  );
};

export default AdminAssignmentManagement;
