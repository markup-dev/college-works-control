import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import logo from '../../../assets/logo-border-gradient.svg';
import './Header.scss';

const Header = ({ user, onLogout }) => {
  const location = useLocation();
  const { showInfo } = useNotification();
  const [messagesUnreadTotal, setMessagesUnreadTotal] = useState(0);
  const [notificationsUnreadTotal, setNotificationsUnreadTotal] = useState(0);

  const refreshMessagesUnread = useCallback(async () => {
    if (user?.role !== 'student' && user?.role !== 'teacher') {
      setMessagesUnreadTotal(0);
      return;
    }
    try {
      const { data } = await api.get('/conversations');
      const list = data.data ?? [];
      const total = list.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0);
      setMessagesUnreadTotal(total);
    } catch {
      /* сеть / 401 обрабатывает api */
    }
  }, [user?.role]);

  const refreshNotificationsUnread = useCallback(async () => {
    if (user?.role !== 'student' && user?.role !== 'teacher') {
      setNotificationsUnreadTotal(0);
      return;
    }
    try {
      const { data } = await api.get('/notifications/unread-count');
      setNotificationsUnreadTotal(Number(data.count) || 0);
    } catch {
      /* ignore */
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'student' && user?.role !== 'teacher') {
      return undefined;
    }
    if (sessionStorage.getItem('inboxNotifyAfterLogin') === '1') {
      sessionStorage.removeItem('inboxNotifyAfterLogin');
      (async () => {
        try {
          const { data } = await api.get('/notifications/unread-count');
          const c = Number(data.count) || 0;
          if (c > 0) {
            showInfo(`У вас ${c} непрочитанных уведомлений — откройте раздел «Уведомления».`);
          }
        } catch {
          /* ignore */
        }
      })();
    }
    return undefined;
  }, [user?.id, user?.role, showInfo]);

  useEffect(() => {
    if (user?.role !== 'student' && user?.role !== 'teacher') {
      setMessagesUnreadTotal(0);
      return undefined;
    }
    refreshMessagesUnread();
    const id = setInterval(refreshMessagesUnread, 25000);
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshMessagesUnread();
    };
    const onUnreadRefresh = () => refreshMessagesUnread();
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('app:messages-unread-refresh', onUnreadRefresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('app:messages-unread-refresh', onUnreadRefresh);
    };
  }, [user?.role, location.pathname, refreshMessagesUnread]);

  useEffect(() => {
    if (user?.role !== 'student' && user?.role !== 'teacher') {
      setNotificationsUnreadTotal(0);
      return undefined;
    }
    refreshNotificationsUnread();
    const id = setInterval(refreshNotificationsUnread, 30000);
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshNotificationsUnread();
    };
    const onNotifRefresh = () => refreshNotificationsUnread();
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('app:notifications-unread-refresh', onNotifRefresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('app:notifications-unread-refresh', onNotifRefresh);
    };
  }, [user?.role, location.pathname, refreshNotificationsUnread]);

  const handleLogout = () => {
    onLogout();
  };

  const getRoleLabel = (role) => {
    const roles = {
      student: 'Студент',
      teacher: 'Преподаватель',
      admin: 'Администратор'
    };
    return roles[role] || role;
  };

  const getFirstName = (userData) => {
    if (!userData) return '';
    if (userData.firstName) return userData.firstName;
    if (userData.fullName) {
      const parts = userData.fullName.trim().split(' ');
      return parts.length > 1 ? parts[1] : parts[0] || userData.fullName;
    }
    return userData.login || '';
  };

  return (
    <header className="header">
      <div className="header__content">
        <div className="header__left">
          <h1 className="header__title">
            <Link to="/welcome">
              <img src={logo} alt="Логотип" className="header__logo" />
            </Link>
          </h1>
          <span className="header__role">
            {getRoleLabel(user?.role)}
          </span>
        </div>

        <nav className="header__nav">
          <NavLink 
            to={`/${user?.role || ''}`} 
            className={({ isActive }) => `header__link ${isActive ? 'header__link--active' : ''}`}
          >
            Дашборд
          </NavLink>
          {(user?.role === 'student' || user?.role === 'teacher') && (
            <>
              <NavLink
                to="/notifications"
                className={({ isActive }) =>
                  `header__link ${isActive ? 'header__link--active' : ''}`
                }
              >
                <span className="header__link-inner">
                  Уведомления
                  {notificationsUnreadTotal > 0 && (
                    <span
                      className="header__messages-badge"
                      aria-label={`Непрочитанных уведомлений: ${notificationsUnreadTotal}`}
                    >
                      {notificationsUnreadTotal > 99 ? '99+' : notificationsUnreadTotal}
                    </span>
                  )}
                </span>
              </NavLink>
              <NavLink
                to="/messages"
                className={({ isActive }) =>
                  `header__link ${isActive ? 'header__link--active' : ''}`
                }
              >
                <span className="header__link-inner">
                  Сообщения
                  {messagesUnreadTotal > 0 && (
                    <span
                      className="header__messages-badge"
                      aria-label={`Непрочитанных сообщений: ${messagesUnreadTotal}`}
                    >
                      {messagesUnreadTotal > 99 ? '99+' : messagesUnreadTotal}
                    </span>
                  )}
                </span>
              </NavLink>
            </>
          )}
          <NavLink 
            to="/profile" 
            className={({ isActive }) => `header__link ${isActive ? 'header__link--active' : ''}`}
          >
            Профиль
          </NavLink>
        </nav>
        
        <div className="header__right">
          <span className="header__user">Привет, {getFirstName(user)}!</span>
          <button className="header__logout" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;