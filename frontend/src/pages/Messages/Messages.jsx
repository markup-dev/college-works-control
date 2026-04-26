import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import checkReadIcon from '../../assets/messages/check-read.svg';
import checkSentIcon from '../../assets/messages/check-sent.svg';
import './Messages.scss';

const getErrorMessage = (err, fallback) => {
  const msg = err?.response?.data?.message;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
};

const COMPOSER_MAX_HEIGHT_PX = 160;

const Messages = () => {
  const { user } = useAuth();
  const { showError } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();
  const [partners, setPartners] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [draftRecipient, setDraftRecipient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageBody, setMessageBody] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [threadSnapKey, setThreadSnapKey] = useState(0);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [teacherGroupsMeta, setTeacherGroupsMeta] = useState([]);
  const threadBodyRef = useRef(null);
  const composerRef = useRef(null);

  const adjustComposerHeight = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const otherName =
    activeConversation?.otherUser?.fullName ??
    draftRecipient?.fullName ??
    'Собеседник';

  const threadOpen = Boolean(activeConversationId || draftRecipient);

  useEffect(() => {
    adjustComposerHeight();
  }, [messageBody, threadOpen, adjustComposerHeight]);

  const scrollThreadToEnd = useCallback(() => {
    const el = threadBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const filteredPartners = useMemo(() => {
    const q = partnerSearch.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) => {
      const name = (p.fullName || '').toLowerCase();
      const group = (p.groupName || '').toLowerCase();
      return name.includes(q) || group.includes(q);
    });
  }, [partners, partnerSearch]);

  /** Уже есть переписка — не дублируем контакт в «Новое сообщение». */
  const conversationPartnerIds = useMemo(
    () => new Set(conversations.map((c) => c.otherUser?.id).filter(Boolean)),
    [conversations]
  );

  const composePartners = useMemo(
    () => filteredPartners.filter((p) => !conversationPartnerIds.has(p.id)),
    [filteredPartners, conversationPartnerIds]
  );

  /** Для преподавателя: все группы из БД + список «нового чата»; блок «по сдаче». */
  const teacherPartnerGroups = useMemo(() => {
    if (user?.role !== 'teacher') return null;
    const submissionOnly = composePartners.filter((p) => p.partnerSource === 'submission');
    let groupSections;

    if (teacherGroupsMeta.length > 0) {
      groupSections = teacherGroupsMeta.map((g) => ({
        id: g.id,
        name: g.name,
        studentsInGroup: g.studentsInGroup ?? 0,
        list: composePartners.filter(
          (p) => p.partnerSource === 'my_group' && Number(p.groupId) === Number(g.id)
        ),
      }));
    } else {
      const byGroup = {};
      composePartners
        .filter((p) => p.partnerSource === 'my_group')
        .forEach((p) => {
          const label = (p.groupName && p.groupName.trim()) || 'Группа';
          if (!byGroup[label]) byGroup[label] = [];
          byGroup[label].push(p);
        });
      const groupOrder = Object.keys(byGroup).sort((a, b) => a.localeCompare(b, 'ru'));
      groupSections = groupOrder.map((name) => ({
        id: name,
        name,
        studentsInGroup: null,
        list: byGroup[name],
      }));
    }

    const q = partnerSearch.trim().toLowerCase();
    const groupSectionsVisible = groupSections.filter((s) => {
      if (!q) return true;
      if (String(s.name).toLowerCase().includes(q)) return true;
      return s.list.length > 0;
    });

    return { groupSections: groupSectionsVisible, submissionOnly };
  }, [user?.role, composePartners, teacherGroupsMeta, partnerSearch]);

  /** Скрываем блок, если новых получателей нет (все уже в «Диалогах»), пока поиск пуст. */
  const showComposeSection = useMemo(
    () =>
      loadingList ||
      partners.length === 0 ||
      composePartners.length > 0 ||
      partnerSearch.trim() !== '',
    [loadingList, partners.length, composePartners.length, partnerSearch]
  );

  const loadPartners = useCallback(async () => {
    try {
      const { data } = await api.get('/message-partners');
      setPartners(data.data ?? []);
      setTeacherGroupsMeta(data.teacherGroups ?? []);
    } catch (err) {
      showError(getErrorMessage(err, 'Не удалось загрузить контакты'));
    }
  }, [showError]);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/conversations');
      setConversations(data.data ?? []);
      window.dispatchEvent(new CustomEvent('app:messages-unread-refresh'));
    } catch (err) {
      showError(getErrorMessage(err, 'Не удалось загрузить диалоги'));
    }
  }, [showError]);

  const loadMessages = useCallback(
    async (conversationId, options = {}) => {
      const silent = options.silent === true;
      if (!conversationId) return;
      if (!silent) setLoadingThread(true);
      try {
        const { data } = await api.get(`/conversations/${conversationId}/messages`);
        const next = data.data ?? [];
        const myId = user?.id;
        setMessages((prev) => {
          if (!silent || prev.length === 0 || !myId) return next;
          const prevById = new Map(prev.map((m) => [m.id, m]));
          return next.map((m) => {
            const old = prevById.get(m.id);
            if (!old || m.senderId !== myId) return m;
            const readAt = m.readAt ?? old.readAt;
            return readAt === m.readAt ? m : { ...m, readAt };
          });
        });
      } catch (err) {
        if (!silent) {
          showError(getErrorMessage(err, 'Не удалось загрузить сообщения'));
        }
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [showError, user?.id]
  );

  /** Прокрутка вниз при входе в диалог / смене диалога (не при тихом polling). */
  useEffect(() => {
    if (!activeConversationId || loadingThread || draftRecipient) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(scrollThreadToEnd);
    });
    return () => cancelAnimationFrame(id);
  }, [activeConversationId, loadingThread, draftRecipient, threadSnapKey, scrollThreadToEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      await Promise.all([loadPartners(), loadConversations()]);
      if (!cancelled) setLoadingList(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPartners, loadConversations]);

  const focusStudentIdFromRoute = location.state?.focusStudentId;

  useEffect(() => {
    const focusId = focusStudentIdFromRoute != null ? Number(focusStudentIdFromRoute) : NaN;
    if (!Number.isFinite(focusId) || focusId <= 0 || loadingList) {
      return undefined;
    }

    const fromPartners = partners.find((p) => Number(p.id) === focusId);
    const fromConv = conversations.find((c) => Number(c.otherUser?.id) === focusId);
    const partner = fromPartners
      || (fromConv?.otherUser
        ? { id: fromConv.otherUser.id, fullName: fromConv.otherUser.fullName }
        : null);

    if (partner) {
      const existing = conversations.find((c) => Number(c.otherUser?.id) === focusId);
      if (existing) {
        setDraftRecipient(null);
        setActiveConversationId(existing.id);
      } else {
        setDraftRecipient({ id: partner.id, fullName: partner.fullName });
        setActiveConversationId(null);
        setMessages([]);
      }
      setThreadSnapKey((k) => k + 1);
      navigate(location.pathname, { replace: true, state: {} });
    }
    return undefined;
  }, [
    focusStudentIdFromRoute,
    loadingList,
    partners,
    conversations,
    location.pathname,
    navigate,
  ]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (!activeConversationId) return undefined;
    const id = setInterval(() => {
      loadMessages(activeConversationId, { silent: true });
      loadConversations();
    }, 12000);
    return () => clearInterval(id);
  }, [activeConversationId, loadMessages, loadConversations]);

  const selectPartnerDraft = (partner) => {
    setDraftRecipient({ id: partner.id, fullName: partner.fullName });
    setActiveConversationId(null);
    setMessages([]);
    setThreadSnapKey((k) => k + 1);
  };

  const openPartnerOrConversation = (partner) => {
    const existing = conversations.find((c) => c.otherUser?.id === partner.id);
    if (existing) {
      selectConversation(existing.id);
      return;
    }
    selectPartnerDraft(partner);
  };

  const selectConversation = (id) => {
    setDraftRecipient(null);
    setActiveConversationId(id);
    setThreadSnapKey((k) => k + 1);
  };

  const handleComposerKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    const form = e.currentTarget.form;
    if (!form) return;
    const text = messageBody.trim();
    if (!text || sending) return;
    if (!activeConversationId && !draftRecipient) return;
    e.preventDefault();
    form.requestSubmit();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = messageBody.trim();
    if (!text || sending) return;

    if (draftRecipient && !activeConversationId) {
      setSending(true);
      try {
        const { data } = await api.post('/conversations', {
          userId: draftRecipient.id,
          body: text,
        });
        const newConvId = data.data?.conversationId;
        if (!newConvId) {
          showError('Не удалось отправить сообщение');
          return;
        }
        setMessageBody('');
        setDraftRecipient(null);
        setActiveConversationId(newConvId);
        await loadConversations();
        await loadMessages(newConvId);
        setThreadSnapKey((k) => k + 1);
      } catch (err) {
        showError(getErrorMessage(err, 'Не удалось отправить'));
      } finally {
        setSending(false);
      }
      return;
    }

    if (!activeConversationId) return;

    setSending(true);
    try {
      await api.post(`/conversations/${activeConversationId}/messages`, { body: text });
      setMessageBody('');
      await loadMessages(activeConversationId, { silent: true });
      await loadConversations();
      setThreadSnapKey((k) => k + 1);
    } catch (err) {
      showError(getErrorMessage(err, 'Не удалось отправить'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="messages-page app-page">
      <div className="messages-page__shell app-reveal-stagger">
        <aside className="messages-sidebar">
          <h1 className="messages-page__title">Сообщения</h1>
          <p className="messages-page__hint">
            {user?.role === 'student'
              ? 'Переписка с преподавателями вашей группы и по заданиям'
              : 'Здесь не весь колледж — только студенты из ваших групп и те, кто уже сдавал вам работы.'}
          </p>

          <section className="messages-sidebar__section messages-sidebar__section--dialogs">
            <h2 className="messages-sidebar__heading">Диалоги</h2>
            {!loadingList && conversations.length === 0 ? (
              <p className="messages-sidebar__muted">Пока нет переписки</p>
            ) : (
              <ul className="messages-conversations">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={
                        c.id === activeConversationId && !draftRecipient
                          ? 'messages-conversations__btn is-active'
                          : 'messages-conversations__btn'
                      }
                      onClick={() => selectConversation(c.id)}
                    >
                      <span className="messages-conversations__text">
                        <span className="messages-conversations__name">
                          {c.otherUser?.fullName ?? '…'}
                        </span>
                        {c.lastMessage && (
                          <span className="messages-conversations__preview">
                            {c.lastMessage.body}
                          </span>
                        )}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="messages-conversations__badge">{c.unreadCount}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {showComposeSection && (
          <section className="messages-sidebar__section messages-sidebar__section--compose">
            <h2 className="messages-sidebar__heading">Новое сообщение</h2>
            {!loadingList && partners.length > 0 && (
              <input
                type="search"
                className="messages-partners-search"
                placeholder={
                  user?.role === 'teacher'
                    ? 'Поиск по фамилии или группе…'
                    : 'Поиск по фамилии…'
                }
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                autoComplete="off"
              />
            )}
            <div className="messages-sidebar-compose-body">
              {loadingList ? (
                <p className="messages-sidebar__muted">Загрузка…</p>
              ) : partners.length === 0 ? (
                <p className="messages-sidebar__muted">Нет доступных контактов</p>
              ) : filteredPartners.length === 0 ? (
                <p className="messages-sidebar__muted">Никого не найдено по запросу</p>
              ) : composePartners.length === 0 ? (
                <p className="messages-sidebar__muted">
                  По запросу остались только собеседники из списка «Диалоги» — откройте чат там.
                </p>
              ) : user?.role === 'teacher' && teacherPartnerGroups ? (
                <div className="messages-partners-teacher">
                  {teacherPartnerGroups.groupSections.map((section) => (
                    <details key={section.id} className="messages-partner-details">
                      <summary className="messages-partner-details__summary">
                        <div className="messages-partner-details__summary-text">
                          <span className="messages-partner-details__label">
                            {section.name}
                          </span>
                          <span className="messages-partner-details__sub">
                            {section.studentsInGroup != null ? (
                              <>
                                {section.studentsInGroup === 0
                                  ? 'Нет активных студентов'
                                  : section.list.length > 0
                                    ? `Участников: ${section.studentsInGroup}`
                                    : null}
                              </>
                            ) : (
                              'Группа'
                            )}
                          </span>
                        </div>
                        <div className="messages-partner-details__summary-trail">
                          {section.list.length > 0 && (
                            <span className="messages-partner-details__count-badge">
                              {section.list.length}
                            </span>
                          )}
                          <span className="messages-partner-details__chevron" aria-hidden />
                        </div>
                      </summary>
                      {section.list.length > 0 ? (
                        <ul className="messages-partners messages-partners--nested">
                          {section.list.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className={
                                  draftRecipient?.id === p.id
                                    ? 'messages-partners__btn is-active'
                                    : 'messages-partners__btn'
                                }
                                onClick={() => openPartnerOrConversation(p)}
                              >
                                <span className="messages-partners__name">
                                  {p.fullName}
                                </span>
                                <span className="messages-partners__role">
                                  Студент
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="messages-partner-details__empty">
                          {section.studentsInGroup > 0
                            ? 'Новых контактов нет — чаты слева в «Диалогах».'
                            : 'В группе нет активных студентов.'}
                        </p>
                      )}
                    </details>
                  ))}
                  {teacherPartnerGroups.submissionOnly.length > 0 && (
                    <details className="messages-partner-details messages-partner-details--extra">
                      <summary className="messages-partner-details__summary">
                        <div className="messages-partner-details__summary-text">
                          <span className="messages-partner-details__label">
                            Другие студенты
                          </span>
                          <span className="messages-partner-details__sub">
                            Сдавали работы по вашим заданиям
                          </span>
                        </div>
                        <div className="messages-partner-details__summary-trail">
                          <span className="messages-partner-details__count-badge">
                            {teacherPartnerGroups.submissionOnly.length}
                          </span>
                          <span className="messages-partner-details__chevron" aria-hidden />
                        </div>
                      </summary>
                      <ul className="messages-partners messages-partners--nested">
                        {teacherPartnerGroups.submissionOnly.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className={
                                draftRecipient?.id === p.id
                                  ? 'messages-partners__btn is-active'
                                  : 'messages-partners__btn'
                              }
                              onClick={() => openPartnerOrConversation(p)}
                            >
                              <span className="messages-partners__name">
                                {p.fullName}
                              </span>
                              <span className="messages-partners__role">
                                {p.groupName ? p.groupName : 'Студент'}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ) : (
                <ul className="messages-partners">
                  {composePartners.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={
                          draftRecipient?.id === p.id
                            ? 'messages-partners__btn is-active'
                            : 'messages-partners__btn'
                        }
                        onClick={() => openPartnerOrConversation(p)}
                      >
                        <span className="messages-partners__name">{p.fullName}</span>
                        <span className="messages-partners__role">
                          {p.role === 'teacher' ? 'Преподаватель' : 'Студент'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          )}
        </aside>

        <section className="messages-thread">
          {!threadOpen ? (
            <div className="messages-thread__empty">
              <p>Выберите диалог или контакт слева — новый чат появится после первого сообщения</p>
            </div>
          ) : (
            <>
              <header className="messages-thread__header">
                <h2 className="messages-thread__title">{otherName}</h2>
                {draftRecipient && (
                  <p className="messages-thread__draft-hint">
                    Диалог будет создан после отправки первого сообщения
                  </p>
                )}
              </header>
              <div className="messages-thread__body" ref={threadBodyRef}>
                {draftRecipient && !activeConversationId ? (
                  <p className="messages-thread__draft-placeholder">
                    Напишите сообщение ниже — переписка сохранится в списке диалогов
                  </p>
                ) : loadingThread ? (
                  <p className="messages-thread__loading">Загрузка сообщений…</p>
                ) : (
                  <ul className="messages-bubbles" aria-live="polite">
                    {messages.map((m, idx) => {
                      const own = m.senderId === user?.id;
                      const prev = idx > 0 ? messages[idx - 1] : null;
                      const sameSenderAsPrev =
                        !own && prev && prev.senderId === m.senderId;
                      const timeStr = new Date(m.createdAt).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <li
                          key={m.id}
                          className={[
                            'messages-bubbles__item',
                            own ? 'is-own' : '',
                            !own && sameSenderAsPrev ? 'messages-bubbles__item--followup' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {!own && !sameSenderAsPrev && (
                            <div className="messages-bubbles__sender-row">
                              <span className="messages-bubbles__sender-name">
                                {m.sender?.fullName ?? 'Собеседник'}
                              </span>
                            </div>
                          )}
                          <div
                            className={
                              own
                                ? 'messages-bubbles__bubble is-own'
                                : 'messages-bubbles__bubble'
                            }
                          >
                            <div className="messages-bubbles__body">{m.body}</div>
                          </div>
                          <div className="messages-bubbles__footer">
                            <time dateTime={m.createdAt}>{timeStr}</time>
                            {own && (
                              <span
                                className={
                                  m.readAt
                                    ? 'messages-bubbles__status is-read'
                                    : 'messages-bubbles__status'
                                }
                                title={
                                  m.readAt ? 'Прочитано' : 'Доставлено, ещё не прочитано'
                                }
                                aria-label={
                                  m.readAt
                                    ? 'Собеседник прочитал сообщение'
                                    : 'Сообщение доставлено'
                                }
                              >
                                <img
                                  src={m.readAt ? checkReadIcon : checkSentIcon}
                                  alt=""
                                  className="messages-bubbles__status-icon"
                                  width={16}
                                  height={16}
                                  decoding="async"
                                  aria-hidden
                                />
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <form className="messages-thread__composer" onSubmit={handleSend}>
                <div className="messages-thread__input-wrap">
                  <textarea
                    ref={composerRef}
                    className="messages-thread__input"
                    placeholder="Сообщение…"
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    disabled={sending}
                    rows={1}
                    autoComplete="off"
                  />
                </div>
                <button
                  type="submit"
                  className="messages-thread__send"
                  disabled={
                    sending ||
                    !messageBody.trim() ||
                    (!activeConversationId && !draftRecipient)
                  }
                  title={
                    draftRecipient && !activeConversationId
                      ? 'Отправить первое сообщение и создать диалог'
                      : undefined
                  }
                >
                  {draftRecipient && !activeConversationId ? 'Начать' : 'Отправить'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Messages;
