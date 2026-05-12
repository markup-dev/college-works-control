import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { formatDateTimeShortMonth } from '../../utils/dateHelpers';
import { getNotificationNavigatePath } from '../../utils/notificationNavigation';
import Button from '../../components/UI/Button/Button';
import ConfirmModal from '../../components/UI/Modal/ConfirmModal';
import Pagination from '../../components/UI/Pagination/Pagination';
import './Notifications.scss';

const notificationText = (value, fallback = '') => {
  if (value == null) {
    return fallback;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Да' : 'Нет';
  }
  return fallback;
};

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showError, showSuccess } = useNotification();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [markAllReading, setMarkAllReading] = useState(false);
  const [page, setPage] = useState(1);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const itemCountRef = useRef(0);
  const markAllGuardRef = useRef(false);

  useEffect(() => {
    itemCountRef.current = items.length;
  }, [items.length]);

  const refreshUnreadGlobally = useCallback(() => {
    window.dispatchEvent(new CustomEvent('app:notifications-unread-refresh'));
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (user?.role !== 'student' && user?.role !== 'teacher') {
      setUnreadTotal(0);
      return;
    }
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadTotal(Number(data.count) || 0);
    } catch {
      /* счётчик необязателен для списка */
    }
  }, [user?.role]);

  const load = useCallback(async (p = 1) => {
    const blockUi = itemCountRef.current === 0 && p === 1;
    if (blockUi) {
      setLoading(true);
    }
    try {
      const { data } = await api.get('/notifications', { params: { page: p } });
      const rawItems = data.data ?? [];
      setItems(
        rawItems.map((row) => ({
          ...row,
          readAt: row.readAt ?? row.read_at ?? null,
          createdAt: row.createdAt ?? row.created_at ?? null,
        }))
      );
      setUnreadTotal(
        rawItems.filter((row) => !(row.readAt ?? row.read_at ?? null)).length
      );
      setMeta({
        currentPage: data.meta?.currentPage ?? data.meta?.current_page ?? 1,
        lastPage: data.meta?.lastPage ?? data.meta?.last_page ?? 1,
        total: data.meta?.total ?? 0,
      });
      refreshUnreadGlobally();
      void refreshUnreadCount();
    } catch {
      showError('Не удалось загрузить уведомления');
      setItems([]);
    } finally {
      if (blockUi) {
        setLoading(false);
      }
    }
  }, [showError, refreshUnreadCount, refreshUnreadGlobally]);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const markItemReadLocally = (id) => {
    const ts = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, readAt: ts } : item))
    );
  };

  const handleCardActivate = (n) => {
    const d = n.data || {};
    const target = user?.role ? getNotificationNavigatePath(user.role, d) : null;
    const unread = !n.readAt;

    if (target) {
      navigate(target);
    }

    if (unread) {
      void api
        .post(`/notifications/${n.id}/read`)
        .then(() => {
          refreshUnreadGlobally();
          markItemReadLocally(n.id);
          void refreshUnreadCount();
        })
        .catch(() => {
          showError('Не удалось отметить прочитанным');
        });
    }
  };

  const markAllRead = async () => {
    if (unreadTotal <= 0 || markAllGuardRef.current || markAllReading) {
      return;
    }
    markAllGuardRef.current = true;
    setMarkAllReading(true);
    try {
      await api.post('/notifications/read-all');
      refreshUnreadGlobally();
      setUnreadTotal(0);
      const ts = new Date().toISOString();
      setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || ts })));
      await load(page);
      showSuccess('Все уведомления отмечены прочитанными');
    } catch {
      showError('Не удалось выполнить действие');
      await refreshUnreadCount();
    } finally {
      markAllGuardRef.current = false;
      setMarkAllReading(false);
    }
  };

  const executeClearAllNotifications = async () => {
    try {
      await api.delete('/notifications');
      showSuccess('Список уведомлений очищен');
      refreshUnreadGlobally();
      setUnreadTotal(0);
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
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={markAllRead}
                disabled={markAllReading || unreadTotal <= 0}
                loading={markAllReading}
              >
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
              const title = notificationText(d.title, 'Уведомление') || 'Уведомление';
              const body = notificationText(d.body, '');
              const teacherName = user?.role === 'student'
                ? notificationText(d.teacherName ?? d.teacher_name, '')
                : '';
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
                      <time className="notifications-page__time" dateTime={n.createdAt || undefined}>
                        {formatDateTimeShortMonth(n.createdAt, '')}
                      </time>
                    </div>
                    {teacherName ? (
                      <p className="notifications-page__teacher">{teacherName}</p>
                    ) : null}
                    <p className="notifications-page__body">{body}</p>
                    {unread ? (
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
