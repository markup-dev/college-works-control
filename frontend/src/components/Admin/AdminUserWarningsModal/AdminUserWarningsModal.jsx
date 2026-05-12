import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateLong } from '../../../utils/dateHelpers';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import Button from '../../UI/Button/Button';
import './AdminUserWarningsModal.scss';

const userDisplayName = (row) => {
  if (!row) return 'Пользователь';
  const p = [row.lastName, row.firstName, row.middleName].filter(Boolean);
  if (p.length) return p.join(' ');
  return row.login || row.email || 'Пользователь';
};

const AdminUserWarningsModal = ({ isOpen, onClose, loading, detail, userRow }) => {
  const navigate = useNavigate();

  const titleName = useMemo(() => detail?.displayName || userDisplayName(userRow), [detail?.displayName, userRow]);

  const studentPayload = detail?.student;
  const teacherPayload = detail?.teacher;

  const goHomeworkStudent = () => {
    const gid = userRow?.studentGroup?.id ?? userRow?.groupId ?? userRow?.group_id;
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

  const studentHasContent =
    detail?.role === 'student' &&
    ((studentPayload?.overdueAssignments?.length ?? 0) > 0 || studentPayload?.noSubmissionsWeek != null);

  const roleLabel = detail?.role === 'student' ? 'Студент' : detail?.role === 'teacher' ? 'Преподаватель' : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Предупреждения: ${titleName}`}
      size="medium"
      className="admin-user-warnings-modal--root"
      contentClassName="admin-user-warnings-modal"
      footer={(
        <>
          {detail?.role === 'student' && (
            <Button type="button" variant="primary" onClick={goHomeworkStudent}>
              К заданиям студента
            </Button>
          )}
          {detail?.role === 'teacher' && (
            <Button type="button" variant="primary" onClick={goHomeworkTeacher}>
              К заданиям (на проверке)
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </>
      )}
    >
        {loading && <p className="admin-user-warnings-modal__muted">Загрузка…</p>}

        {!loading && roleLabel && (
          <ModalSection variant="soft">
            <span className="admin-user-warnings-modal__summary-role">{roleLabel}</span>
            <p className="admin-user-warnings-modal__summary-text">
              Список ниже показывает активные сигналы риска по текущим правилам контроля.
            </p>
          </ModalSection>
        )}

        {!loading && detail?.role === 'admin' && (
          <p className="admin-user-warnings-modal__muted">Для администраторов предупреждения не отображаются.</p>
        )}

        {!loading && detail?.role === 'student' && (
          <ModalSection title="Активные проблемы">
            <div className="admin-user-warnings-modal__box admin-user-warnings-modal__box--student">
              {(studentPayload?.overdueAssignments?.length ?? 0) > 0 && (
                <div className="admin-user-warnings-modal__block admin-user-warnings-modal__block--danger">
                  <div className="admin-user-warnings-modal__block-title">
                    Просроченные дедлайны ({studentPayload.overdueAssignments.length})
                  </div>
                  <ul className="admin-user-warnings-modal__list">
                    {studentPayload.overdueAssignments.map((a, i) => (
                      <li key={`${a.title}-${a.deadline}-${i}`}>
                        {a.title} <span className="admin-user-warnings-modal__date">({formatDateLong(a.deadline)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {studentPayload?.noSubmissionsWeek != null && (
                <div className="admin-user-warnings-modal__block admin-user-warnings-modal__block--warn">
                  <div className="admin-user-warnings-modal__block-title">Нет сдач за 7 дней</div>
                  <p className="admin-user-warnings-modal__para">
                    Последняя сдача:{' '}
                    <strong>{formatDateLong(studentPayload.noSubmissionsWeek.lastSubmissionAt)}</strong>
                  </p>
                </div>
              )}

              {!studentHasContent && (
                <p className="admin-user-warnings-modal__empty">Нет активных проблем по текущим правилам.</p>
              )}
            </div>
          </ModalSection>
        )}

        {!loading && detail?.role === 'teacher' && (
          <ModalSection title="Активные проблемы">
            <div className="admin-user-warnings-modal__box admin-user-warnings-modal__box--teacher">
              {(teacherPayload?.staleReviews?.length ?? 0) > 0 ? (
                <div className="admin-user-warnings-modal__block admin-user-warnings-modal__block--danger">
                  <div className="admin-user-warnings-modal__block-title">
                    Работы без проверки более 3 суток ({teacherPayload.staleReviews.length})
                  </div>
                  <ul className="admin-user-warnings-modal__list">
                    {teacherPayload.staleReviews.map((r, i) => (
                      <li key={`${r.assignmentTitle}-${i}`}>
                        {r.assignmentTitle}{' '}
                        <span className="admin-user-warnings-modal__date">
                          (сдано {formatDateLong(r.submittedAt)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="admin-user-warnings-modal__empty">Нет работ в очереди проверки по этому правилу.</p>
              )}
            </div>
          </ModalSection>
        )}
    </Modal>
  );
};

export default AdminUserWarningsModal;
