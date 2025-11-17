import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../../components/Teacher/DashboardHeader/DashboardHeader';
import AssignmentCard from '../../components/Teacher/AssignmentCard/AssignmentCard';
import SubmissionsTable from '../../components/Teacher/SubmissionsTable/SubmissionsTable';
import AnalyticsSection from '../../components/Teacher/AnalyticsSection/AnalyticsSection';
import GradingModal from '../../components/Teacher/GradingModal/GradingModal';
import AssignmentModal from '../../components/Teacher/AssignmentModal/AssignmentModal';
import SubmissionDetailsModal from '../../components/Teacher/SubmissionDetailsModal/SubmissionDetailsModal';
import Button from '../../components/UI/Button/Button';
import InputModal from '../../components/UI/Modal/InputModal';
import { useAuth } from '../../context/AuthContext';
import { useTeacher } from '../../context/TeacherContext';
import { useNotification } from '../../context/NotificationContext';
import './TeacherDashboard.scss';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { 
    teacherAssignments: assignments, 
    submissions, 
    loading, 
    loadTeacherAssignments, 
    loadTeacherSubmissions,
    gradeSubmission,
    returnSubmission,
    createAssignment,
    updateAssignment,
    error 
  } = useTeacher();
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
  
  const [activeTab, setActiveTab] = useState('assignments');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputModalConfig, setInputModalConfig] = useState(null);
  const [gradeData, setGradeData] = useState({ score: '', comment: '' });
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadTeacherAssignments();
    loadTeacherSubmissions();
  }, [user, navigate, loadTeacherAssignments, loadTeacherSubmissions]);

  const { dashboardStats, filteredSubmissions } = useMemo(() => {
    const dashboardStats = {
      totalAssignments: assignments.length,
      pendingSubmissions: submissions.filter(s => s.status === 'на проверке').length,
      gradedSubmissions: submissions.filter(s => s.status === 'зачтена').length,
      returnedSubmissions: submissions.filter(s => s.status === 'возвращена').length,
      totalSubmissions: submissions.length
    };

    let filtered = [...submissions];
    if (assignmentFilter !== 'all') {
      filtered = filtered.filter(s => s.assignmentId === parseInt(assignmentFilter));
    }
    if (groupFilter !== 'all') {
      filtered = filtered.filter(s => s.group === groupFilter);
    }

    return { dashboardStats, filteredSubmissions: filtered };
  }, [assignments, submissions, assignmentFilter, groupFilter]);

  const handleCreateAssignment = () => {
    setSelectedAssignment(null);
    setShowAssignmentModal(true);
  };

  const closeAssignmentModal = () => {
    setShowAssignmentModal(false);
    setSelectedAssignment(null);
  };

  const handleGradeSubmission = (submission) => {
    setSelectedSubmission(submission);
    setGradeData({ 
      score: submission.score || '', 
      comment: submission.comment || '' 
    });
    setShowGradingModal(true);
  };

  const handleSubmitGrade = async () => {
    if (!gradeData.score || gradeData.score < 0 || gradeData.score > (selectedSubmission.maxScore || 100)) {
      showWarning(`Пожалуйста, введите корректную оценку (0-${selectedSubmission.maxScore || 100})`);
      return;
    }

    try {
      const result = await gradeSubmission(selectedSubmission.id, gradeData.score, gradeData.comment);
      if (result.success) {
        setShowGradingModal(false);
        setSelectedSubmission(null);
        setGradeData({ score: '', comment: '' });
        showSuccess(`Оценка для работы "${selectedSubmission.assignmentTitle}" сохранена!`);
      } else {
        showError(result.error || 'Ошибка при сохранении оценки');
      }
    } catch (error) {
      showError('Ошибка при сохранении оценки');
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
          try {
            const result = await returnSubmission(submission.id, comment);
            if (result.success) {
              showSuccess(`Работа "${submission.assignmentTitle}" возвращена студенту на доработку`);
            } else {
              showError(result.error || 'Ошибка при возврате работы');
    }
          } catch (error) {
            showError('Ошибка при возврате работы');
          }
        }
      }
    });
    setShowInputModal(true);
  };

  const handleDownloadFile = (submission) => {
    const link = document.createElement('a');
    link.href = `#`;
    link.download = submission.fileName;
    link.click();
    showInfo(`Начато скачивание файла: ${submission.fileName}`);
  };

  const handleViewDetails = (submission) => {
    setSelectedSubmission(submission);  
    const relatedAssignment = assignments.find(a => a.id === submission.assignmentId);
    setSelectedAssignment(relatedAssignment);
    setShowDetailsModal(true);
  };

  const handleViewSubmissions = (assignmentId) => {
    setAssignmentFilter(assignmentId.toString());
    setActiveTab('submissions');
  };

  const handleEditAssignment = (assignment) => {
    setSelectedAssignment(assignment);
    setShowAssignmentModal(true);
  };

  const handleViewAnalytics = (assignment) => {
    setSelectedAssignment(assignment);
    setAssignmentFilter(assignment.id.toString());
    setActiveTab('analytics');
  };

  const handleSaveAssignment = async (assignmentData) => {
    try {
      const result = selectedAssignment
        ? await updateAssignment(selectedAssignment.id, {
            ...assignmentData,
            id: selectedAssignment.id
          })
        : await createAssignment(assignmentData);
      if (result.success) {
        closeAssignmentModal();
        showSuccess(selectedAssignment ? 'Задание обновлено!' : 'Задание успешно создано!');
      } else {
        showError(result.error || (selectedAssignment ? 'Ошибка при обновлении задания' : 'Ошибка при создании задания'));
      }
    } catch (error) {
      showError(selectedAssignment ? 'Ошибка при обновлении задания' : 'Ошибка при создании задания');
    }
  };

  if (loading && assignments.length === 0) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="error-state">
        <div className="error-icon">⚠️</div>
        <h3>Ошибка загрузки</h3>
        <p>{error}</p>
        <button onClick={() => {
          loadTeacherAssignments();
          loadTeacherSubmissions();
        }}>Повторить попытку</button>
      </div>
    );
  }

  return (
    <div className="teacher-dashboard">
      <main className="dashboard-main">
        <div className="dashboard-container">
          <DashboardHeader
            user={user}
            stats={dashboardStats}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <DashboardContent
            activeTab={activeTab}
            assignments={assignments}
            filteredSubmissions={filteredSubmissions}
            assignmentFilter={assignmentFilter}
            groupFilter={groupFilter}
            onAssignmentFilterChange={setAssignmentFilter}
            onGroupFilterChange={setGroupFilter}
            onCreateAssignment={handleCreateAssignment}
            onViewSubmissions={handleViewSubmissions}
            onEditAssignment={handleEditAssignment}
            onViewAnalytics={handleViewAnalytics}
            onGradeSubmission={handleGradeSubmission}
            onReturnSubmission={handleReturnSubmission}
            onDownloadFile={handleDownloadFile}
            onViewDetails={handleViewDetails}
          />
        </div>
      </main>

      <GradingModal
        submission={selectedSubmission}
        assignment={selectedSubmission ? assignments.find(a => a.id === selectedSubmission.assignmentId) : null}
        isOpen={showGradingModal}
        onClose={() => {
          setShowGradingModal(false);
          setSelectedSubmission(null);
          setGradeData({ score: '', comment: '' });
        }}
        gradeData={gradeData}
        onGradeDataChange={setGradeData}
        onSubmit={handleSubmitGrade}
      />

      <AssignmentModal
        assignment={selectedAssignment}
        isOpen={showAssignmentModal}
        onClose={closeAssignmentModal}
        onSubmit={handleSaveAssignment}
      />

      <SubmissionDetailsModal
        submission={selectedSubmission}
        assignment={selectedAssignment}
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedSubmission(null);
          setSelectedAssignment(null);
        }}
        onDownload={handleDownloadFile}
        onGrade={handleGradeSubmission}
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

const LoadingState = () => (
  <div className="loading-state">
    <div className="spinner"></div>
    <p>Загрузка дашборда...</p>
  </div>
);

const DashboardContent = ({
  activeTab,
  assignments,
  filteredSubmissions,
  assignmentFilter,
  groupFilter,
  onAssignmentFilterChange,
  onGroupFilterChange,
  onCreateAssignment,
  onViewSubmissions,
  onEditAssignment,
  onViewAnalytics,
  onGradeSubmission,
  onReturnSubmission,
  onDownloadFile,
  onViewDetails
}) => {
  const renderSection = () => {
    switch (activeTab) {
      case 'assignments':
        return (
          <AssignmentsSection
            assignments={assignments}
            onCreateAssignment={onCreateAssignment}
            onViewSubmissions={onViewSubmissions}
            onEditAssignment={onEditAssignment}
            onViewAnalytics={onViewAnalytics}
          />
        );
      
      case 'submissions':
        return (
          <SubmissionsSection
            submissions={filteredSubmissions}
            assignments={assignments}
            assignmentFilter={assignmentFilter}
            groupFilter={groupFilter}
            onAssignmentFilterChange={onAssignmentFilterChange}
            onGroupFilterChange={onGroupFilterChange}
            onGradeSubmission={onGradeSubmission}
            onReturnSubmission={onReturnSubmission}
            onDownloadFile={onDownloadFile}
            onViewDetails={onViewDetails}
          />
        );
      
      case 'analytics':
        return <AnalyticsSection submissions={filteredSubmissions} assignments={assignments} />;
      
      case 'students':
        return (
          <div className="students-section">
            <div className="section-header">
              <h2>Студенты</h2>
            </div>
            <div className="empty-state">
              <p>Функционал управления студентами будет добавлен в следующей версии</p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return <div className="dashboard-content">{renderSection()}</div>;
};

const AssignmentsSection = ({ 
  assignments, 
  onCreateAssignment, 
  onViewSubmissions,
  onEditAssignment,
  onViewAnalytics
}) => (
  <div className="assignments-section">
    <div className="section-header">
      <h2>Учебные задания</h2>
      <Button variant="primary" onClick={onCreateAssignment}>
        + Создать задание
      </Button>
    </div>
    
    <div className="assignments-grid">
      {assignments.map(assignment => (
        <AssignmentCard
          key={assignment.id}
          assignment={assignment}
          onViewSubmissions={() => onViewSubmissions(assignment.id)}
          onEditAssignment={() => onEditAssignment(assignment)}
          onViewAnalytics={() => onViewAnalytics(assignment)}
        />
      ))}
    </div>
  </div>
);

const SubmissionsSection = ({
  submissions,
  assignments,
  assignmentFilter,
  groupFilter,
  onAssignmentFilterChange,
  onGroupFilterChange,
  onGradeSubmission,
  onReturnSubmission,
  onDownloadFile,
  onViewDetails
}) => (
  <div className="submissions-section">
    <div className="section-header">
      <h2>Работы студентов</h2>
      <div className="filters">
        <select 
          value={assignmentFilter} 
          onChange={(e) => onAssignmentFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">Все задания</option>
          {assignments.map(assignment => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.title}
            </option>
          ))}
        </select>
        <select 
          value={groupFilter} 
          onChange={(e) => onGroupFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">Все группы</option>
          <option value="ИСП-401">ИСП-401</option>
          <option value="ИСП-402">ИСП-402</option>
        </select>
      </div>
    </div>

    <SubmissionsTable
      submissions={submissions}
      assignments={assignments}
      onGradeSubmission={onGradeSubmission}
      onReturnSubmission={onReturnSubmission}
      onDownloadFile={onDownloadFile}
      onViewDetails={onViewDetails}
    />
  </div>
);

export default TeacherDashboard;