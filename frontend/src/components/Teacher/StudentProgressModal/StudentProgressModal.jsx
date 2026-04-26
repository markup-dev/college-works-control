import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import Button from '../../UI/Button/Button';
import { formatDate } from '../../../utils';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

const getErrorMessage = (err, fallback) => {
  const msg = err?.response?.data?.message;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
};

const statusLabel = (code) => {
  switch (code) {
    case 'not_submitted':
      return 'Не сдано';
    case 'submitted':
      return 'На проверке';
    case 'graded':
      return 'Зачтено';
    case 'returned':
      return 'На доработке';
    default:
      return code || '—';
  }
};

const StudentProgressModal = ({ isOpen, onClose, studentId, fallbackTitle = 'Студент' }) => {
  const { showError } = useNotification();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen || !studentId) {
      setPayload(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPayload(null);
      try {
        const { data } = await api.get(`/teacher/students/${studentId}`);
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) {
          showError(getErrorMessage(err, 'Не удалось загрузить успеваемость'));
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, studentId, showError]);

  if (!isOpen) return null;

  const title = payload?.student?.fullName || fallbackTitle;
  const avg = payload?.averageScore;

  return createPortal(
    (
      <div
        className="student-progress-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-progress-title"
        onClick={onClose}
      >
        <div className="student-progress-modal" onClick={(e) => e.stopPropagation()}>
        <div className="student-progress-modal__head">
          <div>
            <h2 id="student-progress-title">{title}</h2>
            {payload?.student?.groupName ? (
              <p className="student-progress-modal__group">Группа {payload.student.groupName}</p>
            ) : null}
            {avg != null ? (
              <p className="student-progress-modal__avg">
                Средний балл: <strong>{avg}</strong>
              </p>
            ) : (
              <p className="student-progress-modal__avg muted">Нет зачтённых оценок для среднего</p>
            )}
          </div>
          <button type="button" className="student-progress-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="student-progress-modal__actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              navigate('/messages', { state: { focusStudentId: studentId } });
              onClose();
            }}
          >
            Написать в чате
          </Button>
        </div>

        <div className="student-progress-modal__body">
          {loading ? (
            <p className="student-progress-modal__muted">Загрузка…</p>
          ) : !payload?.assignments?.length ? (
            <p className="student-progress-modal__muted">Нет активных заданий для этой группы</p>
          ) : (
            <>
              <div className="student-progress-modal__table-meta" aria-live="polite">
                Заданий в списке: {payload.assignments.length}
                {payload.assignments.length > 12 ? ' — прокрутите таблицу ниже' : null}
              </div>
              <div className="student-progress-modal__table-wrap">
                <table className="student-progress-modal__table">
                  <thead>
                    <tr>
                      <th>Задание</th>
                      <th>Срок</th>
                      <th>Статус</th>
                      <th>Балл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.assignments.map((row) => (
                      <tr key={row.assignmentId}>
                        <td className="student-progress-modal__cell-title">{row.title}</td>
                        <td>{row.deadline ? formatDate(row.deadline) : '—'}</td>
                        <td>{statusLabel(row.submissionStatus)}</td>
                        <td>
                          {row.submissionStatus === 'graded' && row.score != null
                            ? `${row.score} / ${row.maxScore}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    ),
    document.body,
  );
};

export default StudentProgressModal;
