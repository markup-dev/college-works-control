import React, { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import { formatDateTime } from '../../../utils/dateHelpers';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import EmptyState from '../../UI/EmptyState/EmptyState';
import EntityCard from '../../UI/EntityCard/EntityCard';
import ErrorBanner from '../../UI/ErrorBanner/ErrorBanner';
import LoadingState from '../../UI/LoadingState/LoadingState';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import Pagination from '../../UI/Pagination/Pagination';
import './AdminBroadcastManagement.scss';

const LIST_PER_PAGE = 20;
const GROUPS_LIMIT = 100;

const AdminBroadcastManagement = () => {
  const { showSuccess, showError } = useNotification();
  const [tab, setTab] = useState('compose');

  const [groups, setGroups] = useState([]);
  const [audienceType, setAudienceType] = useState('all');
  const [groupIds, setGroupIds] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copyEmail, setCopyEmail] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [composeError, setComposeError] = useState(null);

  const [historySearch, setHistorySearch] = useState('');
  const debouncedHistorySearch = useDebouncedValue(historySearch, 300);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyMeta, setHistoryMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/groups', {
          params: { per_page: GROUPS_LIMIT, sort: 'name_asc' },
        });
        const list = Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) setGroups(list);
      } catch {
        if (!cancelled) setGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleGroup = (id) => {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const fetchHistory = useCallback(async (pageOverride) => {
    const page = pageOverride != null ? pageOverride : historyPage;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const params = { page, per_page: LIST_PER_PAGE };
      const q = debouncedHistorySearch.trim();
      if (q) params.search = q;
      const { data } = await api.get('/admin/broadcasts', { params });
      const list = Array.isArray(data?.data) ? data.data : [];
      setHistoryRows(list);
      const m = data?.meta;
      setHistoryMeta({
        currentPage: m?.currentPage ?? page,
        lastPage: m?.lastPage ?? 1,
        total: m?.total ?? 0,
      });
    } catch (e) {
      setHistoryRows([]);
      setHistoryError(firstApiErrorMessage(e.response?.data) || 'Не удалось загрузить историю');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, debouncedHistorySearch]);

  useEffect(() => {
    if (tab !== 'history') return;
    void fetchHistory();
  }, [tab, fetchHistory]);

  useEffect(() => {
    setHistoryPage(1);
  }, [debouncedHistorySearch]);

  const openDetail = async (id) => {
    setDetail(null);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/admin/broadcasts/${id}`);
      setDetail(data?.broadcast ?? null);
    } catch (e) {
      showError(firstApiErrorMessage(e.response?.data) || 'Не удалось открыть рассылку');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSend = async () => {
    setComposeError(null);
    const subj = subject.trim();
    const text = body.trim();
    if (subj.length < 3 || text.length < 3) {
      setComposeError('Тема и текст должны быть не короче 3 символов.');
      return;
    }
    if (audienceType === 'groups' && groupIds.length === 0) {
      setComposeError('Выберите хотя бы одну группу.');
      return;
    }

    setSendLoading(true);
    try {
      const payload = {
        audienceType,
        subject: subj,
        body: text,
        copyEmail,
      };
      if (audienceType === 'groups') {
        payload.groupIds = groupIds;
      }
      const { data } = await api.post('/admin/broadcasts', payload);
      const n = data?.sent ?? 0;
      showSuccess(`Сообщения отправлены: ${n}`);
      setSubject('');
      setBody('');
      setCopyEmail(false);
      setGroupIds([]);
      setAudienceType('all');
      setHistoryPage(1);
      setTab('history');
      void fetchHistory(1);
    } catch (e) {
      showError(firstApiErrorMessage(e.response?.data) || 'Не удалось отправить рассылку');
    } finally {
      setSendLoading(false);
    }
  };

  const doResend = async () => {
    if (!detail?.id) return;
    try {
      const { data } = await api.post(`/admin/broadcasts/${detail.id}/resend`);
      showSuccess(`Повторно отправлено: ${data?.sent ?? 0}`);
      void fetchHistory();
    } catch (e) {
      showError(firstApiErrorMessage(e.response?.data) || 'Не удалось повторить рассылку');
      throw e;
    }
  };

  return (
    <div className="admin-broadcast-management">
      <header className="admin-broadcast-management__head">
        <div>
          <h1 className="admin-broadcast-management__title">Рассылки</h1>
          <p className="admin-broadcast-management__hint">
            Сообщения доставляются в личные чаты пользователей (как от администратора). До{' '}
            <strong>800</strong> получателей за одну отправку. При галочке «Копия на email» письма
            отправляются тем, у кого указан email.
          </p>
        </div>
      </header>

      <div className="admin-broadcast-management__tabs" role="tablist">
        <button
          type="button"
          className={`admin-broadcast-management__tab${tab === 'compose' ? ' admin-broadcast-management__tab--active' : ''}`}
          onClick={() => setTab('compose')}
        >
          Новая рассылка
        </button>
        <button
          type="button"
          className={`admin-broadcast-management__tab${tab === 'history' ? ' admin-broadcast-management__tab--active' : ''}`}
          onClick={() => setTab('history')}
        >
          История
        </button>
      </div>

      {tab === 'compose' && (
        <div className="admin-broadcast-management__form">
          {composeError && (
            <ErrorBanner
              className="admin-broadcast-management__error"
              title="Ошибка отправки"
              message={composeError}
            />
          )}

          <div className="admin-broadcast-management__field">
            <span className="admin-broadcast-management__label">Аудитория</span>
            <div className="admin-broadcast-management__audience">
              {[
                ['all', 'Все (студенты и преподаватели)'],
                ['teachers', 'Только преподаватели'],
                ['students', 'Все студенты'],
                ['groups', 'Студенты выбранных групп'],
              ].map(([value, label]) => (
                <label key={value} className="admin-broadcast-management__radio">
                  <input
                    type="radio"
                    name="audience"
                    value={value}
                    checked={audienceType === value}
                    onChange={() => setAudienceType(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {audienceType === 'groups' && (
            <div className="admin-broadcast-management__field">
              <span className="admin-broadcast-management__label">Группы</span>
              <div className="admin-broadcast-management__groups-box">
                {groups.length === 0 ? (
                  <span className="admin-broadcast-management__hint">Группы не загрузились.</span>
                ) : (
                  groups.map((g) => (
                    <label key={g.id} className="admin-broadcast-management__radio">
                      <input
                        type="checkbox"
                        checked={groupIds.includes(g.id)}
                        onChange={() => toggleGroup(g.id)}
                      />
                      {g.name}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="admin-broadcast-management__field">
            <label className="admin-broadcast-management__label" htmlFor="broadcast-subject">
              Тема
            </label>
            <input
              id="broadcast-subject"
              className="admin-broadcast-management__text-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={255}
              autoComplete="off"
            />
          </div>

          <div className="admin-broadcast-management__field">
            <label className="admin-broadcast-management__label" htmlFor="broadcast-body">
              Текст
            </label>
            <textarea
              id="broadcast-body"
              className="admin-broadcast-management__textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={8000}
            />
          </div>

          <label className="admin-broadcast-management__radio">
            <input
              type="checkbox"
              checked={copyEmail}
              onChange={(e) => setCopyEmail(e.target.checked)}
            />
            Дублировать на email (если указан)
          </label>

          <div>
            <Button type="button" onClick={() => void handleSend()} loading={sendLoading}>
              Отправить
            </Button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <>
          {historyError && (
            <ErrorBanner
              className="admin-broadcast-management__error"
              title="Ошибка загрузки истории"
              message={historyError}
              actionLabel="Повторить"
              onAction={() => void fetchHistory()}
            />
          )}

          <DashboardFilterToolbar
            className="admin-broadcast-management__filter-toolbar"
            searchValue={historySearch}
            onSearchChange={setHistorySearch}
            searchPlaceholder="Поиск по теме или тексту…"
            showFilterPanel={false}
            showResetButton
            onReset={() => setHistorySearch('')}
            resetDisabled={!historySearch}
          />

          <div
            className={`admin-broadcast-management__grid-wrap${historyLoading ? ' admin-broadcast-management__grid-wrap--loading' : ''}`}
          >
            {historyLoading && historyRows.length === 0 ? (
              <LoadingState message="Загрузка истории..." className="admin-broadcast-management__state" />
            ) : !historyLoading && historyRows.length === 0 ? (
              <EmptyState
                title="Записей пока нет"
                message="Отправленные рассылки появятся здесь."
                className="admin-broadcast-management__state"
              />
            ) : (
              <div className="admin-broadcast-management__grid">
                {historyRows.map((row) => (
                  <EntityCard
                    as="button"
                    key={row.id}
                    type="button"
                    className="admin-broadcast-management__card"
                    onClick={() => void openDetail(row.id)}
                  >
                    <h3 className="admin-broadcast-management__card-subject">{row.subject}</h3>
                    <p className="admin-broadcast-management__card-meta">
                      {formatDateTime(row.createdAt)}
                      <br />
                      {row.audienceLabel} · {row.recipientCount} получ.
                      <br />
                      От: {row.admin?.shortName ?? '—'}
                    </p>
                  </EntityCard>
                ))}
              </div>
            )}
          </div>

          <Pagination
            currentPage={historyMeta.currentPage}
            lastPage={historyMeta.lastPage}
            total={historyMeta.total}
            fallbackCount={historyRows.length}
            disabled={historyLoading}
            onPrev={() => setHistoryPage((p) => Math.max(1, p - 1))}
            onNext={() => setHistoryPage((p) => p + 1)}
          />
        </>
      )}

      <Modal
        isOpen={!!detail || detailLoading}
        onClose={() => {
          if (!detailLoading) setDetail(null);
        }}
        title={detail?.subject || 'Рассылка'}
        size="medium"
        contentClassName="admin-broadcast-management__modal"
      >
        {detailLoading ? (
          <LoadingState message="Загрузка..." className="admin-broadcast-management__state" />
        ) : detail ? (
          <>
            <ModalSection title="Информация" variant="soft">
              <p className="admin-broadcast-management__modal-meta">
                {detail.audienceLabel}
                <br />
                Получателей: {detail.recipientCount} · {formatDateTime(detail.createdAt)}
                <br />
                Отправил: {detail.admin?.shortName ?? '—'}
                {detail.copyEmail ? ' · копии на email' : ''}
              </p>
            </ModalSection>
            <ModalSection title="Текст рассылки">
              <div className="admin-broadcast-management__modal-body">{detail.body}</div>
            </ModalSection>
            <div className="admin-broadcast-management__modal-controls">
              <Button type="button" variant="secondary" onClick={() => setDetail(null)}>
                Закрыть
              </Button>
              <Button type="button" variant="outline" onClick={() => setResendOpen(true)}>
                Отправить снова
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <ConfirmModal
        isOpen={resendOpen}
        onClose={() => setResendOpen(false)}
        title="Повторить рассылку?"
        message="Будут созданы новые сообщения в чатах всем текущим получателям с тем же текстом."
        confirmText="Отправить"
        cancelText="Отмена"
        onConfirm={doResend}
      />
    </div>
  );
};

export default AdminBroadcastManagement;
