import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../../components/Student/DashboardHeader/DashboardHeader';
import AssignmentCard from '../../components/Student/AssignmentCard/AssignmentCard';
import SubmissionModal from '../../components/Student/SubmissionModal/SubmissionModal';
import ResultsModal from '../../components/Student/ResultsModal/ResultsModal';
import Card from '../../components/UI/Card/Card';
import AssignmentDetailsModal from '../../components/Shared/AssignmentDetailsModal/AssignmentDetailsModal';
import { useAuth } from '../../context/AuthContext';
import { useStudent } from '../../context/StudentContext';
import { useNotification } from '../../context/NotificationContext';
import { 
  filters,
  getDaysUntilDeadline 
} from '../../utils/assignmentHelpers';
import './StudentDashboard.scss';

const StudentDashboard = () => {
  const { user } = useAuth();
  const { 
    assignments = [],
    loading, 
    loadStudentAssignments, 
    submitWork,
    error 
  } = useStudent();
  const { showSuccess, showError, showWarning } = useNotification();
  
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('deadline');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [detailsAssignment, setDetailsAssignment] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadStudentAssignments();
  }, [user, navigate, loadStudentAssignments]);

  const handleSubmitWork = useCallback((assignment) => {
    setSelectedAssignment(assignment);
    setShowSubmissionModal(true);
  }, []);

  const handleViewResults = useCallback((assignment) => {
    setSelectedAssignment(assignment);
    setShowResultsModal(true);
  }, []);

  const handleViewDetails = useCallback((assignment) => {
    setDetailsAssignment(assignment);
    setShowAssignmentDetails(true);
  }, []);

  const handleFileSelect = useCallback((event) => {
    setSubmissionFile(event.target.files[0]);
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
  }, []);

  const handleFilterChange = useCallback((value) => {
    setActiveFilter(value);
  }, []);

  const filteredAssignments = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) {
      return [];
    }
    
    let filtered = [...assignments];
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(assignment => 
        assignment?.title?.toLowerCase().includes(term) ||
        assignment?.course?.toLowerCase().includes(term) ||
        assignment?.teacher?.toLowerCase().includes(term)
      );
    }
    
    if (activeFilter !== 'all') {
      if (activeFilter === 'urgent') {
        filtered = filtered.filter(assignment => {
          const days = getDaysUntilDeadline(assignment?.deadline);
          return days <= 3 && assignment?.status === 'not_submitted';
        });
      } else {
        filtered = filtered.filter(assignment => assignment?.status === activeFilter);
      }
    }
    
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'deadline':
          return new Date(a?.deadline || 0) - new Date(b?.deadline || 0);
        case 'course':
          return (a?.course || '').localeCompare(b?.course || '');
        case 'status':
          return (a?.status || '').localeCompare(b?.status || '');
        case 'title':
          return (a?.title || '').localeCompare(b?.title || '');
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b?.priority] || 0) - (priorityOrder[a?.priority] || 0);
        default:
          return new Date(a?.deadline || 0) - new Date(b?.deadline || 0);
      }
    });
    
    return filtered;
  }, [assignments, activeFilter, sortBy, searchTerm]);

  const dashboardStats = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) {
      return { total: 0, urgent: 0, pending: 0 };
    }
    
    let urgentCount = 0;
    let notSubmittedCount = 0;
    
    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      if (assignment?.status === 'not_submitted') {
        notSubmittedCount++;
        const days = getDaysUntilDeadline(assignment?.deadline);
        if (days <= 3) {
          urgentCount++;
        }
      }
    }
    
    return {
      total: assignments.length,
      urgent: urgentCount,
      pending: notSubmittedCount
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

  const handleSubmission = useCallback(async () => {
    if (!submissionFile) {
      showWarning('Пожалуйста, выберите файл для загрузки');
      return;
    }

    if (submissionFile.size > 50 * 1024 * 1024) {
      showError('Файл слишком большой. Максимальный размер: 50 МБ');
      return;
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
            stats={dashboardStats}
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            activeFilter={activeFilter}
            filters={filters}
            filterCounts={filterCounts}
            onFilterChange={handleFilterChange}
          />

          <DashboardContent
            isLoading={loading}
            assignments={filteredAssignments}
            onSubmitWork={handleSubmitWork}
            onViewResults={handleViewResults}
            onResubmit={handleSubmitWork}
            onViewDetails={handleViewDetails}
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
      {assignments.map(assignment => (
        <AssignmentCard
          key={assignment?.id || Math.random()}
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