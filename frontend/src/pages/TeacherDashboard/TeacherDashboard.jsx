import React, { useState, useMemo, useEffect, useCallback } from 'react';
import DashboardHeader from '../../components/Teacher/DashboardHeader/DashboardHeader';
import AssignmentCard from '../../components/Teacher/AssignmentCard/AssignmentCard';
import SubmissionsTable from '../../components/Teacher/SubmissionsTable/SubmissionsTable';
import AnalyticsSection from '../../components/Teacher/AnalyticsSection/AnalyticsSection';
import GradingModal from '../../components/Teacher/GradingModal/GradingModal';
import AssignmentModal from '../../components/Teacher/AssignmentModal/AssignmentModal';
import SubmissionDetailsModal from '../../components/Teacher/SubmissionDetailsModal/SubmissionDetailsModal';
import Button from '../../components/UI/Button/Button';
import Pagination from '../../components/UI/Pagination/Pagination';
import InputModal from '../../components/UI/Modal/InputModal';
import ConfirmModal from '../../components/UI/Modal/ConfirmModal';
import AssignmentDetailsModal from '../../components/Shared/AssignmentDetailsModal/AssignmentDetailsModal';
import { useAuth } from '../../context/AuthContext';
import { useTeacher } from '../../context/TeacherContext';
import { useNotification } from '../../context/NotificationContext';
import {
  calculateSubmissionStats,
  formatDate,
  buildNormalizedGroupOptions,
  buildSubmissionSubjectOptions,
  PAGINATION_DEFAULTS,
} from '../../utils';
import api from '../../services/api';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import './TeacherDashboard.scss';

const TEACHER_DASHBOARD_FILTERS_KEY = 'teacher-dashboard-filters-v1';

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
    availableSubjects: teacherAvailableSubjects,
    loading, 
    loadTeacherMeta,
    loadTeacherAssignments, 
    loadTeacherSubmissions,
    gradeSubmission,
    returnSubmission,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    error 
  } = useTeacher();
  const { showSuccess, showError, showInfo } = useNotification();
  
  const storedFilters = getStoredTeacherFilters();
  const [activeTab, setActiveTab] = useState(storedFilters?.activeTab || 'assignments');
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
  const [statusFilter, setStatusFilter] = useState(storedFilters?.statusFilter || 'all');
  const [searchTerm, setSearchTerm] = useState(storedFilters?.searchTerm || '');
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState(storedFilters?.assignmentSearchTerm || '');
  const [assignmentGroupFilter, setAssignmentGroupFilter] = useState(storedFilters?.assignmentGroupFilter || 'all');
  const [assignmentSortBy, setAssignmentSortBy] = useState(storedFilters?.assignmentSortBy || 'priority');
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detailsAssignment, setDetailsAssignment] = useState(null);
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);
  const [assignmentFormDraft, setAssignmentFormDraft] = useState(null);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [analyticsAssignments, setAnalyticsAssignments] = useState([]);
  const [analyticsSubmissions, setAnalyticsSubmissions] = useState([]);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const debouncedAssignmentSearch = useDebouncedValue(assignmentSearchTerm, 350);
  const debouncedSubmissionsSearch = useDebouncedValue(searchTerm, 350);

  const handleResetAssignmentFilters = () => {
    setAssignmentSearchTerm('');
    setAssignmentGroupFilter('all');
    setAssignmentSortBy('priority');
    setAssignmentPage(1);
  };

  const handleResetSubmissionFilters = () => {
    setSearchTerm('');
    setAssignmentFilter('all');
    setGroupFilter('all');
    setStatusFilter('all');
    setSubmissionPage(1);
  };

  const loadAnalyticsSnapshot = useCallback(async () => {
    if (!user) return;

    try {
      const [assignmentsRes, submissionsRes] = await Promise.all([
        api.get('/assignments', { params: { sort: 'newest' } }),
        api.get('/submissions', { params: { sort: 'newest' } }),
      ]);

      const analyticsAssignmentList = Array.isArray(assignmentsRes.data?.data)
        ? assignmentsRes.data.data
        : (assignmentsRes.data || []);
      const analyticsSubmissionList = Array.isArray(submissionsRes.data?.data)
        ? submissionsRes.data.data
        : (submissionsRes.data || []);

      setAnalyticsAssignments(analyticsAssignmentList);
      setAnalyticsSubmissions(analyticsSubmissionList);
      setAnalyticsLoaded(true);
    } catch (error) {
      setAnalyticsLoaded(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTeacherMeta();
      loadAnalyticsSnapshot();
    }
  }, [user, loadTeacherMeta, loadAnalyticsSnapshot]);

  useEffect(() => {
    if (activeTab === 'analytics' && !analyticsLoaded) {
      loadAnalyticsSnapshot();
    }
  }, [activeTab, analyticsLoaded, loadAnalyticsSnapshot]);

  useEffect(() => {
    if (activeTab === 'assignments' || activeTab === 'completed') {
      setAssignmentPage(1);
    }
    if (activeTab === 'submissions') {
      setSubmissionPage(1);
    }
  }, [activeTab]);

  useEffect(() => {
    loadTeacherAssignments({
      page: assignmentPage,
      perPage: PAGINATION_DEFAULTS.teacherAssignments,
      sort: assignmentSortBy,
      search: debouncedAssignmentSearch || undefined,
      group: assignmentGroupFilter !== 'all' ? assignmentGroupFilter : undefined,
      status: activeTab === 'completed' ? 'archived' : (activeTab === 'assignments' ? 'not_archived' : undefined),
    });
  }, [activeTab, assignmentPage, assignmentSortBy, debouncedAssignmentSearch, assignmentGroupFilter, loadTeacherAssignments]);

  useEffect(() => {
    if (activeTab !== 'submissions') {
      return;
    }

    loadTeacherSubmissions({
      page: submissionPage,
      perPage: PAGINATION_DEFAULTS.teacherSubmissions,
      sort: 'newest',
      search: debouncedSubmissionsSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      subjectId: assignmentFilter !== 'all' ? assignmentFilter : undefined,
      group: groupFilter !== 'all' ? groupFilter : undefined,
    });
  }, [activeTab, submissionPage, debouncedSubmissionsSearch, statusFilter, assignmentFilter, groupFilter, loadTeacherSubmissions]);

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
        assignmentSortBy,
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
    assignmentSortBy,
  ]);

  const {
    dashboardStats,
    filteredSubmissions,
    filteredAssignments,
    filteredActiveAssignments,
    filteredCompletedAssignments
  } = useMemo(() => {
    const completedAssignmentsCount = analyticsAssignments.filter((assignment) => assignment.isCompleted || assignment.status === 'archived').length;
    const activeAssignmentsCount = analyticsAssignments.length - completedAssignmentsCount;
    const hasAssignmentsTotal = assignmentsMeta?.total !== undefined && assignmentsMeta?.total !== null;
    const hasSubmissionsTotal = submissionsMeta?.total !== undefined && submissionsMeta?.total !== null;

    const dashboardStats = {
      totalAssignments: hasAssignmentsTotal ? Number(assignmentsMeta.total) : activeAssignmentsCount,
      completedAssignments: completedAssignmentsCount,
      pendingSubmissions: hasSubmissionsTotal
        ? Number(submissionsMeta.total)
        : analyticsSubmissions.filter(s => s.status === 'submitted').length,
      gradedSubmissions: analyticsSubmissions.filter(s => s.status === 'graded').length,
      returnedSubmissions: analyticsSubmissions.filter(s => s.status === 'returned').length,
      totalSubmissions: analyticsSubmissions.length
    };
    const filteredSubs = [...submissions];
    const filteredAssigns = [...assignments];

    const activeAssignments = filteredAssigns.filter(
      (assignment) => !(assignment.isCompleted || assignment.status === 'archived')
    );
    const completedAssignments = filteredAssigns.filter(
      (assignment) => assignment.isCompleted || assignment.status === 'archived'
    );

    return {
      dashboardStats,
      filteredSubmissions: filteredSubs,
      filteredAssignments: filteredAssigns,
      filteredActiveAssignments: activeAssignments,
      filteredCompletedAssignments: completedAssignments,
    };
  }, [assignments, submissions, analyticsAssignments, analyticsSubmissions, assignmentsMeta, submissionsMeta]);

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

  const submissionGroupOptions = useMemo(() => assignmentGroupOptions, [assignmentGroupOptions]);

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

  const reviewQueue = useMemo(() => (
    submissions
      .filter((submission) => submission.status === 'submitted')
      .sort((a, b) => new Date(a.submissionDate || 0) - new Date(b.submissionDate || 0))
      .slice(0, 5)
  ), [submissions]);

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
      const maxPoints = Number(criterion?.maxPoints ?? criterion?.max_points ?? 0) || 0;
      const existing = savedScores[index] || savedScores.find((item) => (item?.text || '').toString().trim() === text);
      const receivedPoints = existing?.receivedPoints ?? existing?.received_points ?? 0;

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
    setGradeData({ 
      score: submission.score || '', 
      comment: submission.teacherComment || '',
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

    try {
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
              loadAnalyticsSnapshot();
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
      const fileName = submission.fileName || 'submission-file';

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

      showInfo(`Начато скачивание файла: ${fileName}`);
    } catch (error) {
      showError('Не удалось скачать материал задания. Попробуйте еще раз.');
    }
  };

  const handleViewDetails = (submission) => {
    setSelectedSubmission(submission);  
    const relatedAssignment = assignments.find(a => a.id === submission.assignmentId);
    setSelectedAssignment(relatedAssignment);
    setShowDetailsModal(true);
  };

  const handleViewSubmissions = (assignmentId) => {
    const relatedAssignment = assignments.find((assignment) => Number(assignment.id) === Number(assignmentId));
    const nextSubjectId = relatedAssignment?.subjectId || relatedAssignment?.subject_id;
    setAssignmentFilter(nextSubjectId ? String(nextSubjectId) : 'all');
    setStatusFilter('all');
    setSubmissionPage(1);
    setActiveTab('submissions');
  };

  const handleViewAssignmentDetails = (assignment) => {
    setDetailsAssignment(assignment);
    setShowAssignmentDetails(true);
  };

  const handleCloseAssignmentDetails = () => {
    setDetailsAssignment(null);
    setShowAssignmentDetails(false);
  };

  const handleEditAssignmentFromDetails = (assignment) => {
    if (!assignment) return;
    setDetailsAssignment(null);
    setShowAssignmentDetails(false);
    setSelectedAssignment(assignment);
    setShowAssignmentModal(true);
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

    try {
      const result = await deleteAssignment(assignment.id);
      if (result.success) {
        loadAnalyticsSnapshot();
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
        loadAnalyticsSnapshot();
        setAssignmentFormDraft(null);
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
            assignmentSortBy={assignmentSortBy}
            assignmentGroupOptions={assignmentGroupOptions}
            submissionGroupOptions={submissionGroupOptions}
            assignmentsMeta={assignmentsMeta}
            submissionsMeta={submissionsMeta}
            onAssignmentFilterChange={(value) => {
              setAssignmentFilter(value);
              setSubmissionPage(1);
            }}
            onAssignmentSortChange={setAssignmentSortBy}
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
            onResetAssignmentFilters={handleResetAssignmentFilters}
            onResetSubmissionFilters={handleResetSubmissionFilters}
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
            reviewQueue={reviewQueue}
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
        initialFormData={
          selectedAssignment && assignmentFormDraft?.assignmentId === selectedAssignment.id
            ? assignmentFormDraft.data
            : null
        }
      />

      <AssignmentDetailsModal
        assignment={detailsAssignment}
        isOpen={showAssignmentDetails}
        onClose={handleCloseAssignmentDetails}
        mode="teacher"
        stats={detailsAssignment ? calculateSubmissionStats(detailsAssignment.submissions || [], detailsAssignment) : null}
        onEdit={handleEditAssignmentFromDetails}
        onDownloadMaterial={handleDownloadAssignmentMaterial}
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

const LoadingState = () => (
  <div className="loading-state">
    <div className="spinner"></div>
    <p>Загрузка дашборда...</p>
  </div>
);

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
  assignmentSortBy,
  assignmentGroupOptions,
  submissionGroupOptions,
  assignmentsMeta,
  submissionsMeta,
  onAssignmentFilterChange,
  onGroupFilterChange,
  onStatusFilterChange,
  onSearchChange,
  onAssignmentSearchChange,
  onAssignmentGroupFilterChange,
  onResetAssignmentFilters,
  onResetSubmissionFilters,
  onAssignmentSortChange,
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
  reviewQueue
}) => {
  const renderSection = () => {
    switch (activeTab) {
      case 'assignments':
        return (
          <AssignmentsSection
            activeAssignments={activeAssignments}
            searchTerm={assignmentSearchTerm}
            groupFilter={assignmentGroupFilter}
            availableGroups={assignmentGroupOptions}
            sortBy={assignmentSortBy}
            onSearchChange={onAssignmentSearchChange}
            onGroupFilterChange={onAssignmentGroupFilterChange}
            onSortChange={onAssignmentSortChange}
            onResetFilters={onResetAssignmentFilters}
            paginationMeta={assignmentsMeta}
            onPrevPage={onPrevAssignmentsPage}
            onNextPage={onNextAssignmentsPage}
            onCreateAssignment={onCreateAssignment}
            onViewSubmissions={onViewSubmissions}
            onViewDetails={onViewAssignmentDetails}
            onDeleteAssignment={onDeleteAssignment}
          />
        );

      case 'completed':
        return (
          <CompletedAssignmentsSection
            completedAssignments={completedAssignments}
            searchTerm={assignmentSearchTerm}
            groupFilter={assignmentGroupFilter}
            availableGroups={assignmentGroupOptions}
            sortBy={assignmentSortBy}
            onSearchChange={onAssignmentSearchChange}
            onGroupFilterChange={onAssignmentGroupFilterChange}
            onSortChange={onAssignmentSortChange}
            onResetFilters={onResetAssignmentFilters}
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
            paginationMeta={submissionsMeta}
            onPrevPage={onPrevSubmissionsPage}
            onNextPage={onNextSubmissionsPage}
            onGradeSubmission={onGradeSubmission}
            onReturnSubmission={onReturnSubmission}
            onDownloadFile={onDownloadFile}
            onViewDetails={onViewDetails}
            reviewQueue={reviewQueue}
          />
        );
      
      case 'analytics':
        return <AnalyticsSection submissions={analyticsSubmissions} assignments={analyticsAssignments} />;
      
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

const TeacherPriorityBlock = ({ reviewQueue = [], onViewDetails }) => {
  if (reviewQueue.length === 0) {
    return null;
  }

  return (
    <section className="teacher-priority-block">
      <div className="teacher-priority-block__header">
        <h3>Сначала проверить</h3>
        <span className="teacher-priority-block__count">{reviewQueue.length}</span>
      </div>
      <div className="teacher-priority-block__list">
        {reviewQueue.map((submission) => (
          <button
            key={`queue-${submission.id}`}
            type="button"
            className="teacher-priority-block__item"
            onClick={() => onViewDetails?.(submission)}
          >
            <span className="teacher-priority-block__student">{submission.studentName}</span>
            <span className="teacher-priority-block__assignment" title={submission.assignmentTitle}>
              {submission.assignmentTitle}
            </span>
            {submission.submissionDate && (
              <span className="teacher-priority-block__meta">
                Сдано: {formatDate(submission.submissionDate)}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
};

const AssignmentsSection = ({
  activeAssignments,
  searchTerm,
  groupFilter,
  availableGroups,
  sortBy,
  onSearchChange,
  onGroupFilterChange,
  onSortChange,
  onResetFilters,
  paginationMeta = {},
  onPrevPage,
  onNextPage,
  onCreateAssignment,
  onViewSubmissions,
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
            placeholder="Поиск по названию, предмету..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="sort-filter">
          <select
            value={groupFilter}
            onChange={(e) => onGroupFilterChange(e.target.value)}
            className="filter-select group-filter"
          >
            <option value="all">Все группы</option>
            {availableGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>
        <div className="sort-filter">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="sort-select subject-filter"
          >
            <option value="priority">По приоритету</option>
            <option value="deadline">По ближайшему сроку</option>
            <option value="deadline_desc">По дальнему сроку</option>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="subject">По предмету</option>
            <option value="title">По названию</option>
            <option value="submissions">По количеству работ</option>
          </select>
        </div>
        <Button variant="secondary" onClick={onResetFilters}>
          Сбросить фильтры
        </Button>
      </div>
    </div>

    {activeAssignments.length > 0 ? (
      <div className="assignments-grid">
        {activeAssignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            onViewSubmissions={() => onViewSubmissions(assignment.id)}
            onViewDetails={() => onViewDetails && onViewDetails(assignment)}
            onDeleteAssignment={onDeleteAssignment ? () => onDeleteAssignment(assignment) : undefined}
          />
        ))}
      </div>
    ) : (
      <div className="empty-state">
        <p>Нет активных заданий по текущим фильтрам</p>
      </div>
    )}
    <Pagination
      currentPage={paginationMeta.currentPage}
      lastPage={paginationMeta.lastPage}
      total={paginationMeta.total}
      fallbackCount={activeAssignments.length}
      onPrev={onPrevPage}
      onNext={onNextPage}
    />
  </div>
);

const CompletedAssignmentsSection = ({
  completedAssignments,
  searchTerm,
  groupFilter,
  availableGroups,
  sortBy,
  onSearchChange,
  onGroupFilterChange,
  onSortChange,
  onResetFilters,
  paginationMeta = {},
  onPrevPage,
  onNextPage,
  onViewSubmissions,
  onViewDetails,
  onDeleteAssignment
}) => (
  <div className="assignments-section">
    <div className="section-header">
      <h2>Завершенные задания</h2>
    </div>

    <div className="filters-section">
      <div className="controls-row">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск по названию, предмету..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="sort-filter">
          <select
            value={groupFilter}
            onChange={(e) => onGroupFilterChange(e.target.value)}
            className="filter-select group-filter"
          >
            <option value="all">Все группы</option>
            {availableGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>
        <div className="sort-filter">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="sort-select subject-filter"
          >
            <option value="priority">По приоритету</option>
            <option value="deadline">По ближайшему сроку</option>
            <option value="deadline_desc">По дальнему сроку</option>
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="subject">По предмету</option>
            <option value="title">По названию</option>
            <option value="submissions">По количеству работ</option>
          </select>
        </div>
        <Button variant="secondary" onClick={onResetFilters}>
          Сбросить фильтры
        </Button>
      </div>
    </div>

    {completedAssignments.length > 0 ? (
      <div className="assignments-grid">
        {completedAssignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            onViewSubmissions={() => onViewSubmissions(assignment.id)}
            onViewDetails={() => onViewDetails && onViewDetails(assignment)}
            onDeleteAssignment={onDeleteAssignment ? () => onDeleteAssignment(assignment) : undefined}
          />
        ))}
      </div>
    ) : (
      <div className="empty-state">
        <p>Нет завершенных заданий по текущим фильтрам</p>
      </div>
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
  paginationMeta = {},
  onPrevPage,
  onNextPage,
  onGradeSubmission,
  onReturnSubmission,
  onDownloadFile,
  onViewDetails,
  reviewQueue
}) => (
  <div className="submissions-section">
    <div className="section-header teacher-submissions-header">
      <h2>Работы студентов</h2>
      <div className="teacher-submissions-filters">
        <div className="teacher-submissions-search-row">
          <div className="teacher-submissions-search-box">
            <input
              type="text"
              placeholder="Поиск по студенту, заданию, группе..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="teacher-submissions-search-input"
            />
          </div>
          <Button variant="secondary" className="teacher-submissions-reset-btn" onClick={onResetFilters}>
            Сбросить фильтры
          </Button>
        </div>
        <div className="teacher-submissions-divider" />
        <div className="teacher-submissions-selects-row">
          <select
            value={assignmentFilter}
            onChange={(e) => onAssignmentFilterChange(e.target.value)}
            className="teacher-submissions-select assignment-filter"
          >
            <option value="all">Все предметы</option>
            {assignmentOptions.map(assignment => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.title}
              </option>
            ))}
          </select>
          <select
            value={groupFilter}
            onChange={(e) => onGroupFilterChange(e.target.value)}
            className="teacher-submissions-select group-filter"
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
            className="teacher-submissions-select status-filter"
          >
            <option value="all">Все статусы</option>
            <option value="submitted">На проверке</option>
            <option value="returned">Возвращены на доработку</option>
            <option value="graded">Зачтены</option>
          </select>
        </div>
      </div>
    </div>

    <TeacherPriorityBlock
      reviewQueue={reviewQueue}
      onViewDetails={onViewDetails}
    />

    <SubmissionsTable
      submissions={submissions}
      assignments={assignmentOptions}
      onGradeSubmission={onGradeSubmission}
      onReturnSubmission={onReturnSubmission}
      onDownloadFile={onDownloadFile}
      onViewDetails={onViewDetails}
    />
    <Pagination
      currentPage={paginationMeta.currentPage}
      lastPage={paginationMeta.lastPage}
      total={paginationMeta.total}
      fallbackCount={submissions.length}
      onPrev={onPrevPage}
      onNext={onNextPage}
    />
  </div>
);

export default TeacherDashboard;