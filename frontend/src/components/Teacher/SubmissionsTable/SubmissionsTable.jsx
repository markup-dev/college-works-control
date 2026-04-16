import React, { useMemo, useState } from 'react';
import Button from '../../UI/Button/Button';
import { formatDate, getSubmissionStatusInfo } from '../../../utils';
import './SubmissionsTable.scss';

const SubmissionsTable = ({
  submissions = [],
  assignments = [],
  onGradeSubmission,
  onDownloadFile,
  onViewDetails,
  className = "",
  loading = false,
  showLatestOnly = true
}) => {
  const [sortBy, setSortBy] = useState('review_first');

  const latestSubmissions = useMemo(() => {
    if (!showLatestOnly || submissions.length === 0) {
      return submissions;
    }

    const unique = new Map();
    [...submissions]
      .sort((a, b) => new Date(b?.submissionDate || 0) - new Date(a?.submissionDate || 0))
      .forEach((submission) => {
        const key = `${submission.assignmentId}_${submission.studentLogin}`;
        if (!unique.has(key)) {
          unique.set(key, submission);
        }
      });

    return Array.from(unique.values());
  }, [submissions, showLatestOnly]);

  const sortedSubmissions = useMemo(() => {
    const sorted = [...latestSubmissions];
    sorted.sort((a, b) => {
      const aDate = new Date(a?.submissionDate || 0);
      const bDate = new Date(b?.submissionDate || 0);
      switch (sortBy) {
        case 'review_first': {
          const rank = (status) => {
            if (status === 'submitted') return 0;
            if (status === 'returned') return 1;
            if (status === 'graded') return 2;
            return 3;
          };
          const rankDiff = rank(a?.status) - rank(b?.status);
          if (rankDiff !== 0) {
            return rankDiff;
          }
          return bDate - aDate;
        }
        case 'submissionDate_asc':
          return aDate - bDate;
        case 'student_asc':
          return (a?.studentName || '').localeCompare(b?.studentName || '');
        case 'student_desc':
          return (b?.studentName || '').localeCompare(a?.studentName || '');
        case 'score_desc':
          return (b?.score ?? -1) - (a?.score ?? -1);
        case 'score_asc':
          return (a?.score ?? -1) - (b?.score ?? -1);
        case 'submissionDate_desc':
        default:
          return bDate - aDate;
      }
    });
    return sorted;
  }, [latestSubmissions, sortBy]);

  if (loading) {
    return <CardsSkeleton />;
  }

  if (latestSubmissions.length === 0) {
    return (
      <div className="submissions-cards-empty">
        <h3>Работы не найдены</h3>
        <p>Попробуйте изменить параметры фильтрации</p>
      </div>
    );
  }

  return (
    <div className={`submissions-cards ${className}`}>
      <div className="submissions-cards__header">
        <p className="submissions-cards__count">
          Найдено работ: <strong>{latestSubmissions.length}</strong>
          {showLatestOnly && submissions.length > latestSubmissions.length && (
            <span className="submissions-cards__hint">(показаны только последние отправки)</span>
          )}
        </p>

        <select
          className="submissions-cards__sort-select"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="review_first">Сначала на проверке</option>
          <option value="submissionDate_desc">Сначала новые сдачи</option>
          <option value="submissionDate_asc">Сначала старые сдачи</option>
          <option value="score_desc">Оценка по убыванию</option>
          <option value="score_asc">Оценка по возрастанию</option>
        </select>
      </div>

      <div className="submissions-cards__list">
        {sortedSubmissions.map((submission) => (
          <SubmissionCard
            key={submission.id}
            submission={submission}
            assignment={assignments.find((item) => item.id === submission.assignmentId)}
            onGradeSubmission={onGradeSubmission}
            onDownloadFile={onDownloadFile}
            onViewDetails={onViewDetails}
          />
        ))}
      </div>
    </div>
  );
};

const SubmissionCard = ({
  submission,
  assignment,
  onGradeSubmission,
  onDownloadFile,
  onViewDetails
}) => {
  const statusInfo = getSubmissionStatusInfo(submission.status);
  const maxScore = assignment?.maxScore || submission.maxScore || 100;
  const effectiveSubmissionType = assignment?.submissionType || submission.submissionType || 'file';
  const isDemoSubmission = effectiveSubmissionType === 'demo';

  return (
    <article className="submission-card" onClick={() => onViewDetails?.(submission)}>
      <div className="submission-card__top">
        <div>
          <h4 className="submission-card__student">{submission.studentName || 'Студент не указан'}</h4>
          <p className="submission-card__group">{submission.group || 'Группа не указана'}</p>
        </div>
        <div className="submission-card__status-stack">
          <span className={`submission-card__status submission-card__status--${statusInfo.variant}`}>
            {statusInfo.label}
          </span>
          {submission.isResubmission && <span className="submission-card__resubmission">Пересдача</span>}
        </div>
      </div>

      <div className="submission-card__middle">
        <div className="submission-card__assignment">
          <p className="submission-card__assignment-title">{submission.assignmentTitle || 'Без названия'}</p>
        </div>
        {isDemoSubmission && (
          <p className="submission-card__meta-line">Демонстрация без файла</p>
        )}

        <div className="submission-card__footer">
          <p className="submission-card__meta-line">{formatSubmissionDate(submission.submissionDate)}</p>
          <p className="submission-card__score"><span>Оценка:</span> {formatScore(submission.score, maxScore)}</p>
        </div>
      </div>

      <div className="submission-card__actions">
        {submission.fileName && (
          <Button
            variant="secondary"
            size="small"
            className="submission-card__action-btn submission-card__action-btn--download"
            onClick={(event) => {
              event.stopPropagation();
              onDownloadFile?.(submission);
            }}
          >
            Скачать файл
          </Button>
        )}

        {submission.status === 'submitted' && (
          <Button
            variant="primary"
            size="small"
            className="submission-card__action-btn"
            onClick={(event) => {
              event.stopPropagation();
              onGradeSubmission?.(submission);
            }}
          >
            Оценить
          </Button>
        )}

        {submission.status === 'graded' && (
          <Button
            variant="primary"
            size="small"
            className="submission-card__action-btn submission-card__action-btn--edit"
            onClick={(event) => {
              event.stopPropagation();
              onGradeSubmission?.(submission);
            }}
          >
            Изменить оценку
          </Button>
        )}

        {submission.status === 'returned' && (
          <Button
            variant="primary"
            size="small"
            className="submission-card__action-btn"
            onClick={(event) => {
              event.stopPropagation();
              onGradeSubmission?.(submission);
            }}
          >
            Проверить
          </Button>
        )}
      </div>
    </article>
  );
};

const formatSubmissionDate = (date) => {
  if (!date || date === 'Дата не указана') {
    return '—';
  }
  try {
    return formatDate(date);
  } catch {
    return '—';
  }
};

const formatScore = (score, maxScore) => {
  if (score === null || score === undefined) {
    return '—';
  }
  return `${score}/${maxScore}`;
};

const CardsSkeleton = () => (
  <div className="submissions-cards">
    <div className="submissions-cards__list">
      {[...Array(4)].map((_, index) => (
        <div className="submission-card submission-card--skeleton" key={`skeleton-${index}`} />
      ))}
    </div>
  </div>
);

export default SubmissionsTable;