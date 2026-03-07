import React, { useState, useMemo } from 'react';
import Button from '../../UI/Button/Button';
import { formatDate, getSubmissionStatusInfo, formatFileSize } from '../../../utils';
import './SubmissionsTable.scss';

const SubmissionsTable = ({ 
  submissions = [], 
  assignments = [], 
  onGradeSubmission, 
  onReturnSubmission,
  onDownloadFile,
  onViewDetails,
  className = "",
  loading = false,
  showLatestOnly = true
}) => {
  const [sortField, setSortField] = useState('submissionDate');
  const [sortDirection, setSortDirection] = useState('desc');

  const filteredSubmissions = useMemo(() => {
    if (!showLatestOnly || submissions.length === 0) {
      return submissions;
    }

    const latestSubmissions = [];
    const seen = new Map();
    
    const sortedSubmissions = [...submissions].sort((a, b) => 
      new Date(b.submissionDate) - new Date(a.submissionDate)
    );

    for (const submission of sortedSubmissions) {
      const key = `${submission.assignmentId}_${submission.studentLogin}`;
      if (!seen.has(key)) {
        seen.set(key, true);
        latestSubmissions.push(submission);
      }
    }

    return latestSubmissions;
  }, [submissions, showLatestOnly]);

  const sortedSubmissions = useMemo(() => {
    return [...filteredSubmissions].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      if (sortField === 'submissionDate') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }
      
      if (sortField === 'score') {
        aValue = aValue ?? -1;
        bValue = bValue ?? -1;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSubmissions, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleGrade = (submission) => {
    onGradeSubmission?.(submission);
  };

  const handleReturn = (submission) => {
    onReturnSubmission?.(submission);
  };

  const handleDownload = (submission) => {
    onDownloadFile?.(submission);
  };

  const handleViewDetails = (submission) => {
    onViewDetails?.(submission);
  };

  if (loading) {
    return <TableSkeleton />;
  }

  if (filteredSubmissions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <h3>Работы не найдены</h3>
        <p>Попробуйте изменить параметры фильтрации</p>
      </div>
    );
  }

  return (
    <div className={`submissions-table-container ${className}`}>
      <div className="table-header">
        <div className="table-info">
          <span className="table-count">
            Найдено работ: <strong>{filteredSubmissions.length}</strong>
            {showLatestOnly && submissions.length > filteredSubmissions.length && (
              <span className="duplicates-info">
                (показаны только последние отправки)
              </span>
            )}
          </span>
          <span className="table-sort">
            Сортировка: {getSortFieldLabel(sortField)} ({sortDirection === 'asc' ? '↑' : '↓'})
          </span>
        </div>
      </div>

      <div className="table-scroll-container">
        <table className="submissions-table">
          <thead>
            <tr>
              <SortableHeader
                field="studentName"
                label="Студент"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <th className="assignment-column">Задание</th>
              <th className="group-column">Группа</th>
              <SortableHeader
                field="submissionDate"
                label="Дата сдачи"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                className="date-column"
              />
              <th className="file-column">Файл</th>
              <SortableHeader
                field="status"
                label="Статус"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                className="status-column"
              />
              <SortableHeader
                field="score"
                label="Оценка"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                className="score-column"
              />
              <th className="actions-column">Действия</th>
            </tr>
          </thead>
          <tbody>
            {sortedSubmissions.map(submission => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                assignment={assignments.find(a => a.id === submission.assignmentId)}
                onGrade={handleGrade}
                onReturn={handleReturn}
                onDownload={handleDownload}
                onViewDetails={handleViewDetails}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SortableHeader = ({ field, label, sortField, sortDirection, onSort, className = '' }) => (
  <th 
    className={`sortable-header ${sortField === field ? 'active' : ''} ${className}`}
    onClick={() => onSort(field)}
  >
    <span className="header-content">
      {label}
      <span className="sort-indicator">
        {sortField === field && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
      </span>
    </span>
  </th>
);

const SubmissionRow = React.memo(({ submission, assignment, onGrade, onReturn, onDownload, onViewDetails }) => {
  const statusInfo = getSubmissionStatusInfo(submission.status);
  const maxScore = assignment?.maxScore || submission.maxScore || 100;
  const submissionDate = submission.submissionDate;

  return (
    <tr className="submission-row">
      <td className="student-column">
        <StudentInfo 
          student={submission.studentName}
          studentId={submission.studentId}
        />
      </td>
      <td className="assignment-column">
        <AssignmentInfo 
          title={submission.assignmentTitle}
          isResubmission={submission.isResubmission}
        />
      </td>
      <td className="group-column">
        <GroupTag group={submission.group} />
      </td>
      <td className="date-column">
        <SubmitDate date={submissionDate} />
      </td>
      <td className="file-column">
        <FileInfo 
          fileName={submission.fileName}
          fileSize={submission.fileSize}
          onDownload={() => onDownload(submission)}
        />
      </td>
      <td className="status-column">
        <StatusBadge statusInfo={statusInfo} />
      </td>
      <td className="score-column">
        <ScoreDisplay 
          score={submission.score} 
          maxScore={maxScore}
        />
      </td>
      <td className="actions-column">
        <ActionButtons 
          submission={submission}
          onGrade={() => onGrade(submission)}
          onReturn={() => onReturn(submission)}
          onViewDetails={() => onViewDetails(submission)}
        />
      </td>
    </tr>
  );
});

const StudentInfo = ({ student, studentId }) => (
  <div className="student-info">
    <div className="student-name">{student}</div>
    {studentId && (
      <div className="student-id">ID: {studentId}</div>
    )}
  </div>
);

const AssignmentInfo = ({ title, isResubmission }) => (
  <div className="assignment-info">
    <div className="assignment-title">{title}</div>
    {isResubmission && (
      <div className="resubmission-badge">Пересдача</div>
    )}
  </div>
);

const GroupTag = ({ group }) => (
  <span className="group-tag">{group}</span>
);

const SubmitDate = ({ date }) => {
  if (!date || date === 'Дата не указана') {
    return <div className="submit-date no-date">—</div>;
  }
  
  try {
    const formattedDate = formatDate(date);
    return <div className="submit-date">{formattedDate}</div>;
  } catch (error) {
    return <div className="submit-date invalid-date">—</div>;
  }
};

const FileInfo = ({ fileName, fileSize, onDownload }) => (
  <div className="file-info">
    <button 
      className="file-download-btn"
      onClick={onDownload}
      title={`Скачать: ${fileName}`}
    >
      <span className="file-icon">📄</span>
      <span className="file-name">{fileName}</span>
    </button>
    {fileSize && fileSize !== '0.0 MB' && (
      <div className="file-size">{formatFileSize(fileSize)}</div>
    )}
  </div>
);

const StatusBadge = ({ statusInfo }) => (
  <span className={`status-badge status-badge--${statusInfo.variant}`}>
    {statusInfo.icon} {statusInfo.label}
  </span>
);

const ScoreDisplay = ({ score, maxScore }) => {
  if (score === null || score === undefined) {
    return <span className="no-score">—</span>;
  }
  
  return (
    <span className="score-display">
      {score}<span className="score-separator">/</span>{maxScore}
    </span>
  );
};

const ActionButtons = React.memo(({ submission, onGrade, onReturn, onViewDetails }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await action();
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="action-buttons">
      <Button 
        variant="outline" 
        size="small"
        onClick={() => handleAction(onViewDetails)}
        disabled={isLoading}
        icon="👁"
        className="action-btn"
      >
        Детали
      </Button>
      
      {submission.status === 'submitted' && (
        <>
          <Button 
            variant="primary" 
            size="small"
            onClick={() => handleAction(onGrade)}
            disabled={isLoading}
            icon="✅"
            className="action-btn"
          >
            Оценить
          </Button>
          <Button 
            variant="warning" 
            size="small"
            onClick={() => handleAction(onReturn)}
            disabled={isLoading}
            icon="↩️"
            className="action-btn"
          >
            Вернуть
          </Button>
        </>
      )}
      
      {submission.status === 'graded' && (
        <Button 
          variant="outline" 
          size="small"
          onClick={() => handleAction(onGrade)}
          disabled={isLoading}
          icon="✏️"
          className="action-btn"
        >
          Изменить
        </Button>
      )}

      {submission.status === 'returned' && (
        <Button 
          variant="primary" 
          size="small"
          onClick={() => handleAction(onGrade)}
          disabled={isLoading}
          icon="✅"
          className="action-btn"
        >
          Проверить
        </Button>
      )}
    </div>
  );
});

const TableSkeleton = () => (
  <div className="submissions-table-container">
    <div className="table-skeleton">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="skeleton-row">
          <div className="skeleton-cell student"></div>
          <div className="skeleton-cell assignment"></div>
          <div className="skeleton-cell group"></div>
          <div className="skeleton-cell date"></div>
          <div className="skeleton-cell file"></div>
          <div className="skeleton-cell status"></div>
          <div className="skeleton-cell score"></div>
          <div className="skeleton-cell actions"></div>
        </div>
      ))}
    </div>
  </div>
);

const getSortFieldLabel = (field) => {
  const labels = {
    studentName: 'Студент',
    group: 'Группа',
    submissionDate: 'Дата сдачи',
    status: 'Статус',
    score: 'Оценка'
  };
  return labels[field] || field;
};

export default SubmissionsTable;