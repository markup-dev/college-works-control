import React, { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { getApiErrorMessage } from '../../../utils/adminApiErrors';
import Button from '../../UI/Button/Button';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import Modal from '../../UI/Modal/Modal';
import ModalDangerZone from '../../UI/Modal/ModalDangerZone';
import './TeacherRequestModeration.scss';

const teacherName = (teacher) => (
  teacher?.fullName ||
  [teacher?.lastName, teacher?.firstName, teacher?.middleName].filter(Boolean).join(' ').trim() ||
  teacher?.login ||
  'Преподаватель'
);

const requestStatusLabel = (status) => {
  if (status === 'approved') return 'Одобрена';
  if (status === 'rejected') return 'Отклонена';
  return 'На рассмотрении';
};

const requestKindLabel = (kind) => (kind === 'load' ? 'Назначение на группу' : 'Допуск к дисциплине');

const TeacherRequestModeration = ({
  kind,
  title,
  description,
  emptyMessage = 'Новых заявок нет',
  className = '',
  onResolved,
}) => {
  const { showSuccess, showError } = useNotification();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [pendingResolve, setPendingResolve] = useState(null);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  const listEndpoint = kind === 'load' ? '/admin/teaching-load-requests' : '/admin/discipline-requests';
  const resolveEndpoint = (id) => `${listEndpoint}/${id}`;

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(listEndpoint, { params: { status: 'pending' } });
      setRequests(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [listEndpoint]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const resolveRequest = async (id, status) => {
    setResolveSubmitting(true);
    try {
      await api.put(resolveEndpoint(id), { status });
      showSuccess(status === 'approved' ? 'Заявка одобрена' : 'Заявка отклонена');
      setSelectedRequest(null);
      setPendingResolve(null);
      await loadRequests();
      if (typeof onResolved === 'function') {
        await onResolved();
      }
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось обработать заявку'));
      throw e;
    } finally {
      setResolveSubmitting(false);
    }
  };

  const openResolveConfirm = (request, status) => {
    setPendingResolve({ id: request.id, status, request });
  };

  const resolveConfirmMessage = () => {
    if (!pendingResolve?.request) return '';
    const teacher = teacherName(pendingResolve.request.teacher);
    const subject = pendingResolve.request.subject?.name || '—';
    if (pendingResolve.status === 'approved') {
      if (kind === 'load') {
        return `Одобрить заявку ${teacher} на назначение по дисциплине «${subject}» в группе ${pendingResolve.request.group?.name || '—'}?`;
      }
      return `Одобрить заявку ${teacher} на допуск к дисциплине «${subject}»?`;
    }
    if (kind === 'load') {
      return `Отклонить заявку ${teacher} на назначение по дисциплине «${subject}» в группе ${pendingResolve.request.group?.name || '—'}? Преподаватель получит уведомление.`;
    }
    return `Отклонить заявку ${teacher} на допуск к дисциплине «${subject}»? Преподаватель получит уведомление.`;
  };

  const renderRequestMeta = (request) => {
    if (kind === 'load') {
      return `Просит назначение: ${request.subject?.name || '—'} · ${request.group?.name || '—'}`;
    }

    return `Просит допуск к дисциплине: ${request.subject?.name || '—'}`;
  };

  const downloadAttachment = async (request) => {
    if (!request.documentUrl) {
      return;
    }

    const fileName = request.documentName || 'Вложение преподавателя';

    try {
      const response = await api.get(request.documentUrl, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      showError('Не удалось скачать вложение');
    }
  };

  const renderAttachment = (request) => {
    if (!request.documentUrl) {
      return <p>Файл не прикреплен</p>;
    }

    const fileName = request.documentName || 'Вложение преподавателя';

    return (
      <button
        type="button"
        className="teacher-request-moderation__file"
        title="Скачать вложение"
        onClick={() => void downloadAttachment(request)}
      >
        <span className="teacher-request-moderation__file-name">{fileName}</span>
        <span className="teacher-request-moderation__file-action">Скачать</span>
      </button>
    );
  };

  return (
    <section className={`teacher-request-moderation ${className}`.trim()}>
      <div className="teacher-request-moderation__head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <span className="teacher-request-moderation__count">{requests.length}</span>
      </div>

      {loading && <p className="teacher-request-moderation__empty">Загрузка заявок...</p>}
      {!loading && requests.length === 0 && (
        <p className="teacher-request-moderation__empty">{emptyMessage}</p>
      )}

      {!loading && requests.map((request) => (
        <article
          key={request.id}
          className="teacher-request-moderation__request"
          role="button"
          tabIndex={0}
          onClick={() => setSelectedRequest(request)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setSelectedRequest(request);
            }
          }}
        >
          <div className="teacher-request-moderation__request-copy">
            <strong>{teacherName(request.teacher)}</strong>
            <span>{renderRequestMeta(request)}</span>
            {request.comment && <p>{request.comment}</p>}
          </div>
          <div className="teacher-request-moderation__request-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <Button type="button" size="small" variant="primary" onClick={() => openResolveConfirm(request, 'approved')}>Одобрить</Button>
            <Button type="button" size="small" variant="danger" onClick={() => openResolveConfirm(request, 'rejected')}>Отклонить</Button>
          </div>
        </article>
      ))}

      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Заявка преподавателя"
        subtitle={requestKindLabel(kind)}
        size="medium"
        contentClassName="teacher-request-moderation__modal"
        footer={selectedRequest ? (
          <Button type="button" variant="primary" onClick={() => openResolveConfirm(selectedRequest, 'approved')}>
            Одобрить заявку
          </Button>
        ) : null}
      >
        {selectedRequest && (
          <div className="teacher-request-moderation__detail">
            <div className="teacher-request-moderation__detail-grid">
              <div className="teacher-request-moderation__detail-item">
                <span>Преподаватель</span>
                <strong>{teacherName(selectedRequest.teacher)}</strong>
              </div>
              <div className="teacher-request-moderation__detail-item">
                <span>Дисциплина</span>
                <strong>{selectedRequest.subject?.name || '—'}</strong>
              </div>
              <div className="teacher-request-moderation__detail-item">
                <span>{kind === 'load' ? 'Группа' : 'Тип заявки'}</span>
                <strong>{kind === 'load' ? selectedRequest.group?.name || '—' : requestKindLabel(kind)}</strong>
              </div>
              <div className="teacher-request-moderation__detail-item">
                <span>Статус</span>
                <strong>{requestStatusLabel(selectedRequest.status)}</strong>
              </div>
            </div>

            <div className="teacher-request-moderation__detail-block">
              <span>Комментарий преподавателя</span>
              <p>{selectedRequest.comment || 'Комментарий не указан'}</p>
            </div>

            <div className="teacher-request-moderation__detail-block">
              <span>Вложение</span>
              {renderAttachment(selectedRequest)}
            </div>

            <ModalDangerZone
              title="Отклонение заявки"
              description="Преподаватель получит уведомление с причиной отказа. Заявку можно будет подать снова."
            >
              <Button
                type="button"
                variant="danger"
                size="small"
                onClick={() => openResolveConfirm(selectedRequest, 'rejected')}
              >
                Отклонить заявку
              </Button>
            </ModalDangerZone>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={Boolean(pendingResolve)}
        onClose={() => !resolveSubmitting && setPendingResolve(null)}
        onConfirm={() => resolveRequest(pendingResolve.id, pendingResolve.status)}
        title={pendingResolve?.status === 'approved' ? 'Одобрить заявку?' : 'Отклонить заявку?'}
        message={resolveConfirmMessage()}
        confirmText={pendingResolve?.status === 'approved' ? 'Одобрить' : 'Отклонить'}
        danger={pendingResolve?.status === 'rejected'}
        loading={resolveSubmitting}
      />
    </section>
  );
};

export default TeacherRequestModeration;
