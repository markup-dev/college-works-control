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
import ConfirmModal from '../../components/UI/Modal/ConfirmModal';
import AssignmentDetailsModal from '../../components/Shared/AssignmentDetailsModal/AssignmentDetailsModal';
import { useAuth } from '../../context/AuthContext';
import { useTeacher } from '../../context/TeacherContext';
import { useNotification } from '../../context/NotificationContext';
import { calculateSubmissionStats } from '../../utils/assignmentHelpers';
import './TeacherDashboard.scss';

const DEFAULT_GROUPS = ['ИСП-029', 'ИСП-029А'];

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
    deleteAssignment,
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignmentGroupFilter, setAssignmentGroupFilter] = useState('all');
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detailsAssignment, setDetailsAssignment] = useState(null);
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadTeacherAssignments();
    loadTeacherSubmissions();
  }, [user, navigate, loadTeacherAssignments, loadTeacherSubmissions]);

  const { dashboardStats, filteredSubmissions, filteredAssignments } = useMemo(() => {
    const dashboardStats = {
      totalAssignments: assignments.length,
      pendingSubmissions: submissions.filter(s => s.status === 'на проверке').length,
      gradedSubmissions: submissions.filter(s => s.status === 'зачтена').length,
      returnedSubmissions: submissions.filter(s => s.status === 'возвращена').length,
      totalSubmissions: submissions.length
    };

    let filteredSubs = [...submissions];
    if (assignmentFilter !== 'all') {
      filteredSubs = filteredSubs.filter(s => s.assignmentId === parseInt(assignmentFilter));
    }
    if (groupFilter !== 'all') {
      filteredSubs = filteredSubs.filter(s => s.group === groupFilter);
    }
    if (statusFilter !== 'all') {
      filteredSubs = filteredSubs.filter(s => s.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filteredSubs = filteredSubs.filter(s =>
        s.studentName?.toLowerCase().includes(term) ||
        s.assignmentTitle?.toLowerCase().includes(term) ||
        s.group?.toLowerCase().includes(term)
      );
    }

    let filteredAssigns = [...assignments];
    if (assignmentGroupFilter !== 'all') {
      filteredAssigns = filteredAssigns.filter(a =>
        a.studentGroups?.includes(assignmentGroupFilter)
      );
    }
    if (assignmentSearchTerm.trim()) {
      const term = assignmentSearchTerm.toLowerCase();
      filteredAssigns = filteredAssigns.filter(a =>
        a.title?.toLowerCase().includes(term) ||
        a.course?.toLowerCase().includes(term)
      );
    }

    return {
      dashboardStats,
      filteredSubmissions: filteredSubs,
      filteredAssignments: filteredAssigns
    };
  }, [assignments, submissions, assignmentFilter, groupFilter, statusFilter, searchTerm, assignmentGroupFilter, assignmentSearchTerm]);

  const availableGroups = useMemo(() => {
    const groupSet = new Set();
    const addGroup = (value) => {
      const normalized = value?.trim();
      if (normalized) {
        groupSet.add(normalized);
      }
    };

    assignments.forEach((assignment) => {
      addGroup(assignment.group);
      (assignment.studentGroups || []).forEach(addGroup);
    });

    submissions.forEach((submission) => {
      addGroup(submission.group);
    });

    if (groupSet.size === 0) {
      DEFAULT_GROUPS.forEach(addGroup);
    }

    return Array.from(groupSet);
  }, [assignments, submissions]);

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

  const handleViewAssignmentDetails = (assignment) => {
    setDetailsAssignment(assignment);
    setShowAssignmentDetails(true);
  };

  const handleCloseAssignmentDetails = () => {
    setDetailsAssignment(null);
    setShowAssignmentDetails(false);
  };

  const handleRequestDeleteAssignment = (assignment) => {
    setAssignmentToDelete(assignment);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteAssignment = async () => {
    const assignment = assignmentToDelete;
    if (!assignment) return;

    try {
      const result = await deleteAssignment(assignment.id);
      if (result.success) {
        showSuccess(`Задание "${assignment.title}" удалено`);
      } else {
        showError(result.error || 'Не удалось удалить задание');
      }
    } catch (error) {
      showError('Ошибка при удалении задания');
    } finally {
      setAssignmentToDelete(null);
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirm(false);
    setAssignmentToDelete(null);
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
            assignments={filteredAssignments}
            filteredSubmissions={filteredSubmissions}
            assignmentFilter={assignmentFilter}
            groupFilter={groupFilter}
            statusFilter={statusFilter}
            searchTerm={searchTerm}
            assignmentSearchTerm={assignmentSearchTerm}
            assignmentGroupFilter={assignmentGroupFilter}
            availableGroups={availableGroups}
            onAssignmentFilterChange={setAssignmentFilter}
            onGroupFilterChange={setGroupFilter}
            onStatusFilterChange={setStatusFilter}
            onSearchChange={setSearchTerm}
            onAssignmentSearchChange={setAssignmentSearchTerm}
            onAssignmentGroupFilterChange={setAssignmentGroupFilter}
            onCreateAssignment={handleCreateAssignment}
            onViewSubmissions={handleViewSubmissions}
            onEditAssignment={handleEditAssignment}
            onViewAnalytics={handleViewAnalytics}
            onViewAssignmentDetails={handleViewAssignmentDetails}
            onDeleteAssignment={handleRequestDeleteAssignment}
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
        availableGroups={availableGroups}
      />

      <AssignmentDetailsModal
        assignment={detailsAssignment}
        isOpen={showAssignmentDetails}
        onClose={handleCloseAssignmentDetails}
        mode="teacher"
        stats={detailsAssignment ? calculateSubmissionStats(detailsAssignment.submissions || []) : null}
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
  statusFilter,
  searchTerm,
  assignmentSearchTerm,
  assignmentGroupFilter,
  availableGroups,
  onAssignmentFilterChange,
  onGroupFilterChange,
  onStatusFilterChange,
  onSearchChange,
  onAssignmentSearchChange,
  onAssignmentGroupFilterChange,
  onCreateAssignment,
  onViewSubmissions,
  onEditAssignment,
  onViewAnalytics,
  onViewAssignmentDetails,
  onDeleteAssignment,
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
            searchTerm={assignmentSearchTerm}
            groupFilter={assignmentGroupFilter}
            availableGroups={availableGroups}
            onSearchChange={onAssignmentSearchChange}
            onGroupFilterChange={onAssignmentGroupFilterChange}
            onCreateAssignment={onCreateAssignment}
            onViewSubmissions={onViewSubmissions}
            onEditAssignment={onEditAssignment}
            onViewAnalytics={onViewAnalytics}
            onViewDetails={onViewAssignmentDetails}
            onDeleteAssignment={onDeleteAssignment}
          />
        );
      
      case 'submissions':
        return (
          <SubmissionsSection
            submissions={filteredSubmissions}
            assignments={assignments}
            assignmentFilter={assignmentFilter}
            groupFilter={groupFilter}
            statusFilter={statusFilter}
            searchTerm={searchTerm}
            availableGroups={availableGroups}
            onAssignmentFilterChange={onAssignmentFilterChange}
            onGroupFilterChange={onGroupFilterChange}
            onStatusFilterChange={onStatusFilterChange}
            onSearchChange={onSearchChange}
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
  searchTerm,
  groupFilter,
  availableGroups,
  onSearchChange,
  onGroupFilterChange,
  onCreateAssignment,
  onViewSubmissions,
  onEditAssignment,
  onViewAnalytics,
  onViewDetails,
  onDeleteAssignment
}) => (
  <div className="assignments-section">
    <div className="section-header">
      <h2>Учебные задания</h2>
      <Button variant="primary" onClick={onCreateAssignment}>
        + Создать задание
      </Button>
    </div>

    <div className="filters-section">
      <div className="controls-row">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Поиск по названию, дисциплине..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="sort-filter">
          <select
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
      </div>
    </div>

    <div className="assignments-grid">
      {assignments.map(assignment => (
        <AssignmentCard
          key={assignment.id}
          assignment={assignment}
          onViewSubmissions={() => onViewSubmissions(assignment.id)}
          onEditAssignment={() => onEditAssignment(assignment)}
          onViewAnalytics={() => onViewAnalytics(assignment)}
          onViewDetails={() => onViewDetails && onViewDetails(assignment)}
          onDeleteAssignment={onDeleteAssignment ? () => onDeleteAssignment(assignment) : undefined}
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
  statusFilter,
  searchTerm,
  availableGroups,
  onAssignmentFilterChange,
  onGroupFilterChange,
  onStatusFilterChange,
  onSearchChange,
  onGradeSubmission,
  onReturnSubmission,
  onDownloadFile,
  onViewDetails
}) => (
  <div className="submissions-section">
    <div className="section-header">
      <h2>Работы студентов</h2>
      <div className="filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Поиск по студенту, заданию, группе..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
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
          {availableGroups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">Все статусы</option>
          <option value="на проверке">На проверке</option>
          <option value="зачтена">Зачтена</option>
          <option value="возвращена">Возвращена</option>
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