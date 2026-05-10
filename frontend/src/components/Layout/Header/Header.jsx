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
  const [navOpen, setNavOpen] = useState(false);
  const [platformBanner, setPlatformBanner] = useState(null);

  const refreshPlatformBanner = useCallback(async () => {
    if (!user) {
      setPlatformBanner(null);
      return;
    }
    try {
      const { data } = await api.get('/platform-banner');
      setPlatformBanner(data?.active ? data : null);
    } catch {
      setPlatformBanner(null);
    }
  }, [user]);

  useEffect(() => {
    void refreshPlatformBanner();
  }, [refreshPlatformBanner]);

  useEffect(() => {
    const onRefresh = () => {
      void refreshPlatformBanner();
    };
    window.addEventListener('app:platform-banner-refresh', onRefresh);
    return () => window.removeEventListener('app:platform-banner-refresh', onRefresh);
  }, [refreshPlatformBanner]);

  const closeNav = useCallback(() => setNavOpen(false), []);

  const refreshMessagesUnread = useCallback(async () => {
    if (user?.role !== 'student' && user?.role !== 'teacher') {
      setMessagesUnreadTotal(0);
      return;
    }
    try {
      const { data } = await api.get('/conversations', { params: { scope: 'active' } });
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

  useEffect(() => {
    closeNav();
  }, [location.pathname, closeNav]);

  useEffect(() => {
    if (!navOpen) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === 'Escape') closeNav();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen, closeNav]);

  const handleLogout = () => {
    onLogout();
  };

  const getRoleLabel = (role) => {
    const roles = {
      student: 'Студент',
      teacher: 'Преподаватель',
      admin: 'Администратор',
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

  const linkClassDesktop = ({ isActive }) =>
    `header__link ${isActive ? 'header__link--active' : ''}`;
  const linkClassPanel = ({ isActive }) =>
    `header__link header__link--panel ${isActive ? 'header__link--active' : ''}`;

  const dashboardPath =
    user?.role === 'admin' ? '/admin/dashboard' : `/${user?.role || ''}`;

  const isMessagesPage = /^\/messages\/?$/.test(location.pathname || '');

  return (
    <header
      className={['header', isMessagesPage ? 'header--messages-narrow' : ''].filter(Boolean).join(' ')}
    >
      {platformBanner?.text ? (
        <div
          className={`platform-banner platform-banner--${platformBanner.color || 'yellow'}`}
          role="status"
        >
          {platformBanner.text}
        </div>
      ) : null}
      <div className="header__content">
        <div className="header__left">
          <h1 className="header__title">
            <Link to="/welcome">
              <img src={logo} alt="Логотип" className="header__logo" />
            </Link>
          </h1>
          <span className="header__role">{getRoleLabel(user?.role)}</span>
        </div>

        <nav className="header__nav header__nav--desktop" aria-label="Основная навигация">
          <NavLink to={dashboardPath} className={linkClassDesktop}>
            Дашборд
          </NavLink>
          {(user?.role === 'student' || user?.role === 'teacher') && (
            <>
              <NavLink to="/notifications" className={linkClassDesktop}>
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
              <NavLink to="/messages" className={linkClassDesktop}>
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
          <NavLink to={user?.role === 'admin' ? '/admin/profile' : '/profile'} className={linkClassDesktop}>
            Профиль
          </NavLink>
        </nav>

        <div className="header__trailing">
          <div className="header__right header__right--desktop">
            <span className="header__user">Привет, {getFirstName(user)}!</span>
            <button type="button" className="header__logout" onClick={handleLogout}>
              Выйти
            </button>
          </div>

          <button
            type="button"
            className={`header__burger${navOpen ? ' header__burger--open' : ''}`}
            onClick={() => setNavOpen((o) => !o)}
            aria-expanded={navOpen}
            aria-controls="header-mobile-panel"
            aria-label={navOpen ? 'Закрыть меню' : 'Открыть меню'}
          >
            <span className="header__burger-bar" />
            <span className="header__burger-bar" />
            <span className="header__burger-bar" />
          </button>
        </div>
      </div>

      <div
        className={`header__mobile-layer${navOpen ? ' is-open' : ''}`}
        aria-hidden={!navOpen}
      >
        <button
          type="button"
          className="header__backdrop"
          aria-label="Закрыть меню"
          onClick={closeNav}
        />
        <aside
          id="header-mobile-panel"
          className="header__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="header-mobile-panel-title"
          {...(!navOpen ? { inert: '' } : {})}
        >
            <div className="header__panel-top">
              <h2 className="header__panel-title" id="header-mobile-panel-title">
                Меню
              </h2>
              <span className="header__panel-role">{getRoleLabel(user?.role)}</span>
              <button
                type="button"
                className="header__panel-close"
                onClick={closeNav}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <p className="header__panel-user">Привет, {getFirstName(user)}!</p>
            <nav className="header__nav header__nav--panel" aria-label="Разделы">
              <NavLink to={dashboardPath} className={linkClassPanel} onClick={closeNav}>
                Дашборд
              </NavLink>
              {(user?.role === 'student' || user?.role === 'teacher') && (
                <>
                  <NavLink to="/notifications" className={linkClassPanel} onClick={closeNav}>
                    <span className="header__link-inner">
                      Уведомления
                      {notificationsUnreadTotal > 0 && (
                        <span
                          className="header__messages-badge header__messages-badge--panel"
                          aria-label={`Непрочитанных уведомлений: ${notificationsUnreadTotal}`}
                        >
                          {notificationsUnreadTotal > 99 ? '99+' : notificationsUnreadTotal}
                        </span>
                      )}
                    </span>
                  </NavLink>
                  <NavLink to="/messages" className={linkClassPanel} onClick={closeNav}>
                    <span className="header__link-inner">
                      Сообщения
                      {messagesUnreadTotal > 0 && (
                        <span
                          className="header__messages-badge header__messages-badge--panel"
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
                to={user?.role === 'admin' ? '/admin/profile' : '/profile'}
                className={linkClassPanel}
                onClick={closeNav}
              >
                Профиль
              </NavLink>
            </nav>
            <div className="header__panel-actions">
              <button type="button" className="header__logout header__logout--panel" onClick={handleLogout}>
                Выйти
              </button>
            </div>
          </aside>
      </div>
    </header>
  );
};

export default Header;
