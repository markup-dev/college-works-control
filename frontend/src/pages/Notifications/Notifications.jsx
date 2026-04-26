import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { getNotificationNavigatePath } from '../../utils/notificationNavigation';
import Button from '../../components/UI/Button/Button';
import ConfirmModal from '../../components/UI/Modal/ConfirmModal';
import Pagination from '../../components/UI/Pagination/Pagination';
import './Notifications.scss';

const formatWhen = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useNotification();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: { page: p } });
      setItems(data.data ?? []);
      setMeta({
        currentPage: data.meta?.currentPage ?? data.meta?.current_page ?? 1,
        lastPage: data.meta?.lastPage ?? data.meta?.last_page ?? 1,
        total: data.meta?.total ?? 0,
      });
    } catch {
      showError('Не удалось загрузить уведомления');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const refreshUnreadGlobally = () => {
    window.dispatchEvent(new CustomEvent('app:notifications-unread-refresh'));
  };

  const markItemReadLocally = (id) => {
    const ts = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, readAt: ts } : item))
    );
  };

  const handleCardActivate = async (n) => {
    const d = n.data || {};
    const target = user?.role ? getNotificationNavigatePath(user.role, d) : null;
    const unread = !n.readAt;

    if (unread) {
      try {
        await api.post(`/notifications/${n.id}/read`);
        refreshUnreadGlobally();
        markItemReadLocally(n.id);
      } catch {
        showError('Не удалось отметить прочитанным');
        return;
      }
    }

    if (target) {
      navigate(target);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      showSuccess('Все уведомления отмечены прочитанными');
      refreshUnreadGlobally();
      const ts = new Date().toISOString();
      setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || ts })));
    } catch {
      showError('Не удалось выполнить действие');
    }
  };

  const executeClearAllNotifications = async () => {
    try {
      await api.delete('/notifications');
      showSuccess('Список уведомлений очищен');
      refreshUnreadGlobally();
      setItems([]);
      setMeta({ currentPage: 1, lastPage: 1, total: 0 });
      setPage(1);
    } catch {
      showError('Не удалось очистить уведомления');
    }
  };

  return (
    <div className="notifications-page app-page">
      <div className="notifications-page__shell">
        <header className="notifications-page__header">
          <div>
            <h1>Уведомления</h1>
            <p className="notifications-page__hint">
              События по заданиям и срокам. Нажмите на карточку, чтобы перейти к заданию или сдаче.
              Письма на почту — если в профиле включено «Дублировать уведомления на email».
            </p>
          </div>
          {!loading && meta.total > 0 ? (
            <div className="notifications-page__actions">
              <Button type="button" variant="secondary" size="small" onClick={markAllRead}>
                Отметить всё прочитанным
              </Button>
              <Button
                type="button"
                variant="danger"
                size="small"
                onClick={() => setShowClearAllConfirm(true)}
              >
                Очистить список
              </Button>
            </div>
          ) : null}
        </header>

        {loading ? (
          <p className="notifications-page__muted">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="notifications-page__muted">Пока нет уведомлений</p>
        ) : (
          <ul className="notifications-page__list app-reveal-stagger">
            {items.map((n) => {
              const d = n.data || {};
              const title = d.title || 'Уведомление';
              const body = d.body || '';
              const unread = !n.readAt;
              const navigable = Boolean(user?.role && getNotificationNavigatePath(user.role, d));
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notifications-page__card${unread ? ' is-unread' : ''}${
                      navigable ? ' is-navigable' : ''
                    }`}
                    onClick={() => handleCardActivate(n)}
                  >
                    <div className="notifications-page__card-top">
                      <span className="notifications-page__title">{title}</span>
                      <time className="notifications-page__time" dateTime={n.createdAt}>
                        {formatWhen(n.createdAt)}
                      </time>
                    </div>
                    <p className="notifications-page__body">{body}</p>
                    {navigable ? (
                      <span className="notifications-page__badge notifications-page__badge--muted">
                        Открыть в дашборде
                      </span>
                    ) : unread ? (
                      <span className="notifications-page__badge">Новое</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && meta.lastPage > 1 ? (
          <Pagination
            currentPage={meta.currentPage}
            lastPage={meta.lastPage}
            total={meta.total}
            fallbackCount={items.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        ) : null}
      </div>

      <ConfirmModal
        isOpen={showClearAllConfirm}
        onClose={() => setShowClearAllConfirm(false)}
        onConfirm={executeClearAllNotifications}
        title="Очистить уведомления?"
        message="Все записи из списка будут удалены без возможности восстановления."
        confirmText="Очистить"
        cancelText="Отмена"
        danger
      />
    </div>
  );
};

export default Notifications;
