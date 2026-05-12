import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardHeader from '../../components/Student/DashboardHeader/DashboardHeader';
import AssignmentCard from '../../components/Student/AssignmentCard/AssignmentCard';
import SubmissionModal from '../../components/Student/SubmissionModal/SubmissionModal';
import ResultsModal from '../../components/Student/ResultsModal/ResultsModal';
import PageShell from '../../components/UI/PageShell/PageShell';
import LoadingState from '../../components/UI/LoadingState/LoadingState';
import EmptyState from '../../components/UI/EmptyState/EmptyState';
import ErrorBanner from '../../components/UI/ErrorBanner/ErrorBanner';
import AssignmentDetailsModal from '../../components/Shared/AssignmentDetailsModal/AssignmentDetailsModal';
import Pagination from '../../components/UI/Pagination/Pagination';
import { useAuth } from '../../context/AuthContext';
import { useStudent, normalizeStudentAssignment } from '../../context/StudentContext';
import { useNotification } from '../../context/NotificationContext';
import api from '../../services/api';
import { 
  assignmentFilters,
  getDaysUntilDeadline,
  mergeStudentFilterCatalog,
  buildTeacherOptionsFromCatalog,
  buildAvailableSubjectsForStudent,
  buildAvailableTeachersForStudent,
  resolveTeacherIdByName,
  PAGINATION_DEFAULTS,
  ATTENTION_BLOCK_LIMITS,
} from '../../utils';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import './StudentDashboard.scss';

const STUDENT_DASHBOARD_FILTERS_KEY = 'student-dashboard-filters-v1';

const getStoredStudentFilters = () => {
  try {
    const raw = window.localStorage.getItem(STUDENT_DASHBOARD_FILTERS_KEY);
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

const buildAttentionAssignments = (sourceAssignments = []) => {
  if (!Array.isArray(sourceAssignments)) {
    return { retakes: [], deadlines: [] };
  }

  const dedupeAssignments = (items = []) => {
    const seen = new Set();
    return items.filter((assignment) => {
      const key = assignment?.id
        ? `id:${assignment.id}`
        : `fallback:${assignment?.status || ''}:${assignment?.title || ''}:${assignment?.deadline || ''}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const retakes = dedupeAssignments(
    sourceAssignments.filter((assignment) => assignment?.status === 'returned')
  )
    .slice(0, 3);

  const deadlines = dedupeAssignments(
    sourceAssignments.filter((assignment) => assignment?.status === 'not_submitted')
  )
    .map((assignment) => ({
      ...assignment,
      daysLeft: getDaysUntilDeadline(assignment?.deadline),
    }))
    .filter((assignment) => assignment.daysLeft !== null && assignment.daysLeft <= 3)
    .sort((a, b) => {
      const aIsOverdue = a.daysLeft < 0;
      const bIsOverdue = b.daysLeft < 0;
      if (aIsOverdue !== bIsOverdue) {
        return aIsOverdue ? -1 : 1;
      }
      return a.daysLeft - b.daysLeft;
    })
    .slice(0, 3);

  return { retakes, deadlines };
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const { 
    assignments = [],
    assignmentsMeta = {},
    loading, 
    loadStudentAssignments, 
    submitWork,
    error 
  } = useStudent();
  const { showSuccess, showError, showWarning } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();

  const storedFilters = getStoredStudentFilters();
  const [activeFilter, setActiveFilter] = useState(storedFilters?.activeFilter || 'all');
  const [searchTerm, setSearchTerm] = useState(storedFilters?.searchTerm || '');
  const [subjectFilter, setSubjectFilter] = useState(storedFilters?.subjectFilter || 'all');
  const [teacherFilter, setTeacherFilter] = useState(storedFilters?.teacherFilter || 'all');
  const [page, setPage] = useState(1);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [detailsAssignment, setDetailsAssignment] = useState(null);
  const [filterCatalog, setFilterCatalog] = useState([]);
  const [attentionAssignments, setAttentionAssignments] = useState({ retakes: [], deadlines: [] });
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setFilterCatalog([]);
  }, [user?.id]);

  useEffect(() => {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return;
    }

    setFilterCatalog((prev) => mergeStudentFilterCatalog(prev, assignments));
  }, [assignments]);

  const teacherOptions = useMemo(
    () => buildTeacherOptionsFromCatalog(filterCatalog),
    [filterCatalog]
  );

  const availableSubjects = useMemo(
    () => buildAvailableSubjectsForStudent(filterCatalog, teacherFilter),
    [filterCatalog, teacherFilter]
  );

  const availableTeachers = useMemo(
    () => buildAvailableTeachersForStudent(filterCatalog, subjectFilter),
    [filterCatalog, subjectFilter]
  );

  useEffect(() => {
    if (teacherFilter !== 'all' && !availableTeachers.includes(teacherFilter)) {
      setTeacherFilter('all');
    }
  }, [teacherFilter, availableTeachers]);

  useEffect(() => {
    if (subjectFilter !== 'all' && !availableSubjects.includes(subjectFilter)) {
      setSubjectFilter('all');
    }
  }, [subjectFilter, availableSubjects]);

  const selectedTeacherId = useMemo(() => {
    return resolveTeacherIdByName(teacherFilter, teacherOptions);
  }, [teacherFilter, teacherOptions]);

  const handleSubmitWork = useCallback((assignment) => {
    if (assignment?.is_completed) {
      showError('Приём работ по этому заданию завершён: задание в архиве. Новые отправки не принимаются.');
      return;
    }

    const isRetake = assignment?.status === 'returned';
    const canSubmitRetake = assignment?.canSubmitRetake ?? isRetake;
    const canSubmitCurrentAttempt = isRetake ? canSubmitRetake : true;

    if (!canSubmitCurrentAttempt) {
      showWarning('Сдача недоступна: лимит пересдачи исчерпан или срок первичной сдачи завершен.');
      return;
    }

    setSelectedAssignment(assignment);
    setShowSubmissionModal(true);
  }, [showWarning, showError]);

  const handleViewResults = useCallback((assignment) => {
    setSelectedAssignment(assignment);
    setShowResultsModal(true);
  }, []);

  const handleViewDetails = useCallback((assignment) => {
    setDetailsAssignment(assignment);
    setShowAssignmentDetails(true);
  }, []);

  const handleSubmitFromDetails = useCallback((assignment) => {
    setShowAssignmentDetails(false);
    setDetailsAssignment(null);
    handleSubmitWork(assignment);
  }, [handleSubmitWork]);

  const handleViewResultsFromDetails = useCallback((assignment) => {
    setShowAssignmentDetails(false);
    setDetailsAssignment(null);
    handleViewResults(assignment);
  }, [handleViewResults]);

  const handleFileSelect = useCallback((file) => {
    if (file) {
      setSubmissionFile(file);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowSubmissionModal(false);
    setSelectedAssignment(null);
    setSubmissionFile(null);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((value) => {
    setActiveFilter(value);
    setPage(1);
  }, []);

  const handleSubjectFilterChange = useCallback((value) => {
    setSubjectFilter(value);
    setPage(1);
  }, []);

  const handleTeacherFilterChange = useCallback((value) => {
    setTeacherFilter(value);
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setActiveFilter('all');
    setSubjectFilter('all');
    setTeacherFilter('all');
    setPage(1);
  }, []);

  const filtersResetDisabled = useMemo(
    () =>
      !searchTerm.trim() &&
      activeFilter === 'all' &&
      subjectFilter === 'all' &&
      teacherFilter === 'all',
    [searchTerm, activeFilter, subjectFilter, teacherFilter]
  );

  const loadAttentionAssignments = useCallback(async () => {
    if (!user) {
      setAttentionAssignments({ retakes: [], deadlines: [] });
      return;
    }

    try {
      const [retakesResponse, deadlinesResponse] = await Promise.all([
        api.get('/assignments', {
          params: {
            page: 1,
            perPage: ATTENTION_BLOCK_LIMITS.retakes,
            status: 'returned',
          },
        }),
        api.get('/assignments', {
          params: {
            page: 1,
            perPage: ATTENTION_BLOCK_LIMITS.notSubmittedPool,
            status: 'not_submitted',
          },
        }),
      ]);

      const retakesData = Array.isArray(retakesResponse.data?.data)
        ? retakesResponse.data.data
        : (retakesResponse.data || []);
      const deadlinesData = Array.isArray(deadlinesResponse.data?.data)
        ? deadlinesResponse.data.data
        : (deadlinesResponse.data || []);

      setAttentionAssignments(buildAttentionAssignments([...retakesData, ...deadlinesData]));
    } catch {
      setAttentionAssignments({ retakes: [], deadlines: [] });
    }
  }, [user]);

  useEffect(() => {
    loadStudentAssignments({
      page,
      perPage: PAGINATION_DEFAULTS.studentAssignments,
      status: activeFilter !== 'all' ? activeFilter : undefined,
      search: debouncedSearchTerm || undefined,
      subject: subjectFilter !== 'all' ? subjectFilter : undefined,
      teacherId: selectedTeacherId,
    });
  }, [page, activeFilter, debouncedSearchTerm, subjectFilter, selectedTeacherId, loadStudentAssignments]);

  useEffect(() => {
    loadAttentionAssignments();
  }, [loadAttentionAssignments]);

  useEffect(() => {
    window.localStorage.setItem(
      STUDENT_DASHBOARD_FILTERS_KEY,
      JSON.stringify({
        activeFilter,
        searchTerm,
        subjectFilter,
        teacherFilter,
      })
    );
  }, [activeFilter, searchTerm, subjectFilter, teacherFilter]);

  const filteredAssignments = useMemo(() => (
    Array.isArray(assignments) ? assignments : []
  ), [assignments]);

  useEffect(() => {
    const rawId = searchParams.get('assignment');
    if (!rawId) {
      return;
    }
    const focus = searchParams.get('focus') || 'details';
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      setSearchParams({}, { replace: true });
      return;
    }

    handleResetFilters();

    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get(`/assignments/${id}`);
        if (cancelled) {
          return;
        }
        const assignment = normalizeStudentAssignment(data);
        setSearchParams({}, { replace: true });
        if (focus === 'results') {
          handleViewResults(assignment);
        } else if (focus === 'submit') {
          handleSubmitWork(assignment);
        } else {
          handleViewDetails(assignment);
        }
      } catch {
        if (!cancelled) {
          showError('Задание не найдено или недоступно');
          setSearchParams({}, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    searchParams,
    setSearchParams,
    handleResetFilters,
    handleViewResults,
    handleSubmitWork,
    handleViewDetails,
    showError,
  ]);

  const dashboardStats = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) {
      return { total: 0, urgent: 0, overdue: 0, pending: 0 };
    }
    
    let urgentCount = 0;
    let overdueCount = 0;
    let notSubmittedCount = 0;

    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      if (assignment?.status === 'not_submitted') {
        notSubmittedCount++;
        const days = getDaysUntilDeadline(assignment?.deadline);
        if (days <= 3) {
          urgentCount++;
        }
        if (days < 0) {
          overdueCount++;
        }
      }
    }
    
    return {
      total: assignments.length,
      urgent: urgentCount,
      overdue: overdueCount,
      pending: notSubmittedCount,
      completed: assignments.filter(a => a?.status === 'graded').length
    };
  }, [assignments]);

  const filterCounts = useMemo(() => {
    const metaCounts = assignmentsMeta?.counts;
    if (metaCounts && typeof metaCounts === 'object') {
      const toNumber = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const fallbackAll = Array.isArray(assignments) ? assignments.length : 0;
      const fallbackNotSubmitted = Array.isArray(assignments)
        ? assignments.filter((a) => a?.status === 'not_submitted').length
        : 0;
      const fallbackSubmitted = Array.isArray(assignments)
        ? assignments.filter((a) => a?.status === 'submitted').length
        : 0;
      const fallbackGraded = Array.isArray(assignments)
        ? assignments.filter((a) => a?.status === 'graded').length
        : 0;
      const fallbackReturned = Array.isArray(assignments)
        ? assignments.filter((a) => a?.status === 'returned').length
        : 0;
      const fallbackUrgent = dashboardStats.urgent;

      return {
        all: toNumber(metaCounts.all, fallbackAll),
        not_submitted: toNumber(metaCounts.not_submitted ?? metaCounts.notSubmitted, fallbackNotSubmitted),
        submitted: toNumber(metaCounts.submitted, fallbackSubmitted),
        graded: toNumber(metaCounts.graded, fallbackGraded),
        returned: toNumber(metaCounts.returned, fallbackReturned),
        urgent: toNumber(metaCounts.urgent, fallbackUrgent)
      };
    }

    if (!assignments || !Array.isArray(assignments)) {
      return {
        all: 0,
        not_submitted: 0,
        submitted: 0,
        graded: 0,
        returned: 0,
        urgent: 0
      };
    }
    
    return {
      all: assignments.length,
      not_submitted: assignments.filter(a => a?.status === 'not_submitted').length,
      submitted: assignments.filter(a => a?.status === 'submitted').length,
      graded: assignments.filter(a => a?.status === 'graded').length,
      returned: assignments.filter(a => a?.status === 'returned').length,
      urgent: dashboardStats.urgent
    };
  }, [assignmentsMeta, assignments, dashboardStats.urgent]);

  const handleSubmission = useCallback(async () => {
    if (selectedAssignment.submissionType === 'file') {
      if (!submissionFile) {
        showWarning('Пожалуйста, выберите файл для загрузки');
        return;
      }

      if (submissionFile.size > 50 * 1024 * 1024) {
        showError('Файл слишком большой. Максимальный размер: 50 МБ');
        return;
      }
    }

    try {
      const result = await submitWork(selectedAssignment.id, submissionFile);
      if (result.success) {
        setShowSubmissionModal(false);
        setSubmissionFile(null);
        setSelectedAssignment(null);
        loadAttentionAssignments();
        showSuccess(`Работа "${selectedAssignment.title}" успешно сдана на проверку!`);
      } else {
        showError(result.error || 'Ошибка при сдаче работы');
      }
    } catch (error) {
      showError('Ошибка при сдаче работы');
    }
  }, [submissionFile, selectedAssignment, submitWork, showSuccess, showError, showWarning, loadAttentionAssignments]);

  const handleDownloadAssignmentMaterial = useCallback(async (assignment, material) => {
    if (!assignment?.id || !material?.id) {
      showError('Материал для скачивания не найден');
      return;
    }

    try {
      const response = await api.get(`/assignments/${assignment.id}/materials/${material.id}/download`, {
        responseType: 'blob',
      });

      const blob = response.data;
      const objectUrl = URL.createObjectURL(blob);
      const fileName = material.fileName || material.file_name || 'assignment-material';

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      showError('Не удалось скачать материал задания. Попробуйте еще раз.');
    }
  }, [showError]);

  if (!user) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorBanner
        title="Ошибка загрузки"
        message={error}
        actionLabel="Повторить попытку"
        onAction={loadStudentAssignments}
      />
    );
  }

  return (
    <div className="student-dashboard app-page">
      <PageShell contentClassName="student-dashboard__content">
        <DashboardHeader
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          activeFilter={activeFilter}
          filters={assignmentFilters}
          filterCounts={filterCounts}
          overdueCount={dashboardStats.overdue}
          onFilterChange={handleFilterChange}
          subjectFilter={subjectFilter}
          onSubjectFilterChange={handleSubjectFilterChange}
          availableSubjects={availableSubjects}
          teacherFilter={teacherFilter}
          onTeacherFilterChange={handleTeacherFilterChange}
          availableTeachers={availableTeachers}
          onResetFilters={handleResetFilters}
          filtersResetDisabled={filtersResetDisabled}
          attentionAssignments={attentionAssignments}
          onOpenAttentionAssignment={handleViewDetails}
        />

        <DashboardContent
          isLoading={loading}
          assignments={filteredAssignments}
          onSubmitWork={handleSubmitWork}
          onViewResults={handleViewResults}
          onResubmit={handleSubmitWork}
          onViewDetails={handleViewDetails}
        />
        <Pagination
          currentPage={assignmentsMeta.currentPage}
          lastPage={assignmentsMeta.lastPage}
          total={assignmentsMeta.total}
          fallbackCount={assignments.length}
          onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setPage((prev) => prev + 1)}
        />
      </PageShell>

      <SubmissionModal
        assignment={selectedAssignment}
        isOpen={showSubmissionModal}
        onClose={handleCloseModal}
        submissionFile={submissionFile}
        onFileSelect={handleFileSelect}
        onSubmit={handleSubmission}
      />

      <ResultsModal
        assignment={selectedAssignment}
        isOpen={showResultsModal}
        onClose={() => {
          setShowResultsModal(false);
          setSelectedAssignment(null);
        }}
      />

      <AssignmentDetailsModal
        assignment={detailsAssignment}
        isOpen={showAssignmentDetails}
        onClose={() => {
          setShowAssignmentDetails(false);
          setDetailsAssignment(null);
        }}
        mode="student"
        onSubmitWork={handleSubmitFromDetails}
        onResubmit={handleSubmitFromDetails}
        onViewResults={handleViewResultsFromDetails}
        onDownloadMaterial={handleDownloadAssignmentMaterial}
      />
    </div>
  );
};

const DashboardContent = React.memo(({ 
  isLoading, 
  assignments = [],
  onSubmitWork, 
  onViewResults, 
  onResubmit,
  onViewDetails
}) => {
  if (isLoading) {
    return <LoadingState message="Загрузка заданий..." />;
  }

  if (!assignments || assignments.length === 0) {
    return (
      <EmptyState
        title="Задания не найдены"
        message="Попробуйте изменить параметры поиска или фильтрации"
      />
    );
  }

  return (
    <div className="assignments-grid app-reveal-stagger">
      {assignments.map((assignment, index) => (
        <AssignmentCard
          key={assignment?.id ?? `assignment-${index}`}
          assignment={assignment}
          onSubmitWork={onSubmitWork}
          onViewResults={onViewResults}
          onResubmit={onResubmit}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
});

export default StudentDashboard;