import React, { useState, useMemo, useCallback, useEffect } from 'react';
import DashboardHeader from '../../components/Student/DashboardHeader/DashboardHeader';
import AssignmentCard from '../../components/Student/AssignmentCard/AssignmentCard';
import SubmissionModal from '../../components/Student/SubmissionModal/SubmissionModal';
import ResultsModal from '../../components/Student/ResultsModal/ResultsModal';
import Card from '../../components/UI/Card/Card';
import AssignmentDetailsModal from '../../components/Shared/AssignmentDetailsModal/AssignmentDetailsModal';
import Pagination from '../../components/UI/Pagination/Pagination';
import { useAuth } from '../../context/AuthContext';
import { useStudent } from '../../context/StudentContext';
import { useNotification } from '../../context/NotificationContext';
import api from '../../services/api';
import { 
  assignmentFilters,
  getDaysUntilDeadline 
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
  
  const storedFilters = getStoredStudentFilters();
  const [activeFilter, setActiveFilter] = useState(storedFilters?.activeFilter || 'all');
  const [sortBy, setSortBy] = useState(storedFilters?.sortBy || 'priority');
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
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 350);

  const handleSubmitWork = useCallback((assignment) => {
    const isRetake = assignment?.status === 'returned';
    const canSubmitRetake = assignment?.canSubmitRetake ?? isRetake;
    const canSubmitCurrentAttempt = isRetake ? canSubmitRetake : true;

    if (!canSubmitCurrentAttempt) {
      showWarning('Сдача недоступна: лимит пересдачи исчерпан или срок первичной сдачи завершен.');
      return;
    }

    setSelectedAssignment(assignment);
    setShowSubmissionModal(true);
  }, [showWarning]);

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
  }, []);

  const handleSortChange = useCallback((value) => {
    setSortBy(value);
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
    setSortBy('priority');
    setSubjectFilter('all');
    setTeacherFilter('all');
    setPage(1);
  }, []);

  useEffect(() => {
    loadStudentAssignments({
      page,
      perPage: 18,
      sort: sortBy,
      status: activeFilter !== 'all' ? activeFilter : undefined,
      search: debouncedSearchTerm || undefined,
    });
  }, [page, sortBy, activeFilter, debouncedSearchTerm, loadStudentAssignments]);

  useEffect(() => {
    window.localStorage.setItem(
      STUDENT_DASHBOARD_FILTERS_KEY,
      JSON.stringify({
        activeFilter,
        sortBy,
        searchTerm,
        subjectFilter,
        teacherFilter,
      })
    );
  }, [activeFilter, sortBy, searchTerm, subjectFilter, teacherFilter]);

  const availableSubjects = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) return [];
    const subjects = new Set();
    assignments.forEach(assignment => {
      if (assignment?.subject) {
        subjects.add(assignment.subject);
      }
    });
    return Array.from(subjects).sort();
  }, [assignments]);

  const availableTeachers = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) return [];
    const teachers = new Set();
    assignments.forEach(assignment => {
      if (assignment?.teacher) {
        teachers.add(assignment.teacher);
      }
    });
    return Array.from(teachers).sort();
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) {
      return [];
    }
    
    let filtered = [...assignments];
    
    if (subjectFilter !== 'all') {
      filtered = filtered.filter(assignment => assignment?.subject === subjectFilter);
    }
    
    if (teacherFilter !== 'all') {
      filtered = filtered.filter(assignment => assignment?.teacher === teacherFilter);
    }
    

    return filtered;
  }, [assignments, subjectFilter, teacherFilter]);

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
  }, [assignments, dashboardStats.urgent]);

  const attentionAssignments = useMemo(() => {
    if (!Array.isArray(assignments)) {
      return { retakes: [], deadlines: [] };
    }

    const retakes = assignments
      .filter((assignment) => assignment?.status === 'returned')
      .slice(0, 3);

    const deadlines = assignments
      .filter((assignment) => assignment?.status === 'not_submitted')
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
  }, [assignments]);

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
        showSuccess(`Работа "${selectedAssignment.title}" успешно сдана на проверку!`);
      } else {
        showError(result.error || 'Ошибка при сдаче работы');
      }
    } catch (error) {
      showError('Ошибка при сдаче работы');
    }
  }, [submissionFile, selectedAssignment, submitWork, showSuccess, showError, showWarning]);

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
      <div className="error-state">
        <div className="error-icon">⚠️</div>
        <h3>Ошибка загрузки</h3>
        <p>{error}</p>
        <button onClick={loadStudentAssignments}>Повторить попытку</button>
      </div>
    );
  }

  return (
    <div className="student-dashboard">
      <main className="dashboard-main">
        <div className="dashboard-container">
          <DashboardHeader
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
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
          />

          <AttentionBlock
            retakes={attentionAssignments.retakes}
            deadlines={attentionAssignments.deadlines}
            onOpenAssignment={handleViewDetails}
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
        </div>
      </main>

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

const LoadingState = React.memo(() => (
  <div className="loading-state">
    <div className="spinner"></div>
    <p>Загрузка...</p>
  </div>
));

const DashboardContent = React.memo(({ 
  isLoading, 
  assignments = [],
  onSubmitWork, 
  onViewResults, 
  onResubmit,
  onViewDetails
}) => {
  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Загрузка заданий...</p>
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Card className="empty-state">
        <div className="empty-content">
          <div className="empty-icon">📚</div>
          <h3>Задания не найдены</h3>
          <p>Попробуйте изменить параметры поиска или фильтрации</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="assignments-grid">
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

const AttentionBlock = React.memo(({ retakes = [], deadlines = [], onOpenAssignment }) => {
  if (retakes.length === 0 && deadlines.length === 0) {
    return null;
  }

  return (
    <section className="attention-block">
      <div className="attention-block__header">
        <h3>Требует внимания</h3>
      </div>
      <div className="attention-block__content">
        {retakes.length > 0 && (
          <div className="attention-block__group">
            <h4>Пересдачи</h4>
            <ul>
              {retakes.map((assignment) => (
                <li key={`retake-${assignment.id}`}>
                  <button
                    type="button"
                    className="attention-block__item"
                    onClick={() => onOpenAssignment?.(assignment)}
                  >
                    {assignment.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {deadlines.length > 0 && (
          <div className="attention-block__group">
            <h4>Ближайшие дедлайны</h4>
            <ul>
              {deadlines.map((assignment) => (
                <li key={`deadline-${assignment.id}`}>
                  <button
                    type="button"
                    className="attention-block__item"
                    onClick={() => onOpenAssignment?.(assignment)}
                  >
                    {assignment.title} — {
                      assignment.daysLeft < 0
                        ? `просрочено на ${Math.abs(assignment.daysLeft)} дн.`
                        : assignment.daysLeft === 0
                          ? 'сегодня'
                          : `${assignment.daysLeft} дн.`
                    }
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
});

export default StudentDashboard;