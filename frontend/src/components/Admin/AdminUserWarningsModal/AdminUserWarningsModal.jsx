import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateLong } from '../../../utils/dateHelpers';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import Button from '../../UI/Button/Button';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import LoadingState from '../../UI/LoadingState/LoadingState';
import EmptyState from '../../UI/EmptyState/EmptyState';
import './AdminUserWarningsModal.scss';

const userDisplayName = (row) => {
  if (!row) return 'Пользователь';
  const p = [row.lastName, row.firstName, row.middleName].filter(Boolean);
  if (p.length) return p.join(' ');
  return row.login || row.email || 'Пользователь';
};

const formatOptionalDate = (value) => {
  if (!value) return 'Нет данных';
  const formatted = formatDateLong(value);
  return formatted && formatted !== '—' ? formatted : 'Нет данных';
};

const IssueGroup = ({ tone, label, children }) => (
  <article className="admin-user-warnings-modal__issue">
    <div className="admin-user-warnings-modal__issue-head">
      <StatusBadge tone={tone}>{label}</StatusBadge>
    </div>
    <div className="admin-user-warnings-modal__issue-body">{children}</div>
  </article>
);

const AdminUserWarningsModal = ({ isOpen, onClose, loading, detail, userRow }) => {
  const navigate = useNavigate();

  const titleName = useMemo(() => detail?.displayName || userDisplayName(userRow), [detail?.displayName, userRow]);

  const studentPayload = detail?.student;
  const teacherPayload = detail?.teacher;

  const goHomeworkStudent = () => {
    const gid = userRow?.studentGroup?.id ?? userRow?.groupId;
    const q = new URLSearchParams();
    if (gid) q.set('group_id', String(gid));
    if ((studentPayload?.overdueAssignments?.length ?? 0) > 0) {
      q.set('status', 'overdue');
    }
    const s = q.toString();
    navigate(s ? `/admin/homework?${s}` : '/admin/homework');
    onClose();
  };

  const goHomeworkTeacher = () => {
    const tid = userRow?.id;
    const q = new URLSearchParams();
    if (tid) q.set('teacher_id', String(tid));
    q.set('status', 'stale_review');
    navigate(`/admin/homework?${q.toString()}`);
    onClose();
  };

  const overdueCount = studentPayload?.overdueAssignments?.length ?? 0;
  const staleCount = teacherPayload?.staleReviews?.length ?? 0;

  const studentHasContent =
    detail?.role === 'student' &&
    (overdueCount > 0 || studentPayload?.noSubmissionsWeek != null);

  const showFooterNav =
    (detail?.role === 'student' && studentHasContent)
    || (detail?.role === 'teacher' && staleCount > 0);

  const roleLabel = detail?.role === 'student' ? 'Студент' : detail?.role === 'teacher' ? 'Преподаватель' : null;
  const roleTone = detail?.role === 'student' ? 'info' : 'neutral';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Предупреждения"
      subtitle={titleName}
      size="medium"
      className="admin-user-warnings-modal--root"
      contentClassName="admin-user-warnings-modal"
      footer={showFooterNav ? (
        <>
          {detail?.role === 'student' && studentHasContent && (
            <Button type="button" variant="outline" onClick={goHomeworkStudent}>
              К заданиям студента
            </Button>
          )}
          {detail?.role === 'teacher' && staleCount > 0 && (
            <Button type="button" variant="outline" onClick={goHomeworkTeacher}>
              К работам на проверке
            </Button>
          )}
        </>
      ) : null}
    >
      {loading && (
        <LoadingState message="Загрузка предупреждений…" className="admin-user-warnings-modal__loading" />
      )}

      {!loading && roleLabel && (
        <div className="admin-user-warnings-modal__intro">
          <StatusBadge tone={roleTone}>{roleLabel}</StatusBadge>
          <p className="admin-user-warnings-modal__intro-text">
            Ниже — активные сигналы по правилам контроля системы.
          </p>
        </div>
      )}

      {!loading && detail?.role === 'admin' && (
        <EmptyState
          asCard={false}
          title="Нет предупреждений"
          message="Для администраторов предупреждения не формируются."
          className="admin-user-warnings-modal__empty-state"
        />
      )}

      {!loading && detail?.role === 'student' && (
        <ModalSection title="Активные проблемы">
          {studentHasContent ? (
            <div className="admin-user-warnings-modal__issues">
              {overdueCount > 0 && (
                <IssueGroup
                  tone="danger"
                  label={`Просроченные дедлайны (${overdueCount})`}
                >
                  <ul className="admin-user-warnings-modal__list">
                    {studentPayload.overdueAssignments.map((assignment, index) => (
                      <li key={`${assignment.title}-${assignment.deadline}-${index}`} className="admin-user-warnings-modal__item">
                        <span className="admin-user-warnings-modal__item-title">{assignment.title}</span>
                        <span className="admin-user-warnings-modal__item-meta">
                          Дедлайн: {formatDateLong(assignment.deadline)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </IssueGroup>
              )}

              {studentPayload?.noSubmissionsWeek != null && (
                <IssueGroup tone="warning" label="Нет сдач за 7 дней">
                  <p className="admin-user-warnings-modal__item-meta admin-user-warnings-modal__item-meta--solo">
                    Последняя сдача:{' '}
                    <strong>
                      {formatOptionalDate(studentPayload.noSubmissionsWeek.lastSubmissionAt)}
                    </strong>
                  </p>
                </IssueGroup>
              )}
            </div>
          ) : (
            <EmptyState
              asCard={false}
              title="Активных проблем нет"
              message="По текущим правилам контроля замечаний не найдено."
              className="admin-user-warnings-modal__empty-state"
            />
          )}
        </ModalSection>
      )}

      {!loading && detail?.role === 'teacher' && (
        <ModalSection title="Активные проблемы">
          {staleCount > 0 ? (
            <div className="admin-user-warnings-modal__issues">
              <IssueGroup
                tone="danger"
                label={`Работы без проверки > 3 суток (${staleCount})`}
              >
                <ul className="admin-user-warnings-modal__list">
                  {teacherPayload.staleReviews.map((review, index) => (
                    <li key={`${review.assignmentTitle}-${index}`} className="admin-user-warnings-modal__item">
                      <span className="admin-user-warnings-modal__item-title">{review.assignmentTitle}</span>
                      <span className="admin-user-warnings-modal__item-meta">
                        Сдано: {formatDateLong(review.submittedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </IssueGroup>
            </div>
          ) : (
            <EmptyState
              asCard={false}
              title="Активных проблем нет"
              message="Нет работ в очереди проверки по этому правилу."
              className="admin-user-warnings-modal__empty-state"
            />
          )}
        </ModalSection>
      )}
    </Modal>
  );
};

export default AdminUserWarningsModal;
