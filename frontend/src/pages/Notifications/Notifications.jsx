import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { formatDateTimeShortMonth } from '../../utils/dateHelpers';
import { getNotificationNavigatePath } from '../../utils/notificationNavigation';
import Button from '../../components/UI/Button/Button';
import ConfirmModal from '../../components/UI/Modal/ConfirmModal';
import Modal from '../../components/UI/Modal/Modal';
import ModalSection from '../../components/UI/Modal/ModalSection';
import Pagination from '../../components/UI/Pagination/Pagination';
import { getApiErrorMessage } from '../../utils/adminApiErrors';
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

const getNotificationKind = (data = {}) => data.kind ?? data.type ?? null;

const isAdminBroadcastNotification = (data = {}) => getNotificationKind(data) === 'admin_broadcast';

const previewText = (text, maxLength = 180) => {
  const value = String(text || '').trim();
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trim()}…`;
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
  const [selectedNotification, setSelectedNotification] = useState(null);
  const itemCountRef = useRef(0);
  const markAllGuardRef = useRef(false);

  useEffect(() => {
    itemCountRef.current = items.length;
  }, [items.length]);

  const refreshUnreadGlobally = useCallback(() => {
    window.dispatchEvent(new CustomEvent('app:notifications-unread-refresh'));
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.role) {
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
    } catch (err) {
      showError(getApiErrorMessage(err, 'Не удалось загрузить уведомления'));
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

  const markNotificationRead = useCallback((notification) => {
    if (!notification || notification.readAt) {
      return;
    }
    void api
      .post(`/notifications/${notification.id}/read`)
      .then(() => {
        refreshUnreadGlobally();
        markItemReadLocally(notification.id);
        void refreshUnreadCount();
      })
      .catch((err) => {
        showError(getApiErrorMessage(err, 'Не удалось отметить прочитанным'));
      });
  }, [refreshUnreadCount, refreshUnreadGlobally, showError]);

  const handleCardActivate = (n) => {
    const d = n.data || {};
    const target = user?.role ? getNotificationNavigatePath(user.role, d) : null;

    if (isAdminBroadcastNotification(d)) {
      setSelectedNotification(n);
      markNotificationRead(n);
      return;
    }

    if (target) {
      navigate(target);
    }

    markNotificationRead(n);
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
    } catch (err) {
      showError(getApiErrorMessage(err, 'Не удалось выполнить действие'));
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
    } catch (err) {
      showError(getApiErrorMessage(err, 'Не удалось очистить уведомления'));
    }
  };

  return (
    <div className="notifications-page app-page">
      <div className="notifications-page__shell">
        <header className="notifications-page__header">
          <div>
            <h1>Уведомления</h1>
            {!loading && items.length > 0 ? (
              <p className="notifications-page__hint">
                {unreadTotal > 0 ? `Непрочитанных: ${unreadTotal}. ` : ''}
                Нажмите на уведомление, чтобы перейти к заданию или открыть текст.
              </p>
            ) : null}
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
              const isBroadcast = isAdminBroadcastNotification(d);
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
                      navigable || isBroadcast ? ' is-navigable' : ''
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
                    <p className="notifications-page__body">
                      {isBroadcast ? previewText(body) : body}
                    </p>
                    {isBroadcast ? (
                      <span className="notifications-page__badge notifications-page__badge--muted">
                        Открыть текст
                      </span>
                    ) : null}
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

      <Modal
        isOpen={!!selectedNotification}
        onClose={() => setSelectedNotification(null)}
        title={notificationText(selectedNotification?.data?.title, 'Уведомление')}
        size="medium"
        contentClassName="notifications-page__modal"
      >
        {selectedNotification ? (
          <>
            <ModalSection title="Информация" variant="soft">
              <p className="notifications-page__modal-meta">
                {selectedNotification.data?.adminName || selectedNotification.data?.admin_name
                  ? `Отправитель: ${selectedNotification.data?.adminName || selectedNotification.data?.admin_name}`
                  : 'Администрация'}
                <br />
                {formatDateTimeShortMonth(selectedNotification.createdAt, '')}
              </p>
            </ModalSection>
            <ModalSection title="Текст уведомления">
              <div className="notifications-page__modal-body">
                {notificationText(selectedNotification.data?.body, 'Текст отсутствует')}
              </div>
            </ModalSection>
          </>
        ) : null}
      </Modal>

      <ConfirmModal
        isOpen={showClearAllConfirm}
        onClose={() => setShowClearAllConfirm(false)}
        onConfirm={executeClearAllNotifications}
        title="Очистить уведомления?"
        message="Все записи из списка будут удалены без возможности восстановления."
        confirmText="Очистить"
        danger
      />
    </div>
  );
};

export default Notifications;
