import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardHeader from '../../components/Teacher/DashboardHeader/DashboardHeader';
import AssignmentCard from '../../components/Teacher/AssignmentCard/AssignmentCard';
import AssignmentBankCard from '../../components/Teacher/AssignmentBankCard/AssignmentBankCard';
import SubmissionsTable from '../../components/Teacher/SubmissionsTable/SubmissionsTable';
import AnalyticsSection from '../../components/Teacher/AnalyticsSection/AnalyticsSection';
import GradingModal from '../../components/Teacher/GradingModal/GradingModal';
import AssignmentModal from '../../components/Teacher/AssignmentModal/AssignmentModal';
import PublishFromBankModal from '../../components/Teacher/PublishFromBankModal/PublishFromBankModal';
import SubmissionDetailsModal from '../../components/Teacher/SubmissionDetailsModal/SubmissionDetailsModal';
import Button from '../../components/UI/Button/Button';
import Pagination from '../../components/UI/Pagination/Pagination';
import SearchableSelect from '../../components/UI/SearchableSelect/SearchableSelect';
import PageShell from '../../components/UI/PageShell/PageShell';
import LoadingState from '../../components/UI/LoadingState/LoadingState';
import EmptyState from '../../components/UI/EmptyState/EmptyState';
import ErrorBanner from '../../components/UI/ErrorBanner/ErrorBanner';
import InputModal from '../../components/UI/Modal/InputModal';
import ConfirmModal from '../../components/UI/Modal/ConfirmModal';
import AssignmentDetailsModal from '../../components/Shared/AssignmentDetailsModal/AssignmentDetailsModal';
import DashboardFilterToolbar from '../../components/Shared/DashboardFilterToolbar';
import TeacherStudentsSection from '../../components/Teacher/TeacherStudentsSection/TeacherStudentsSection';
import TeacherDisciplinesSection from '../../components/Teacher/TeacherDisciplinesSection/TeacherDisciplinesSection';
import { useAuth } from '../../context/AuthContext';
import { useTeacher, normalizeSubmission, normalizeAssignment } from '../../context/TeacherContext';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/adminApiErrors';
import {
  calculateSubmissionStats,
  buildNormalizedGroupOptions,
  buildSubmissionSubjectOptions,
  PAGINATION_DEFAULTS,
  downloadAssignmentMaterial,
  DownloadCancelledError,
} from '../../utils';
import api from '../../services/api';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import {
  DEFAULT_TEACHER_DASHBOARD_TAB,
  resolveTeacherDashboardTab,
} from '../../config/teacherDashboardNavItems';
import './TeacherDashboard.scss';

const TEACHER_DASHBOARD_FILTERS_KEY = 'teacher-dashboard-filters-v1';

const DEFAULT_SUBMISSION_STATUS_FILTER = 'submitted';

const isCompletedAssignment = (assignment) => (
  Boolean(assignment?.isCompleted || assignment?.status === 'archived')
);

const normalizeStoredSubmissionStatus = (value) => {
  if (value == null || value === '') {
    return DEFAULT_SUBMISSION_STATUS_FILTER;
  }
  if (['all', 'submitted', 'graded', 'returned'].includes(value)) {
    return value;
  }
  return DEFAULT_SUBMISSION_STATUS_FILTER;
};

const getStoredTeacherFilters = () => {
  try {
    const raw = window.localStorage.getItem(TEACHER_DASHBOARD_FILTERS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
};

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { 
    teacherAssignments: assignments, 
    submissions, 
    assignmentsMeta = {},
    submissionsMeta = {},
    availableGroups: teacherAvailableGroups,
    teachingGroups,
    availableSubjects: teacherAvailableSubjects,
    teachingLoadPairs,
    loading,
    submissionsLoading,
    loadTeacherMeta,
    loadTeacherAssignments, 
    loadTeacherSubmissions,
    gradeSubmission,
    returnSubmission,
    createAssignment,
    publishAssignmentFromBank,
    updateAssignment,
    deleteAssignment,
    loadTeacherData,
    error 
  } = useTeacher();
  const { showSuccess, showError, showInfo } = useNotification();
  const showInfoRef = useRef(showInfo);
  showInfoRef.current = showInfo;
  const [searchParams, setSearchParams] = useSearchParams();
  const [teacherNotificationNav, setTeacherNotificationNav] = useState(null);
  const [assignmentDetailsNav, setAssignmentDetailsNav] = useState(null);

  const storedFilters = getStoredTeacherFilters();
  const tabRestoredFromStorageRef = useRef(false);
  const activeTab = useMemo(() => {
    const urlTab = searchParams.get('tab');
    if (urlTab) {
      return resolveTeacherDashboardTab(urlTab);
    }
    if (searchParams.get('assignment') && searchParams.get('tab') !== 'assignments') {
      return 'submissions';
    }
    return DEFAULT_TEACHER_DASHBOARD_TAB;
  }, [searchParams]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputModalConfig, setInputModalConfig] = useState(null);
  const [gradeData, setGradeData] = useState({
    score: '',
    comment: '',
    criterionScores: [],
    draftSubmissionId: null,
    useCriteriaScoring: false,
  });
  const [assignmentFilter, setAssignmentFilter] = useState(storedFilters?.assignmentFilter || 'all');
  const [groupFilter, setGroupFilter] = useState(storedFilters?.groupFilter || 'all');
  const [statusFilter, setStatusFilter] = useState(normalizeStoredSubmissionStatus(storedFilters?.statusFilter));
  const [searchTerm, setSearchTerm] = useState(storedFilters?.searchTerm || '');
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState(storedFilters?.assignmentSearchTerm || '');
  const [assignmentGroupFilter, setAssignmentGroupFilter] = useState(storedFilters?.assignmentGroupFilter || 'all');
  const [assignmentSubjectFilter, setAssignmentSubjectFilter] = useState(
    storedFilters?.assignmentSubjectFilter || 'all'
  );
  const [assignmentWorkFilter, setAssignmentWorkFilter] = useState(
    storedFilters?.assignmentWorkFilter || 'all'
  );
  const [assignmentDeadlineFilter, setAssignmentDeadlineFilter] = useState(
    storedFilters?.assignmentDeadlineFilter || 'all'
  );
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detailsAssignment, setDetailsAssignment] = useState(null);
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);
  const [assignmentFormDraft, setAssignmentFormDraft] = useState(null);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentsBankMode, setAssignmentsBankMode] = useState(
    Boolean(storedFilters?.assignmentsBankMode)
  );
  const [bankTemplates, setBankTemplates] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [showBankTemplateModal, setShowBankTemplateModal] = useState(false);
  const [editingBankTemplate, setEditingBankTemplate] = useState(null);
  const [showPublishBankModal, setShowPublishBankModal] = useState(false);
  const [publishBankTemplate, setPublishBankTemplate] = useState(null);
  const [publishBankSubmitting, setPublishBankSubmitting] = useState(false);
  const [bankTemplateToDelete, setBankTemplateToDelete] = useState(null);
  const [showBankDeleteConfirm, setShowBankDeleteConfirm] = useState(false);
  const [submissionPage, setSubmissionPage] = useState(1);
  // Закреплённое задание при переходе «Просмотр работ» с карточки: { id, title }.
  // Транзитное, в localStorage не сохраняется.
  const [pinnedAssignment, setPinnedAssignment] = useState(null);
  const [submissionSort, setSubmissionSort] = useState(
    storedFilters?.submissionSort || 'review_queue'
  );
  const [deadlineFilter, setDeadlineFilter] = useState(storedFilters?.deadlineFilter || 'all');
  const [submissionsPanelLoading, setSubmissionsPanelLoading] = useState(false);
  const [analyticsAssignments, setAnalyticsAssignments] = useState([]);
  const [analyticsSubmissions, setAnalyticsSubmissions] = useState([]);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [analyticsSnapshotLoading, setAnalyticsSnapshotLoading] = useState(false);
  const [analyticsGroupId, setAnalyticsGroupId] = useState(storedFilters?.analyticsGroupId || 'all');
  const submissionsTabBusy = submissionsPanelLoading || submissionsLoading;

  const assignmentFiltersResetDisabled = useMemo(() => {
    return (
      !assignmentSearchTerm.trim() &&
      assignmentSubjectFilter === 'all' &&
      assignmentGroupFilter === 'all' &&
      assignmentWorkFilter === 'all' &&
      assignmentDeadlineFilter === 'all'
    );
  }, [
    assignmentSearchTerm,
    assignmentSubjectFilter,
    assignmentGroupFilter,
    assignmentWorkFilter,
    assignmentDeadlineFilter,
  ]);

  const submissionFiltersResetDisabled = useMemo(() => {
    const atDefaults =
      !searchTerm.trim() &&
      assignmentFilter === 'all' &&
      groupFilter === 'all' &&
      statusFilter === DEFAULT_SUBMISSION_STATUS_FILTER &&
      submissionSort === 'review_queue' &&
      deadlineFilter === 'all' &&
      !pinnedAssignment;
    return atDefaults || submissionsTabBusy;
  }, [
    searchTerm,
    assignmentFilter,
    groupFilter,
    statusFilter,
    submissionSort,
    deadlineFilter,
    pinnedAssignment,
    submissionsTabBusy,
  ]);

  const debouncedAssignmentSearch = useDebouncedValue(assignmentSearchTerm, 350);
  const debouncedSubmissionsSearch = useDebouncedValue(searchTerm, 350);

  const handleRetryLoad = useCallback(() => {
    if (activeTab === 'submissions') {
      loadTeacherSubmissions({
        page: submissionPage,
        perPage: PAGINATION_DEFAULTS.teacherSubmissions,
        sort: submissionSort,
        search: debouncedSubmissionsSearch || undefined,
        status: statusFilter,
        subjectId: assignmentFilter !== 'all' ? assignmentFilter : 'all',
        group: groupFilter !== 'all' ? groupFilter : 'all',
        deadlineFilter: deadlineFilter !== 'all' ? deadlineFilter : 'all',
        assignmentId: 'all',
        studentId: 'all',
      });
      return;
    }

    if (activeTab === 'assignments' || activeTab === 'completed') {
      loadTeacherAssignments({
        page: assignmentPage,
        perPage: PAGINATION_DEFAULTS.teacherAssignments,
        sort: 'deadline',
        search: debouncedAssignmentSearch || undefined,
        group: assignmentGroupFilter !== 'all' ? assignmentGroupFilter : undefined,
        subjectId: assignmentSubjectFilter !== 'all' ? assignmentSubjectFilter : undefined,
        workFilter: activeTab === 'assignments' && assignmentWorkFilter !== 'all' ? assignmentWorkFilter : undefined,
        assignmentDeadlineFilter: assignmentDeadlineFilter !== 'all' ? assignmentDeadlineFilter : undefined,
        status: activeTab === 'completed' ? 'archived' : (activeTab === 'assignments' ? 'not_archived' : undefined),
      });
      return;
    }

    loadTeacherData();
  }, [
    activeTab,
    submissionPage,
    submissionSort,
    debouncedSubmissionsSearch,
    statusFilter,
    assignmentFilter,
    groupFilter,
    deadlineFilter,
    assignmentPage,
    debouncedAssignmentSearch,
    assignmentGroupFilter,
    assignmentSubjectFilter,
    assignmentWorkFilter,
    assignmentDeadlineFilter,
    loadTeacherSubmissions,
    loadTeacherAssignments,
    loadTeacherData,
  ]);

  const handleTabChange = useCallback((tab) => {
    const nextTab = resolveTeacherDashboardTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextTab === DEFAULT_TEACHER_DASHBOARD_TAB) {
        next.delete('tab');
      } else {
        next.set('tab', nextTab);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (tabRestoredFromStorageRef.current) {
      return;
    }
    tabRestoredFromStorageRef.current = true;
    if (searchParams.get('tab') || searchParams.get('assignment')) {
      return;
    }
    const storedTab = resolveTeacherDashboardTab(storedFilters?.activeTab);
    if (storedTab !== DEFAULT_TEACHER_DASHBOARD_TAB) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', storedTab);
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, storedFilters?.activeTab]);

  const loadBankTemplates = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setBankLoading(true);
    }
    try {
      const { data } = await api.get('/assignment-bank');
      setBankTemplates(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setBankTemplates([]);
      if (!silent) {
        showError(getApiErrorMessage(err, 'Не удалось загрузить банк заданий'));
      }
    } finally {
      if (!silent) {
        setBankLoading(false);
      }
    }
  }, [showError]);

  const handleResetAssignmentFilters = () => {
    setAssignmentSearchTerm('');
    setAssignmentGroupFilter('all');
    setAssignmentSubjectFilter('all');
    setAssignmentWorkFilter('all');
    setAssignmentDeadlineFilter('all');
    setAssignmentPage(1);
  };

  const handleResetSubmissionFilters = () => {
    setSearchTerm('');
    setAssignmentFilter('all');
    setGroupFilter('all');
    setStatusFilter(DEFAULT_SUBMISSION_STATUS_FILTER);
    setSubmissionSort('review_queue');
    setDeadlineFilter('all');
    setPinnedAssignment(null);
    setSubmissionPage(1);
  };

  useEffect(() => {
    if (user?.role !== 'teacher') {
      return;
    }
    const assignmentId = searchParams.get('assignment');
    if (!assignmentId) {
      return;
    }

    const urlTab = searchParams.get('tab');
    const submissionId = searchParams.get('submission');

    if (urlTab === 'assignments' && !submissionId) {
      setAssignmentDetailsNav({ assignmentId: String(assignmentId) });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'assignments');
        next.delete('assignment');
        return next;
      }, { replace: true });
      return;
    }

    setTeacherNotificationNav({
      assignmentId: String(assignmentId),
      submissionId: submissionId ? String(submissionId) : null,
      loaded: false,
    });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'submissions');
      if (submissionId) {
        next.set('submission', submissionId);
      } else {
        next.delete('submission');
      }
      next.delete('assignment');
      return next;
    }, { replace: true });
  }, [searchParams, user?.role, setSearchParams]);

  useEffect(() => {
    if (!assignmentDetailsNav || activeTab !== 'assignments') {
      return undefined;
    }

    let cancelled = false;
    const aid = assignmentDetailsNav.assignmentId;

    const openDetails = (assignment) => {
      if (cancelled || !assignment) {
        return;
      }
      setDetailsAssignment(normalizeAssignment(assignment));
      setShowAssignmentDetails(true);
      setAssignmentDetailsNav(null);
      if (assignment.id) {
        void api.get(`/assignments/${assignment.id}`)
          .then(({ data }) => {
            if (cancelled) {
              return;
            }
            setDetailsAssignment((prev) => (
              Number(prev?.id) === Number(assignment.id)
                ? normalizeAssignment({ ...prev, ...data })
                : prev
            ));
          })
          .catch(() => {});
      }
    };

    const existingAssignment = assignments.find((item) => String(item.id) === String(aid));
    if (existingAssignment) {
      openDetails(existingAssignment);
      return undefined;
    }

    (async () => {
      try {
        const { data } = await api.get(`/assignments/${aid}`);
        openDetails(normalizeAssignment(data?.assignment || data));
      } catch {
        if (!cancelled) {
          showInfoRef.current('Задание не найдено или у вас нет доступа.');
          setAssignmentDetailsNav(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignmentDetailsNav, activeTab, assignments]);

  useEffect(() => {
    if (!teacherNotificationNav || teacherNotificationNav.loaded || activeTab !== 'submissions') {
      return;
    }
    const { assignmentId, submissionId } = teacherNotificationNav;
    let cancelled = false;
    (async () => {
      setSubmissionsPanelLoading(true);
      try {
        await loadTeacherSubmissions({
          page: 1,
          perPage: 100,
          assignmentId,
          subjectId: 'all',
          group: 'all',
          studentId: 'all',
          status: 'all',
          listContext: 'full',
          search: undefined,
          sort: 'review_queue',
          deadlineFilter: 'all',
        }, { trackLoading: false });
      } finally {
        if (!cancelled) {
          setSubmissionsPanelLoading(false);
        }
      }
      if (cancelled) {
        return;
      }
      if (!submissionId) {
        setTeacherNotificationNav(null);
      } else {
        setTeacherNotificationNav((prev) => (
          prev
          && String(prev.assignmentId) === String(assignmentId)
          && String(prev.submissionId) === String(submissionId)
            ? { ...prev, loaded: true }
            : prev
        ));
      }
    })();

    return () => {
      cancelled = true;
      setSubmissionsPanelLoading(false);
    };
  }, [teacherNotificationNav, activeTab, loadTeacherSubmissions]);

  useEffect(() => {
    if (!teacherNotificationNav?.submissionId || !teacherNotificationNav.loaded || loading || submissionsPanelLoading) {
      return undefined;
    }

    let cancelled = false;
    const sid = String(teacherNotificationNav.submissionId);

    const openSubmission = (submission) => {
      if (cancelled || !submission) {
        return;
      }

      const relatedAssignment = assignments.find((a) => Number(a.id) === Number(submission.assignmentId));
      const fallbackAssignment = {
        id: submission.assignmentId,
        title: submission.assignmentTitle,
        subject: submission.subjectName,
        maxScore: submission.maxScore,
        submissionType: submission.submissionType,
        deadline: submission.assignmentDeadline,
      };

      if (['submitted', 'graded', 'returned'].includes(submission.status)) {
        setStatusFilter(submission.status);
      }
      setSelectedSubmission(submission);
      setSelectedAssignment(relatedAssignment || fallbackAssignment);
      setShowDetailsModal(true);
      setTeacherNotificationNav(null);
    };

    const existingSubmission = submissions.find((s) => String(s.id) === sid);
    if (existingSubmission) {
      openSubmission(existingSubmission);
      return undefined;
    }

    (async () => {
      try {
        const { data } = await api.get(`/submissions/${sid}`);
        const submission = normalizeSubmission(data?.submission || data);
        openSubmission(submission);
      } catch {
        if (!cancelled) {
          setTeacherNotificationNav(null);
          showInfoRef.current('Сдача не найдена. Возможно, она удалена или у вас нет доступа.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [submissions, teacherNotificationNav, loading, submissionsPanelLoading, assignments]);

  const loadAnalyticsSnapshot = useCallback(async () => {
    if (!user) return;

    const idNum = analyticsGroupId !== 'all' ? Number(analyticsGroupId) : NaN;
    const groupParams = Number.isFinite(idNum) && idNum > 0 ? { group_id: idNum } : {};

    setAnalyticsSnapshotLoading(true);
    try {
      const [assignmentsRes, submissionsRes] = await Promise.all([
        api.get('/assignments', { params: { sort: 'newest', ...groupParams } }),
        api.get('/submissions', { params: { sort: 'newest', list_context: 'full', ...groupParams } }),
      ]);

      const rawAssignments = Array.isArray(assignmentsRes.data?.data)
        ? assignmentsRes.data.data
        : (assignmentsRes.data || []);
      const rawSubmissions = Array.isArray(submissionsRes.data?.data)
        ? submissionsRes.data.data
        : (submissionsRes.data || []);

      setAnalyticsAssignments(rawAssignments.map(normalizeAssignment));
      setAnalyticsSubmissions(rawSubmissions.map(normalizeSubmission));
      setAnalyticsLoaded(true);
    } catch (error) {
      setAnalyticsLoaded(false);
    } finally {
      setAnalyticsSnapshotLoading(false);
    }
  }, [user, analyticsGroupId]);

  useEffect(() => {
    if (user) {
      loadTeacherMeta();
    }
  }, [user, loadTeacherMeta]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalyticsSnapshot();
    }
  }, [activeTab, loadAnalyticsSnapshot]);

  useEffect(() => {
    if (activeTab === 'assignments' || activeTab === 'completed') {
      setAssignmentPage(1);
    }
    if (activeTab === 'submissions') {
      setSubmissionPage(1);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'assignments') {
      setAssignmentsBankMode(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'assignments' || !assignmentsBankMode) {
      return;
    }
    loadBankTemplates();
  }, [activeTab, assignmentsBankMode, loadBankTemplates]);

  useEffect(() => {
    if (!showAssignmentDetails || !detailsAssignment?.id) {
      return;
    }
    loadBankTemplates({ silent: true });
  }, [showAssignmentDetails, detailsAssignment?.id, loadBankTemplates]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (activeTab !== 'assignments' && activeTab !== 'completed') {
      return;
    }
    if (activeTab === 'assignments' && assignmentsBankMode) {
      return;
    }

    loadTeacherAssignments({
      page: assignmentPage,
      perPage: PAGINATION_DEFAULTS.teacherAssignments,
      sort: 'deadline',
      search: debouncedAssignmentSearch || undefined,
      group: assignmentGroupFilter !== 'all' ? assignmentGroupFilter : undefined,
      subjectId: assignmentSubjectFilter !== 'all' ? assignmentSubjectFilter : undefined,
      workFilter: activeTab === 'assignments' && assignmentWorkFilter !== 'all' ? assignmentWorkFilter : undefined,
      assignmentDeadlineFilter: assignmentDeadlineFilter !== 'all' ? assignmentDeadlineFilter : undefined,
      status: activeTab === 'completed' ? 'archived' : (activeTab === 'assignments' ? 'not_archived' : undefined),
    });
  }, [
    user,
    activeTab,
    assignmentPage,
    debouncedAssignmentSearch,
    assignmentGroupFilter,
    assignmentSubjectFilter,
    assignmentWorkFilter,
    assignmentDeadlineFilter,
    loadTeacherAssignments,
    assignmentsBankMode,
  ]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    if (activeTab !== 'submissions') {
      return undefined;
    }
    if (teacherNotificationNav) {
      return undefined;
    }

    let cancelled = false;

    const submissionParams = {
      page: submissionPage,
      perPage: PAGINATION_DEFAULTS.teacherSubmissions,
      sort: submissionSort,
      search: debouncedSubmissionsSearch || undefined,
      status: statusFilter,
      subjectId: assignmentFilter !== 'all' ? assignmentFilter : 'all',
      group: groupFilter !== 'all' ? groupFilter : 'all',
      deadlineFilter: deadlineFilter !== 'all' ? deadlineFilter : 'all',
      assignmentId: pinnedAssignment ? pinnedAssignment.id : 'all',
      studentId: 'all',
      // Статус «Все»: без list_context бэкенд скрывает возвращённые на доработку.
      ...(statusFilter === 'all' ? { listContext: 'full' } : {}),
    };

    (async () => {
      setSubmissionsPanelLoading(true);
      try {
        await loadTeacherSubmissions(submissionParams, { trackLoading: false });
      } finally {
        if (!cancelled) {
          setSubmissionsPanelLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setSubmissionsPanelLoading(false);
    };
  }, [
    user,
    activeTab,
    submissionPage,
    debouncedSubmissionsSearch,
    statusFilter,
    assignmentFilter,
    groupFilter,
    submissionSort,
    deadlineFilter,
    pinnedAssignment,
    teacherNotificationNav,
    loadTeacherSubmissions,
  ]);

  useEffect(() => {
    window.localStorage.setItem(
      TEACHER_DASHBOARD_FILTERS_KEY,
      JSON.stringify({
        activeTab,
        assignmentFilter,
        groupFilter,
        statusFilter,
        searchTerm,
        assignmentSearchTerm,
        assignmentGroupFilter,
        assignmentSubjectFilter,
        assignmentWorkFilter,
        assignmentDeadlineFilter,
        submissionSort,
        deadlineFilter,
        analyticsGroupId,
        assignmentsBankMode,
      })
    );
  }, [
    activeTab,
    assignmentFilter,
    groupFilter,
    statusFilter,
    searchTerm,
    assignmentSearchTerm,
    assignmentGroupFilter,
    assignmentSubjectFilter,
    assignmentWorkFilter,
    assignmentDeadlineFilter,
    submissionSort,
    deadlineFilter,
    analyticsGroupId,
    assignmentsBankMode,
  ]);

  useEffect(() => {
    if (analyticsGroupId === 'all') {
      return;
    }
    const allowed = teachingGroups.some((g) => String(g.id) === String(analyticsGroupId));
    if (!allowed) {
      setAnalyticsGroupId('all');
    }
  }, [analyticsGroupId, teachingGroups]);

  const {
    filteredSubmissions,
    filteredAssignments,
    filteredActiveAssignments,
    filteredCompletedAssignments
  } = useMemo(() => {
    const filteredSubs = [...submissions];
    const filteredAssigns = [...assignments];

    const activeAssignments = filteredAssigns.filter(
      (assignment) => !(assignment.isCompleted || assignment.status === 'archived')
    );
    const completedAssignments = filteredAssigns.filter(
      (assignment) => assignment.isCompleted || assignment.status === 'archived'
    );

    return {
      filteredSubmissions: filteredSubs,
      filteredAssignments: filteredAssigns,
      filteredActiveAssignments: activeAssignments,
      filteredCompletedAssignments: completedAssignments,
    };
  }, [assignments, submissions]);

  const assignmentGroupOptions = useMemo(
    () => buildNormalizedGroupOptions(teacherAvailableGroups),
    [teacherAvailableGroups]
  );

  const submissionAssignmentOptions = useMemo(
    () => buildSubmissionSubjectOptions({
      teacherSubjects: teacherAvailableSubjects,
      analyticsAssignments,
    }),
    [analyticsAssignments, teacherAvailableSubjects]
  );

  const assignmentSubjectOptions = submissionAssignmentOptions;

  const submissionGroupOptions = useMemo(() => assignmentGroupOptions, [assignmentGroupOptions]);

  const filteredBankTemplates = useMemo(() => {
    let list = [...bankTemplates];
    const q = debouncedAssignmentSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.subject?.name || '').toLowerCase().includes(q)
      );
    }
    if (assignmentSubjectFilter !== 'all') {
      list = list.filter((t) => String(t.subjectId) === String(assignmentSubjectFilter));
    }
    return list;
  }, [bankTemplates, debouncedAssignmentSearch, assignmentSubjectFilter]);

  const bankSourceAssignmentIds = useMemo(() => {
    const ids = new Set();
    bankTemplates.forEach((t) => {
      const sid = t.sourceAssignmentId;
      if (sid == null || sid === '') {
        return;
      }
      const n = Number(sid);
      if (!Number.isNaN(n)) {
        ids.add(n);
      }
    });
    return ids;
  }, [bankTemplates]);

  const detailsAssignmentInBank = useMemo(() => {
    if (!detailsAssignment?.id) {
      return false;
    }
    const id = Number(detailsAssignment.id);
    if (Number.isNaN(id)) {
      return false;
    }
    return bankSourceAssignmentIds.has(id);
  }, [detailsAssignment, bankSourceAssignmentIds]);

  useEffect(() => {
    if (assignmentSubjectFilter === 'all') {
      return;
    }

    const hasSelectedSubject = assignmentSubjectOptions.some(
      (subject) => String(subject.id) === String(assignmentSubjectFilter)
    );

    if (!hasSelectedSubject) {
      setAssignmentSubjectFilter('all');
      setAssignmentPage(1);
    }
  }, [assignmentSubjectFilter, assignmentSubjectOptions]);

  useEffect(() => {
    if (assignmentFilter === 'all') {
      return;
    }

    const hasSelectedSubject = submissionAssignmentOptions.some(
      (item) => String(item.id) === String(assignmentFilter)
    );

    if (!hasSelectedSubject) {
      setAssignmentFilter('all');
      setSubmissionPage(1);
    }
  }, [assignmentFilter, submissionAssignmentOptions]);

  useEffect(() => {
    if (groupFilter === 'all') {
      return;
    }

    if (!submissionGroupOptions.includes(groupFilter)) {
      setGroupFilter('all');
      setSubmissionPage(1);
    }
  }, [groupFilter, submissionGroupOptions]);

  const uploadBankTemplateMaterials = async (templateId, materialFiles = [], removedMaterialIds = []) => {
    const files = Array.isArray(materialFiles) ? materialFiles.filter(Boolean) : [];
    const removeIds = Array.isArray(removedMaterialIds) ? removedMaterialIds.filter(Boolean) : [];
    if (!templateId || (files.length === 0 && removeIds.length === 0)) {
      return;
    }

    if (removeIds.length > 0) {
      const removeData = new FormData();
      removeIds.forEach((id) => removeData.append('remove_ids[]', String(id)));
      await api.post(`/assignment-bank/${templateId}/materials`, removeData);
    }

    for (const file of files) {
      const fileData = new FormData();
      fileData.append('files[]', file);
      await api.post(`/assignment-bank/${templateId}/materials`, fileData);
    }
  };

  const handleAddAssignmentToBank = async (assignment) => {
    if (!assignment?.id) return;
    try {
      const { data } = await api.post(`/assignment-bank/from-assignment/${assignment.id}`);
      showSuccess(data?.created === false ? 'Заготовка обновлена в банке заданий' : 'Заготовка добавлена в банк заданий');
      await loadBankTemplates({ silent: true });
    } catch (err) {
      showError(getApiErrorMessage(err, 'Не удалось добавить в банк'));
    }
  };

  const handleEditBankTemplate = (template) => {
    if (!template?.id) {
      return;
    }

    void api.get(`/assignment-bank/${template.id}`)
      .then(({ data }) => {
        setEditingBankTemplate(data?.id ? data : template);
        setShowBankTemplateModal(true);
      })
      .catch(() => {
        setEditingBankTemplate(template);
        setShowBankTemplateModal(true);
      });
  };

  const handleSaveBankTemplate = async (data) => {
    if (!editingBankTemplate?.id) return;
    const templateId = editingBankTemplate.id;
    try {
      await api.put(`/assignment-bank/${templateId}`, {
        title: data.title,
        subjectId: data.subjectId,
        description: data.description,
        submissionType: data.submissionType,
        criteria: (data.criteria || []).map((c) => ({
          text: c.text,
          maxPoints: c.maxPoints,
        })),
        allowedFormats: data.allowedFormats,
      });
      showSuccess('Заготовка сохранена');
      setShowBankTemplateModal(false);
      setEditingBankTemplate(null);

      const files = Array.isArray(data.materialFiles) ? data.materialFiles.filter(Boolean) : [];
      const removeIds = Array.isArray(data.removedMaterialIds) ? data.removedMaterialIds.filter(Boolean) : [];
      if (files.length > 0 || removeIds.length > 0) {
        void uploadBankTemplateMaterials(templateId, files, removeIds)
          .catch((err) => {
            showError(getApiErrorMessage(err, 'Заготовка сохранена, но материалы не загрузились'));
          });
      }

      void loadBankTemplates({ silent: true });
    } catch (err) {
      showError(getApiErrorMessage(err, 'Не удалось сохранить заготовку'));
    }
  };

  const handleRequestDeleteBankTemplate = (template) => {
    setBankTemplateToDelete(template);
    setShowBankDeleteConfirm(true);
  };

  const handleConfirmDeleteBankTemplate = async () => {
    const t = bankTemplateToDelete;
    if (!t?.id) return;
    try {
      await api.delete(`/assignment-bank/${t.id}`);
      showSuccess('Заготовка удалена из банка');
      setBankTemplateToDelete(null);
      setShowBankDeleteConfirm(false);
      await loadBankTemplates();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Не удалось удалить заготовку'));
    }
  };

  const handleCloseBankDeleteModal = () => {
    setShowBankDeleteConfirm(false);
    setBankTemplateToDelete(null);
  };

  const handleOpenPublishBank = (template) => {
    setPublishBankTemplate(template);
    setShowPublishBankModal(true);
  };

  const handleConfirmPublishFromBank = async ({ templateId, deadline, studentGroups }) => {
    setPublishBankSubmitting(true);
    try {
      const result = await publishAssignmentFromBank({ templateId, deadline, studentGroups });
      if (!result.success) {
        showError(result.error);
        return;
      }

      showSuccess('Задание выдано студентам');
      setShowPublishBankModal(false);
      setPublishBankTemplate(null);
    } finally {
      setPublishBankSubmitting(false);
    }
  };

  const handleCreateAssignment = () => {
    setAssignmentFormDraft(null);
    setSelectedAssignment(null);
    setShowAssignmentModal(true);
  };

  const closeAssignmentModal = () => {
    setShowAssignmentModal(false);
    setSelectedAssignment(null);
    setAssignmentFormDraft(null);
  };

  const handleGradeSubmission = (submission) => {
    if (!submission || submission.status === 'returned') {
      return;
    }

    const linkedAssignment = assignments.find((item) => item.id === submission.assignmentId);
    const hasDraftForCurrentSubmission = gradeData.draftSubmissionId === submission.id;

    if (hasDraftForCurrentSubmission && showDetailsModal) {
      setSelectedSubmission(submission);
      setSelectedAssignment(linkedAssignment || null);
      setShowDetailsModal(false);
      setShowGradingModal(true);
      return;
    }

    const assignmentCriteria = Array.isArray(linkedAssignment?.criteria) ? linkedAssignment.criteria : [];
    const savedScores = Array.isArray(submission.criterionScores) ? submission.criterionScores : [];

    const criterionScores = assignmentCriteria.map((criterion, index) => {
      const text = (criterion?.text || '').toString().trim();
      const maxPoints = Number(criterion?.maxPoints ?? 0) || 0;
      const existing = savedScores[index] || savedScores.find((item) => (item?.text || '').toString().trim() === text);
      const receivedPoints = existing?.receivedPoints ?? 0;

      return {
        text,
        maxPoints,
        receivedPoints: Number.isFinite(Number(receivedPoints)) ? Number(receivedPoints) : 0,
      };
    }).filter((criterion) => criterion.text);

    setSelectedSubmission(submission);
    setSelectedAssignment(linkedAssignment || null);
    if (showDetailsModal) {
      setShowDetailsModal(false);
    }
    const isGraded = submission.status === 'graded';
    setGradeData({
      score: isGraded ? String(submission.score ?? '') : '',
      comment: isGraded ? (submission.teacherComment || '') : '',
      criterionScores,
      draftSubmissionId: submission.id,
      useCriteriaScoring: Array.isArray(submission.criterionScores) && submission.criterionScores.length > 0
    });
    setShowGradingModal(true);
  };

  const handleSubmitGrade = async () => {
    const { validateScore, validateGradingComment } = await import('../../utils/teacherHelpers');
    
    const scoreValidation = validateScore(gradeData.score, selectedSubmission.maxScore || 100);
    if (!scoreValidation.isValid) {
      showError(scoreValidation.error);
      return;
    }
    
    const commentValidation = validateGradingComment(gradeData.comment || '');
    if (!commentValidation.isValid) {
      showError(commentValidation.error);
      return;
    }

    const trimmedComment = (gradeData.comment || '').trim();
    const normalizedCriterionScores = Array.isArray(gradeData.criterionScores)
      ? gradeData.criterionScores.map((criterion) => ({
          text: (criterion.text || '').trim(),
          maxPoints: Number(criterion.maxPoints || 0),
          receivedPoints: Number(criterion.receivedPoints || 0),
        })).filter((criterion) => criterion.text)
      : [];

    const result = await gradeSubmission(
      selectedSubmission.id,
      parseInt(gradeData.score),
      trimmedComment,
      gradeData.useCriteriaScoring ? normalizedCriterionScores : []
    );
    if (result.success) {
      loadAnalyticsSnapshot();
      setShowGradingModal(false);
      setSelectedSubmission(null);
      setGradeData({ score: '', comment: '', criterionScores: [], draftSubmissionId: null, useCriteriaScoring: false });
      showSuccess(`Оценка для работы "${selectedSubmission.assignmentTitle}" сохранена!`);
    } else {
      showError(result.error);
    }
  };

  const handleReturnSubmission = (submission) => {
    setInputModalConfig({
      title: 'Возврат работы на доработку',
      message: `Укажите причину возврата и рекомендации по доработке для работы "${submission.assignmentTitle}":`,
      placeholder: 'Введите комментарий...',
      defaultValue: '',
      multiline: true,
      rows: 6,
      onSubmit: async (comment) => {
        if (comment && comment.trim()) {
          const result = await returnSubmission(submission.id, comment);
          if (result.success) {
            loadAnalyticsSnapshot();
            showSuccess(`Работа "${submission.assignmentTitle}" возвращена студенту на доработку`);
          } else {
            showError(result.error);
          }
        }
      }
    });
    setShowInputModal(true);
  };

  const handleDownloadFile = async (submission) => {
    if (!submission?.id) {
      showError('Файл для скачивания не найден');
      return;
    }

    try {
      const response = await api.get(`/submissions/${submission.id}/download`, {
        responseType: 'blob',
      });

      const blob = response.data;
      const objectUrl = URL.createObjectURL(blob);
      const fileName = submission.fileName || 'файл_работы';

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      showInfo(`Начато скачивание файла: ${fileName}`);
    } catch (error) {
      showError('Не удалось скачать файл. Проверьте доступность файла и повторите попытку.');
    }
  };

  const handleDownloadAssignmentMaterial = async (assignment, material) => {
    if (!assignment?.id || !material?.id) {
      showError('Материал не найден');
      return;
    }

    try {
      await downloadAssignmentMaterial(api, assignment.id, material);
    } catch (error) {
      if (error instanceof DownloadCancelledError || error?.name === 'AbortError') {
        return;
      }
      showError(getApiErrorMessage(error, 'Не удалось сохранить материал. Попробуйте ещё раз.'));
      throw error;
    }
  };

  const handleViewDetails = (submission) => {
    setSelectedSubmission(submission);  
    const relatedAssignment = assignments.find(a => a.id === submission.assignmentId);
    setSelectedAssignment(relatedAssignment);
    setShowDetailsModal(true);
  };

  const handleViewSubmissions = (assignmentOrId) => {
    const relatedAssignment = assignmentOrId && typeof assignmentOrId === 'object'
      ? assignmentOrId
      : assignments.find((assignment) => Number(assignment.id) === Number(assignmentOrId));

    // Показываем ровно работы выбранного задания: фильтр по assignment_id + все статусы.
    setPinnedAssignment(
      relatedAssignment
        ? { id: relatedAssignment.id, title: relatedAssignment.title }
        : null
    );
    setSearchTerm('');
    setGroupFilter('all');
    setAssignmentFilter('all');
    setStatusFilter('all');
    setDeadlineFilter('all');
    setSubmissionSort('review_queue');
    setSubmissionPage(1);
    handleTabChange('submissions');
  };

  const handleViewSubmissionsFromDetails = (assignment) => {
    if (!assignment?.id) return;
    handleCloseAssignmentDetails();
    handleViewSubmissions(
      assignment,
      isCompletedAssignment(assignment) ? 'graded' : DEFAULT_SUBMISSION_STATUS_FILTER
    );
  };

  const handleViewAssignmentDetails = (assignment) => {
    setDetailsAssignment(normalizeAssignment(assignment));
    setShowAssignmentDetails(true);
    if (assignment?.id) {
      void api.get(`/assignments/${assignment.id}`)
        .then(({ data }) => {
          setDetailsAssignment((prev) => (
            Number(prev?.id) === Number(assignment.id)
              ? normalizeAssignment({ ...prev, ...data })
              : prev
          ));
        })
        .catch(() => {});
    }
  };

  const handleCloseAssignmentDetails = () => {
    setDetailsAssignment(null);
    setShowAssignmentDetails(false);
  };

  const handleEditAssignmentFromDetails = (assignment) => {
    if (!assignment || isCompletedAssignment(assignment)) return;
    setDetailsAssignment(null);
    setShowAssignmentDetails(false);
    setSelectedAssignment(normalizeAssignment(assignment));
    setShowAssignmentModal(true);
    if (assignment.id) {
      void api.get(`/assignments/${assignment.id}`)
        .then(({ data }) => {
          setSelectedAssignment((prev) => (
            Number(prev?.id) === Number(assignment.id)
              ? normalizeAssignment({ ...prev, ...data })
              : prev
          ));
        })
        .catch(() => {});
    }
  };

  const handleBackToDetailsFromEdit = (draftData) => {
    if (selectedAssignment) {
      setAssignmentFormDraft({
        assignmentId: selectedAssignment.id,
        data: draftData,
      });
      setDetailsAssignment(selectedAssignment);
      setShowAssignmentDetails(true);
    }
    setShowAssignmentModal(false);
  };

  const handleRequestDeleteAssignment = (assignment) => {
    setAssignmentToDelete(assignment);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteAssignment = async () => {
    const assignment = assignmentToDelete;
    if (!assignment) return;

    const result = await deleteAssignment(assignment.id);
    if (result.success) {
      loadAnalyticsSnapshot();
      showSuccess(`Задание "${assignment.title}" удалено`);
    } else {
      showError(result.error);
    }
    setAssignmentToDelete(null);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirm(false);
    setAssignmentToDelete(null);
  };

  const handleSaveAssignment = async (assignmentData) => {
    const result = selectedAssignment
      ? await updateAssignment(selectedAssignment.id, {
          ...assignmentData,
          id: selectedAssignment.id
        })
      : await createAssignment(assignmentData);
    if (result.success) {
      setAssignmentFormDraft(null);
      closeAssignmentModal();
      showSuccess(selectedAssignment ? 'Задание обновлено!' : 'Задание успешно создано!');
      if (analyticsLoaded) {
        void loadAnalyticsSnapshot();
      }
    } else {
      showError(result.error);
    }
  };

  if (loading && assignments.length === 0) {
    return <LoadingState message="Загрузка дашборда..." />;
  }

  if (error) {
    return (
      <ErrorBanner
        title="Ошибка загрузки"
        message={error}
        actionLabel="Повторить попытку"
        onAction={handleRetryLoad}
      />
    );
  }

  return (
    <div className="teacher-dashboard app-page">
      <PageShell contentClassName="teacher-dashboard__content">
        <DashboardHeader
          user={user}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        <DashboardContent
          activeTab={activeTab}
          assignments={filteredAssignments}
          activeAssignments={filteredActiveAssignments}
          completedAssignments={filteredCompletedAssignments}
          filteredSubmissions={filteredSubmissions}
          analyticsAssignments={analyticsAssignments}
          analyticsSubmissions={analyticsSubmissions}
          submissionAssignmentOptions={submissionAssignmentOptions}
          assignmentFilter={assignmentFilter}
          groupFilter={groupFilter}
          statusFilter={statusFilter}
          searchTerm={searchTerm}
          assignmentSearchTerm={assignmentSearchTerm}
          assignmentGroupFilter={assignmentGroupFilter}
          assignmentSubjectFilter={assignmentSubjectFilter}
          assignmentWorkFilter={assignmentWorkFilter}
          assignmentDeadlineFilter={assignmentDeadlineFilter}
          assignmentGroupOptions={assignmentGroupOptions}
          assignmentSubjectOptions={assignmentSubjectOptions}
          submissionGroupOptions={submissionGroupOptions}
          assignmentsMeta={assignmentsMeta}
          submissionsMeta={submissionsMeta}
          onAssignmentFilterChange={(value) => {
            setAssignmentFilter(value);
            setSubmissionPage(1);
          }}
          onGroupFilterChange={(value) => {
            setGroupFilter(value);
            setSubmissionPage(1);
          }}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            setSubmissionPage(1);
          }}
          onSearchChange={(value) => {
            setSearchTerm(value);
            setSubmissionPage(1);
          }}
          onAssignmentSearchChange={(value) => {
            setAssignmentSearchTerm(value);
            setAssignmentPage(1);
          }}
          onAssignmentGroupFilterChange={(value) => {
            setAssignmentGroupFilter(value);
            setAssignmentPage(1);
          }}
          onAssignmentSubjectFilterChange={(value) => {
            setAssignmentSubjectFilter(value);
            setAssignmentPage(1);
          }}
          onAssignmentWorkFilterChange={(value) => {
            setAssignmentWorkFilter(value);
            setAssignmentPage(1);
          }}
          onAssignmentDeadlineFilterChange={(value) => {
            setAssignmentDeadlineFilter(value);
            setAssignmentPage(1);
          }}
          onResetAssignmentFilters={handleResetAssignmentFilters}
          onResetSubmissionFilters={handleResetSubmissionFilters}
          assignmentFiltersResetDisabled={assignmentFiltersResetDisabled}
          submissionFiltersResetDisabled={submissionFiltersResetDisabled}
          pinnedAssignment={pinnedAssignment}
          onClearPinnedAssignment={() => {
            setPinnedAssignment(null);
            setSubmissionPage(1);
          }}
          onPrevAssignmentsPage={() => setAssignmentPage((prev) => Math.max(1, prev - 1))}
          onNextAssignmentsPage={() => setAssignmentPage((prev) => prev + 1)}
          onPrevSubmissionsPage={() => setSubmissionPage((prev) => Math.max(1, prev - 1))}
          onNextSubmissionsPage={() => setSubmissionPage((prev) => prev + 1)}
          onCreateAssignment={handleCreateAssignment}
          onViewSubmissions={handleViewSubmissions}
          onViewAssignmentDetails={handleViewAssignmentDetails}
          onDeleteAssignment={handleRequestDeleteAssignment}
          onGradeSubmission={handleGradeSubmission}
          onReturnSubmission={handleReturnSubmission}
          onDownloadFile={handleDownloadFile}
          onViewDetails={handleViewDetails}
          deadlineFilter={deadlineFilter}
          onDeadlineFilterChange={(value) => {
            setDeadlineFilter(value);
            setSubmissionPage(1);
          }}
          submissionSort={submissionSort}
          onSubmissionSortChange={(value) => {
            setSubmissionSort(value);
            setSubmissionPage(1);
          }}
          submissionsTabBusy={submissionsTabBusy}
          teachingGroups={teachingGroups}
          analyticsGroupId={analyticsGroupId}
          onAnalyticsGroupChange={setAnalyticsGroupId}
          analyticsSnapshotLoading={analyticsSnapshotLoading}
          assignmentsBankMode={assignmentsBankMode}
          onToggleAssignmentsBankMode={setAssignmentsBankMode}
          filteredBankTemplates={filteredBankTemplates}
          bankLoading={bankLoading}
          onEditBankTemplate={handleEditBankTemplate}
          onDeleteBankTemplate={handleRequestDeleteBankTemplate}
          onPublishBankTemplate={handleOpenPublishBank}
        />
      </PageShell>

      <GradingModal
        submission={selectedSubmission}
        assignment={selectedSubmission ? assignments.find(a => a.id === selectedSubmission.assignmentId) : null}
        isOpen={showGradingModal}
        onClose={() => {
          setShowGradingModal(false);
          setSelectedSubmission(null);
          setGradeData({ score: '', comment: '', criterionScores: [], draftSubmissionId: null, useCriteriaScoring: false });
        }}
        onBackToDetails={() => {
          setShowGradingModal(false);
          setShowDetailsModal(true);
        }}
        gradeData={gradeData}
        onGradeDataChange={setGradeData}
        onSubmit={handleSubmitGrade}
      />

      <AssignmentModal
        assignment={selectedAssignment}
        isOpen={showAssignmentModal}
        onClose={closeAssignmentModal}
        onBack={handleBackToDetailsFromEdit}
        onSubmit={handleSaveAssignment}
        availableGroups={teacherAvailableGroups}
        availableSubjects={teacherAvailableSubjects}
        teachingLoadPairs={teachingLoadPairs}
        initialFormData={
          selectedAssignment && assignmentFormDraft?.assignmentId === selectedAssignment.id
            ? assignmentFormDraft.data
            : null
        }
      />

      <AssignmentModal
        assignment={editingBankTemplate}
        isOpen={showBankTemplateModal}
        onClose={() => {
          setShowBankTemplateModal(false);
          setEditingBankTemplate(null);
        }}
        onSubmit={handleSaveBankTemplate}
        availableGroups={teacherAvailableGroups}
        availableSubjects={teacherAvailableSubjects}
        teachingLoadPairs={teachingLoadPairs}
        modalMode="bankTemplate"
      />

      <PublishFromBankModal
        isOpen={showPublishBankModal}
        template={publishBankTemplate}
        availableGroups={teacherAvailableGroups}
        teachingLoadPairs={teachingLoadPairs}
        onClose={() => {
          setShowPublishBankModal(false);
          setPublishBankTemplate(null);
        }}
        onConfirm={handleConfirmPublishFromBank}
        isSubmitting={publishBankSubmitting}
      />

      <AssignmentDetailsModal
        assignment={detailsAssignment}
        isOpen={showAssignmentDetails}
        onClose={handleCloseAssignmentDetails}
        mode="teacher"
        stats={detailsAssignment ? calculateSubmissionStats(detailsAssignment.submissions || [], detailsAssignment) : null}
        onEdit={detailsAssignment && !isCompletedAssignment(detailsAssignment) ? handleEditAssignmentFromDetails : null}
        onViewSubmissions={handleViewSubmissionsFromDetails}
        onDownloadMaterial={handleDownloadAssignmentMaterial}
        onAddToBank={handleAddAssignmentToBank}
        assignmentAlreadyInBank={detailsAssignmentInBank}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDeleteAssignment}
        title="Удалить задание?"
        message={
          assignmentToDelete
            ? `Вы уверены, что хотите удалить задание "${assignmentToDelete.title}"? Связанные сдачи также будут удалены.`
            : 'Вы уверены, что хотите удалить задание?'
        }
        confirmText="Удалить"
        danger
      />

      <ConfirmModal
        isOpen={showBankDeleteConfirm}
        onClose={handleCloseBankDeleteModal}
        onConfirm={handleConfirmDeleteBankTemplate}
        title="Удалить заготовку?"
        message={
          bankTemplateToDelete
            ? `Удалить «${bankTemplateToDelete.title}» из банка? Выданные ранее задания не затронутся.`
            : 'Удалить заготовку из банка?'
        }
        confirmText="Удалить"
        danger
      />

      <SubmissionDetailsModal
        submission={selectedSubmission}
        assignment={selectedAssignment}
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedSubmission(null);
          setSelectedAssignment(null);
          setGradeData({ score: '', comment: '', criterionScores: [], draftSubmissionId: null, useCriteriaScoring: false });
        }}
        onDownload={handleDownloadFile}
        onGrade={handleGradeSubmission}
        onReturn={handleReturnSubmission}
      />

      {inputModalConfig && (
        <InputModal
          isOpen={showInputModal}
          onClose={() => {
            setShowInputModal(false);
            setInputModalConfig(null);
          }}
          onSubmit={inputModalConfig.onSubmit}
          title={inputModalConfig.title}
          message={inputModalConfig.message}
          placeholder={inputModalConfig.placeholder}
          defaultValue={inputModalConfig.defaultValue}
          multiline={inputModalConfig.multiline}
          rows={inputModalConfig.rows}
        />
      )}
    </div>
  );
};

const DashboardContent = ({
  activeTab,
  assignments,
  activeAssignments,
  completedAssignments,
  filteredSubmissions,
  analyticsAssignments,
  analyticsSubmissions,
  submissionAssignmentOptions,
  assignmentFilter,
  groupFilter,
  statusFilter,
  searchTerm,
  assignmentSearchTerm,
  assignmentGroupFilter,
  assignmentSubjectFilter,
  assignmentWorkFilter,
  assignmentDeadlineFilter,
  assignmentGroupOptions,
  assignmentSubjectOptions,
  submissionGroupOptions,
  assignmentsMeta,
  submissionsMeta,
  onAssignmentFilterChange,
  onGroupFilterChange,
  onStatusFilterChange,
  onSearchChange,
  onAssignmentSearchChange,
  onAssignmentGroupFilterChange,
  onAssignmentSubjectFilterChange,
  onAssignmentWorkFilterChange,
  onAssignmentDeadlineFilterChange,
  onResetAssignmentFilters,
  onResetSubmissionFilters,
  assignmentFiltersResetDisabled = false,
  submissionFiltersResetDisabled = false,
  pinnedAssignment = null,
  onClearPinnedAssignment,
  onPrevAssignmentsPage,
  onNextAssignmentsPage,
  onPrevSubmissionsPage,
  onNextSubmissionsPage,
  onCreateAssignment,
  onViewSubmissions,
  onViewAssignmentDetails,
  onDeleteAssignment,
  onGradeSubmission,
  onReturnSubmission,
  onDownloadFile,
  onViewDetails,
  deadlineFilter,
  onDeadlineFilterChange,
  submissionSort,
  onSubmissionSortChange,
  submissionsTabBusy = false,
  teachingGroups = [],
  analyticsGroupId = 'all',
  onAnalyticsGroupChange,
  analyticsSnapshotLoading = false,
  assignmentsBankMode = false,
  onToggleAssignmentsBankMode,
  filteredBankTemplates = [],
  bankLoading = false,
  onEditBankTemplate,
  onDeleteBankTemplate,
  onPublishBankTemplate,
}) => {
  const renderSection = () => {
    switch (activeTab) {
      case 'assignments':
        return (
          <AssignmentsSection
            activeAssignments={activeAssignments}
            searchTerm={assignmentSearchTerm}
            groupFilter={assignmentGroupFilter}
            workFilter={assignmentWorkFilter}
            deadlineFilter={assignmentDeadlineFilter}
            availableGroups={assignmentGroupOptions}
            subjectFilter={assignmentSubjectFilter}
            availableSubjects={assignmentSubjectOptions}
            onSearchChange={onAssignmentSearchChange}
            onGroupFilterChange={onAssignmentGroupFilterChange}
            onSubjectFilterChange={onAssignmentSubjectFilterChange}
            onWorkFilterChange={onAssignmentWorkFilterChange}
            onDeadlineFilterChange={onAssignmentDeadlineFilterChange}
            onResetFilters={onResetAssignmentFilters}
            filtersResetDisabled={assignmentFiltersResetDisabled}
            paginationMeta={assignmentsMeta}
            onPrevPage={onPrevAssignmentsPage}
            onNextPage={onNextAssignmentsPage}
            onCreateAssignment={onCreateAssignment}
            onViewSubmissions={onViewSubmissions}
            onViewDetails={onViewAssignmentDetails}
            onDeleteAssignment={onDeleteAssignment}
            assignmentsBankMode={assignmentsBankMode}
            onToggleAssignmentsBankMode={onToggleAssignmentsBankMode}
            filteredBankTemplates={filteredBankTemplates}
            bankLoading={bankLoading}
            onEditBankTemplate={onEditBankTemplate}
            onDeleteBankTemplate={onDeleteBankTemplate}
            onPublishBankTemplate={onPublishBankTemplate}
          />
        );

      case 'completed':
        return (
          <CompletedAssignmentsSection
            completedAssignments={completedAssignments}
            searchTerm={assignmentSearchTerm}
            groupFilter={assignmentGroupFilter}
            deadlineFilter={assignmentDeadlineFilter}
            availableGroups={assignmentGroupOptions}
            subjectFilter={assignmentSubjectFilter}
            availableSubjects={assignmentSubjectOptions}
            onSearchChange={onAssignmentSearchChange}
            onGroupFilterChange={onAssignmentGroupFilterChange}
            onSubjectFilterChange={onAssignmentSubjectFilterChange}
            onDeadlineFilterChange={onAssignmentDeadlineFilterChange}
            onResetFilters={onResetAssignmentFilters}
            filtersResetDisabled={assignmentFiltersResetDisabled}
            paginationMeta={assignmentsMeta}
            onPrevPage={onPrevAssignmentsPage}
            onNextPage={onNextAssignmentsPage}
            onViewSubmissions={onViewSubmissions}
            onViewDetails={onViewAssignmentDetails}
            onDeleteAssignment={onDeleteAssignment}
          />
        );
      
      case 'submissions':
        return (
          <SubmissionsSection
            submissions={filteredSubmissions}
            assignmentOptions={submissionAssignmentOptions}
            assignmentFilter={assignmentFilter}
            groupFilter={groupFilter}
            statusFilter={statusFilter}
            searchTerm={searchTerm}
            availableGroups={submissionGroupOptions}
            onAssignmentFilterChange={onAssignmentFilterChange}
            onGroupFilterChange={onGroupFilterChange}
            onStatusFilterChange={onStatusFilterChange}
            onSearchChange={onSearchChange}
            onResetFilters={onResetSubmissionFilters}
            filtersResetDisabled={submissionFiltersResetDisabled}
            pinnedAssignment={pinnedAssignment}
            onClearPinnedAssignment={onClearPinnedAssignment}
            paginationMeta={submissionsMeta}
            onPrevPage={onPrevSubmissionsPage}
            onNextPage={onNextSubmissionsPage}
            onGradeSubmission={onGradeSubmission}
            onReturnSubmission={onReturnSubmission}
            onDownloadFile={onDownloadFile}
            onViewDetails={onViewDetails}
            deadlineFilter={deadlineFilter}
            onDeadlineFilterChange={onDeadlineFilterChange}
            submissionSort={submissionSort}
            onSubmissionSortChange={onSubmissionSortChange}
            submissionsBusy={submissionsTabBusy}
          />
        );
      
      case 'analytics':
        return (
          <AnalyticsSection
            submissions={analyticsSubmissions}
            assignments={analyticsAssignments}
            groupOptions={teachingGroups}
            selectedGroupId={analyticsGroupId}
            onGroupChange={onAnalyticsGroupChange}
            loading={analyticsSnapshotLoading}
          />
        );
      
      case 'students':
        return <TeacherStudentsSection />;

      case 'disciplines':
        return <TeacherDisciplinesSection />;
      
      default:
        return null;
    }
  };

  return <div className="dashboard-content">{renderSection()}</div>;
};

const ASSIGNMENT_QUICK_FILTERS = [
  { value: 'all', label: 'Все работы' },
  { value: 'needs_review', label: 'Нужна проверка' },
  { value: 'no_submissions', label: 'Без сдач' },
  { value: 'all_reviewed', label: 'Все проверены' },
];

const ASSIGNMENT_DEADLINE_FILTERS = [
  { value: 'all', label: 'Все сроки' },
  { value: 'overdue', label: 'Просроченные' },
  { value: 'due_3d', label: 'Скоро дедлайн' },
  { value: 'due_week', label: 'На неделе' },
  { value: 'not_urgent', label: 'Без срочности' },
];

const AssignmentQuickFilters = ({ label, value = 'all', onChange, options }) => (
  <div className="assignment-quick-filters" aria-label={label}>
    {options.map((filter) => (
      <button
        key={filter.value}
        type="button"
        className={`assignment-quick-filters__chip${value === filter.value ? ' is-active' : ''}`}
        onClick={() => onChange?.(filter.value)}
        aria-pressed={value === filter.value}
      >
        {filter.label}
      </button>
    ))}
  </div>
);

const AssignmentsSection = ({
  activeAssignments,
  searchTerm,
  groupFilter,
  workFilter,
  deadlineFilter,
  availableGroups,
  subjectFilter,
  availableSubjects,
  onSearchChange,
  onGroupFilterChange,
  onSubjectFilterChange,
  onWorkFilterChange,
  onDeadlineFilterChange,
  onResetFilters,
  paginationMeta = {},
  onPrevPage,
  onNextPage,
  onCreateAssignment,
  onViewSubmissions,
  onViewDetails,
  onDeleteAssignment,
  assignmentsBankMode = false,
  onToggleAssignmentsBankMode,
  filteredBankTemplates = [],
  bankLoading = false,
  onEditBankTemplate,
  onDeleteBankTemplate,
  onPublishBankTemplate,
  filtersResetDisabled = false,
}) => (
  <div className="assignments-section">
    <div className="section-header">
      <h2>{assignmentsBankMode ? 'Банк заданий' : 'Учебные задания'}</h2>
      <div className="section-header__actions">
        <Button
          type="button"
          variant={assignmentsBankMode ? 'primary' : 'secondary'}
          onClick={() => onToggleAssignmentsBankMode?.(!assignmentsBankMode)}
        >
          {assignmentsBankMode ? 'Мои задания' : 'Банк заданий'}
        </Button>
        {!assignmentsBankMode && (
          <Button variant="primary" onClick={onCreateAssignment}>
            + Создать задание
          </Button>
        )}
      </div>
    </div>

    <div className="filters-section">
      <div className="teacher-dashboard-filter-row teacher-dashboard-filter-row--unified">
        <DashboardFilterToolbar
          popoverAlign="end"
          searchValue={searchTerm}
          onSearchChange={onSearchChange}
          searchPlaceholder={
            assignmentsBankMode
              ? 'Поиск по названию, описанию или дисциплине…'
              : 'Поиск по названию или дисциплине…'
          }
          searchInputType="text"
          searchBoxClassName="search-box teacher-dashboard-filter-search"
          onReset={onResetFilters}
          resetDisabled={filtersResetDisabled}
          popoverAriaLabel="Фильтры заданий"
        >
          {!assignmentsBankMode && (
            <div className="filter-popover__field">
              <label className="filter-popover__label" htmlFor="teacher-assignment-group-filter">
                Группа
              </label>
              <select
                id="teacher-assignment-group-filter"
                value={groupFilter}
                onChange={(e) => onGroupFilterChange(e.target.value)}
                className="filter-select"
              >
                <option value="all">Все группы</option>
                {availableGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="filter-popover__field">
            <label className="filter-popover__label" htmlFor="teacher-assignment-subject-filter">
              Дисциплина
            </label>
            <select
              id="teacher-assignment-subject-filter"
              value={subjectFilter}
              onChange={(e) => onSubjectFilterChange(e.target.value)}
              className="filter-select"
            >
              <option value="all">Все дисциплины</option>
              {availableSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
              ))}
            </select>
          </div>
          {!assignmentsBankMode && (
            <div className="filter-popover__field">
              <label className="filter-popover__label" htmlFor="teacher-assignment-deadline-filter">
                Срок
              </label>
              <select
                id="teacher-assignment-deadline-filter"
                value={deadlineFilter}
                onChange={(e) => onDeadlineFilterChange(e.target.value)}
                className="filter-select"
              >
                {ASSIGNMENT_DEADLINE_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </DashboardFilterToolbar>
      </div>
      {!assignmentsBankMode && (
        <div className="assignment-quick-filter-groups">
          <AssignmentQuickFilters
            label="Фильтр заданий по работам"
            value={workFilter}
            onChange={onWorkFilterChange}
            options={ASSIGNMENT_QUICK_FILTERS}
          />
        </div>
      )}
    </div>

    {assignmentsBankMode ? (
      bankLoading ? (
        <LoadingState message="Загрузка банка..." />
      ) : filteredBankTemplates.length > 0 ? (
        <div className="assignments-grid app-reveal-stagger">
          {filteredBankTemplates.map((template) => (
            <AssignmentBankCard
              key={template.id}
              template={template}
              onOpenTemplate={onEditBankTemplate}
              onDelete={onDeleteBankTemplate}
              onPublish={onPublishBankTemplate}
            />
          ))}
        </div>
      ) : (
        <EmptyState message="В банке пока нет заготовок. Добавьте задание через детали задания." />
      )
    ) : activeAssignments.length > 0 ? (
      <div className="assignments-grid app-reveal-stagger">
        {activeAssignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            onViewSubmissions={() => onViewSubmissions(assignment)}
            onViewDetails={() => onViewDetails && onViewDetails(assignment)}
            onDeleteAssignment={onDeleteAssignment ? () => onDeleteAssignment(assignment) : undefined}
          />
        ))}
      </div>
    ) : (
      <EmptyState message="Нет активных заданий по текущим фильтрам" />
    )}
    {!assignmentsBankMode && (
      <Pagination
        currentPage={paginationMeta.currentPage}
        lastPage={paginationMeta.lastPage}
        total={paginationMeta.total}
        fallbackCount={activeAssignments.length}
        onPrev={onPrevPage}
        onNext={onNextPage}
      />
    )}
  </div>
);

const CompletedAssignmentsSection = ({
  completedAssignments,
  searchTerm,
  groupFilter,
  deadlineFilter,
  availableGroups,
  subjectFilter,
  availableSubjects,
  onSearchChange,
  onGroupFilterChange,
  onSubjectFilterChange,
  onDeadlineFilterChange,
  onResetFilters,
  paginationMeta = {},
  onPrevPage,
  onNextPage,
  onViewSubmissions,
  onViewDetails,
  onDeleteAssignment,
  filtersResetDisabled = false,
}) => (
  <div className="assignments-section">
    <div className="section-header">
      <h2>Завершенные задания</h2>
    </div>

    <div className="filters-section">
      <div className="teacher-dashboard-filter-row teacher-dashboard-filter-row--unified">
        <DashboardFilterToolbar
          popoverAlign="end"
          searchValue={searchTerm}
          onSearchChange={onSearchChange}
          searchPlaceholder="Поиск по названию, описанию или дисциплине…"
          searchInputType="text"
          searchBoxClassName="search-box teacher-dashboard-filter-search"
          onReset={onResetFilters}
          resetDisabled={filtersResetDisabled}
          popoverAriaLabel="Фильтры завершённых заданий"
        >
          <div className="filter-popover__field">
            <label className="filter-popover__label" htmlFor="teacher-completed-group-filter">
              Группа
            </label>
            <select
              id="teacher-completed-group-filter"
              value={groupFilter}
              onChange={(e) => onGroupFilterChange(e.target.value)}
              className="filter-select"
            >
              <option value="all">Все группы</option>
              {availableGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-popover__field">
            <label className="filter-popover__label" htmlFor="teacher-completed-subject-filter">
              Дисциплина
            </label>
            <select
              id="teacher-completed-subject-filter"
              value={subjectFilter}
              onChange={(e) => onSubjectFilterChange(e.target.value)}
              className="filter-select"
            >
              <option value="all">Все дисциплины</option>
              {availableSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-popover__field">
            <label className="filter-popover__label" htmlFor="teacher-completed-deadline-filter">
              Срок
            </label>
            <select
              id="teacher-completed-deadline-filter"
              value={deadlineFilter}
              onChange={(e) => onDeadlineFilterChange(e.target.value)}
              className="filter-select"
            >
              {ASSIGNMENT_DEADLINE_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </DashboardFilterToolbar>
      </div>
    </div>

    {completedAssignments.length > 0 ? (
      <div className="assignments-grid app-reveal-stagger">
        {completedAssignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            onViewSubmissions={() => onViewSubmissions(assignment, 'graded')}
            onViewDetails={() => onViewDetails && onViewDetails(assignment)}
            onDeleteAssignment={onDeleteAssignment ? () => onDeleteAssignment(assignment) : undefined}
          />
        ))}
      </div>
    ) : (
      <EmptyState message="Нет завершенных заданий по текущим фильтрам" />
    )}
    <Pagination
      currentPage={paginationMeta.currentPage}
      lastPage={paginationMeta.lastPage}
      total={paginationMeta.total}
      fallbackCount={completedAssignments.length}
      onPrev={onPrevPage}
      onNext={onNextPage}
    />
  </div>
);

const SubmissionsSection = ({
  submissions,
  assignmentOptions = [],
  assignmentFilter,
  groupFilter,
  statusFilter,
  searchTerm,
  availableGroups,
  onAssignmentFilterChange,
  onGroupFilterChange,
  onStatusFilterChange,
  onSearchChange,
  onResetFilters,
  pinnedAssignment = null,
  onClearPinnedAssignment,
  paginationMeta = {},
  onPrevPage,
  onNextPage,
  onGradeSubmission,
  onReturnSubmission,
  onDownloadFile,
  onViewDetails,
  deadlineFilter = 'all',
  onDeadlineFilterChange,
  submissionSort = 'review_queue',
  onSubmissionSortChange,
  submissionsBusy = false,
  filtersResetDisabled = false,
}) => (
  <div className="submissions-section">
    <div className="section-header teacher-submissions-header">
      <h2>Работы студентов</h2>
      <div className="teacher-submissions-filters" aria-busy={submissionsBusy}>
        <div className="teacher-submissions-search-row teacher-dashboard-filter-row teacher-dashboard-filter-row--unified">
          <DashboardFilterToolbar
            popoverAlign="end"
            searchValue={searchTerm}
            onSearchChange={onSearchChange}
            searchPlaceholder="Поиск по студенту, заданию или группе…"
            searchInputType="text"
            searchBoxClassName="teacher-submissions-search-box teacher-dashboard-filter-search"
            searchInputClassName="teacher-submissions-search-input"
            searchDisabled={submissionsBusy}
            onReset={onResetFilters}
            popoverAriaLabel="Фильтры работ студентов"
            disabled={submissionsBusy}
            resetDisabled={filtersResetDisabled}
          >
            <div className="filter-popover__field">
              <label className="filter-popover__label" htmlFor="teacher-submissions-assignment-filter">
                Дисциплина
              </label>
              <select
                id="teacher-submissions-assignment-filter"
                value={assignmentFilter}
                onChange={(e) => onAssignmentFilterChange(e.target.value)}
                className="teacher-submissions-select"
                disabled={submissionsBusy}
                aria-disabled={submissionsBusy}
              >
                <option value="all">Все дисциплины</option>
                {assignmentOptions.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-popover__field">
              <label className="filter-popover__label" htmlFor="teacher-submissions-group-filter">
                Группа
              </label>
              <SearchableSelect
                value={groupFilter === 'all' ? '' : groupFilter}
                onChange={(value) => onGroupFilterChange(value || 'all')}
                options={availableGroups.map((group) => ({ value: group, label: group }))}
                placeholder="Все группы"
                searchPlaceholder="Найти группу…"
                ariaLabel="Фильтр по группе"
                disabled={submissionsBusy}
                className="teacher-submissions-group-select"
              />
            </div>
            <div className="filter-popover__field">
              <label className="filter-popover__label" htmlFor="teacher-submissions-status-filter">
                Статус
              </label>
              <select
                id="teacher-submissions-status-filter"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                className="teacher-submissions-select"
                disabled={submissionsBusy}
                aria-disabled={submissionsBusy}
              >
                <option value="all">Все</option>
                <option value="submitted">На проверке</option>
                <option value="returned">Возвращены на доработку</option>
                <option value="graded">Зачтены</option>
              </select>
            </div>
            <div className="filter-popover__field">
              <label className="filter-popover__label" htmlFor="teacher-submissions-deadline-filter">
                Срок
              </label>
              <select
                id="teacher-submissions-deadline-filter"
                value={deadlineFilter}
                onChange={(e) => onDeadlineFilterChange?.(e.target.value)}
                className="teacher-submissions-select"
                title="По календарному дедлайну задания. Просроченные: на проверке или возвращённые при истёкшем сроке, а также зачтённые, но сданные после дедлайна; зачтённые в срок скрываются."
                disabled={submissionsBusy}
                aria-disabled={submissionsBusy}
              >
                <option value="all">Все сроки заданий</option>
                <option value="overdue">Просроченный дедлайн</option>
                <option value="due_3d">Дедлайн в 3 дня</option>
                <option value="due_week">Дедлайн на неделе</option>
              </select>
            </div>
          </DashboardFilterToolbar>
        </div>
        {submissionsBusy && (
          <p className="teacher-submissions-loading-note" role="status" aria-live="polite">
            Обновляем данные по фильтрам…
          </p>
        )}
      </div>
    </div>

    {pinnedAssignment && (
      <div className="submissions-pinned-assignment" role="status">
        <span className="submissions-pinned-assignment__label">
          Задание: <strong>{pinnedAssignment.title}</strong>
        </span>
        <button
          type="button"
          className="submissions-pinned-assignment__clear"
          onClick={onClearPinnedAssignment}
          disabled={submissionsBusy}
          aria-label="Сбросить фильтр по заданию"
        >
          ✕
        </button>
      </div>
    )}

    <div className={`submissions-section__main${submissionsBusy ? ' submissions-section__main--busy' : ''}`}>
      <SubmissionsTable
        submissions={submissions}
        assignments={assignmentOptions}
        onGradeSubmission={onGradeSubmission}
        onReturnSubmission={onReturnSubmission}
        onDownloadFile={onDownloadFile}
        onViewDetails={onViewDetails}
        useServerSort
        serverSortKey={submissionSort}
        onServerSortChange={onSubmissionSortChange}
        loading={submissionsBusy}
      />
      <Pagination
        currentPage={paginationMeta.currentPage}
        lastPage={paginationMeta.lastPage}
        total={paginationMeta.total}
        fallbackCount={submissions.length}
        onPrev={onPrevPage}
        onNext={onNextPage}
        disabled={submissionsBusy}
      />
      {submissionsBusy && (
        <div
          className="submissions-section__loading-overlay"
          role="status"
          aria-live="polite"
          aria-label="Загрузка списка работ"
        >
          <div className="submissions-section__spinner" />
          <span>Обновляем список работ…</span>
        </div>
      )}
    </div>
  </div>
);

export default TeacherDashboard;