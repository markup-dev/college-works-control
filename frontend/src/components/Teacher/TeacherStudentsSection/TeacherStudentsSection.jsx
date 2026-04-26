import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import Button from '../../UI/Button/Button';
import { formatDate } from '../../../utils';
import StudentProgressModal from '../StudentProgressModal/StudentProgressModal';

const BROADCAST_DEFAULT_TEXT =
  'Здравствуйте! Напоминаю о несданных работах по нашим заданиям. Пожалуйста, постарайтесь сдать работы в срок. Если нужна помощь — ответьте на это сообщение.';

const BROADCAST_MAX_RECIPIENTS = 50;

const getErrorMessage = (err, fallback) => {
  const msg = err?.response?.data?.message;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
};

const csvEscape = (v) => {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const TeacherStudentsSection = ({ students = [], loading = false, onReload }) => {
  const { showSuccess, showError } = useNotification();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [modalStudent, setModalStudent] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastBody, setBroadcastBody] = useState(BROADCAST_DEFAULT_TEXT);
  const [broadcastSending, setBroadcastSending] = useState(false);
  const headerCheckboxRef = useRef(null);

  const groupOptions = useMemo(() => {
    const set = new Set();
    students.forEach((r) => {
      if (r.groupName) set.add(r.groupName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((r) => {
      if (groupFilter !== 'all' && (r.groupName || '') !== groupFilter) return false;
      if (!q) return true;
      const name = (r.fullName || '').toLowerCase();
      const g = (r.groupName || '').toLowerCase();
      return name.includes(q) || g.includes(q);
    });
  }, [students, search, groupFilter]);

  const toggleSelectId = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllFiltered = () => setSelectedIds(filtered.map((r) => r.id));

  const selectDebtorsFiltered = () =>
    setSelectedIds(filtered.filter((r) => r.missingCount > 0).map((r) => r.id));

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.includes(r.id));
  const selectedOnPageCount = filtered.filter((r) => selectedIds.includes(r.id)).length;

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = selectedOnPageCount > 0 && selectedOnPageCount < filtered.length;
  }, [selectedOnPageCount, filtered.length]);

  useEffect(() => {
    if (broadcastOpen) {
      setBroadcastBody(BROADCAST_DEFAULT_TEXT);
    }
  }, [broadcastOpen]);

  const sendBroadcast = async () => {
    const text = broadcastBody.trim();
    if (!text) {
      showError('Введите текст сообщения');
      return;
    }
    const ids = [...new Set(selectedIds.map(Number))].filter((id) => id > 0);
    if (ids.length === 0) {
      showError('Выберите получателей');
      return;
    }
    if (ids.length > BROADCAST_MAX_RECIPIENTS) {
      showError(`Не более ${BROADCAST_MAX_RECIPIENTS} получателей за одну отправку`);
      return;
    }
    setBroadcastSending(true);
    try {
      const { data } = await api.post('/teacher/messages/broadcast', {
        userIds: ids,
        body: text,
      });
      const sent = data?.data?.sent ?? 0;
      const skipped = data?.data?.skipped ?? 0;
      if (skipped > 0) {
        showSuccess(`Отправлено сообщений: ${sent}. Пропущено (нет доступа к чату): ${skipped}.`);
      } else {
        showSuccess(`Сообщение отправлено ${sent} студентам.`);
      }
      setBroadcastOpen(false);
      setSelectedIds([]);
    } catch (err) {
      showError(getErrorMessage(err, 'Не удалось отправить сообщения'));
    } finally {
      setBroadcastSending(false);
    }
  };

  const exportCsv = () => {
    const header = [
      'ФИО',
      'Группа',
      'Сдано',
      'Не сдано',
      'Всего заданий',
      'Средний балл',
      'Активен',
      'Последний вход',
      'Сдач за 7 дней',
    ];
    const lines = [header.join(',')];
    filtered.forEach((r) => {
      lines.push(
        [
          csvEscape(r.fullName),
          csvEscape(r.groupName),
          r.submittedCount,
          r.missingCount,
          r.relevantAssignmentsCount,
          r.averageScore != null ? r.averageScore : '',
          r.isActive ? 'да' : 'нет',
          csvEscape(r.lastLogin ? formatDate(r.lastLogin) : ''),
          r.submissionsLastWeek ?? 0,
        ].join(',')
      );
    });
    const bom = '\ufeff';
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="teacher-students-section">
      <div className="section-header teacher-students-section__header">
        <h2>Студенты</h2>
        <div className="teacher-students-section__header-actions">
          <Button type="button" variant="secondary" onClick={exportCsv} disabled={loading || filtered.length === 0}>
            Экспорт в Excel (CSV)
          </Button>
          {onReload ? (
            <Button type="button" variant="secondary" onClick={onReload} disabled={loading}>
              Обновить
            </Button>
          ) : null}
        </div>
      </div>

      <p className="teacher-students-section__hint">
        Сдано и «не сдано» считаются по вашим активным и приостановленным заданиям для группы студента. Отметьте
        студентов и отправьте одно напоминание сразу нескольким — сообщения придут в раздел «Сообщения» (до{' '}
        {BROADCAST_MAX_RECIPIENTS} за раз).
      </p>

      <div className="teacher-students-section__filters">
        <input
          type="search"
          className="teacher-students-section__search"
          placeholder="Поиск по ФИО или группе…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        <select
          className="teacher-students-section__select"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="all">Все группы</option>
          {groupOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {!loading && students.length > 0 ? (
        <div className="teacher-students-section__bulk-bar">
          {selectedIds.length > 0 ? (
            <>
              <span className="teacher-students-section__bulk-count">
                Выбрано: <strong>{selectedIds.length}</strong>
                {selectedIds.length > BROADCAST_MAX_RECIPIENTS ? (
                  <span className="teacher-students-section__bulk-warn">
                    {' '}
                    (лишние не будут отправлены — максимум {BROADCAST_MAX_RECIPIENTS})
                  </span>
                ) : null}
              </span>
              <Button type="button" variant="secondary" onClick={() => setSelectedIds([])}>
                Снять выбор
              </Button>
              <Button type="button" variant="secondary" onClick={selectDebtorsFiltered}>
                Оставить только с долгами
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setBroadcastOpen(true)}
                disabled={broadcastSending}
              >
                Отправить сообщение…
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={selectAllFiltered}
                disabled={filtered.length === 0}
              >
                Выбрать всех на экране
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={selectDebtorsFiltered}
                disabled={!filtered.some((r) => r.missingCount > 0)}
              >
                Выбрать с несданными работами
              </Button>
            </>
          )}
        </div>
      ) : null}

      {loading ? (
        <p className="teacher-students-section__muted">Загрузка…</p>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <p>Нет студентов в закреплённых за вами группах или в группах ваших заданий</p>
        </div>
      ) : (
        <div className="teacher-students-section__table-wrap">
          <table className="teacher-students-section__table">
            <thead>
              <tr>
                <th className="teacher-students-section__th-check" aria-label="Выбор">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(e) => {
                      if (e.target.checked) selectAllFiltered();
                      else setSelectedIds([]);
                    }}
                    disabled={filtered.length === 0}
                    title="Выбрать всех на экране"
                  />
                </th>
                <th aria-label="Статус" />
                <th>ФИО</th>
                <th>Группа</th>
                <th>Сдано</th>
                <th>Не сдано</th>
                <th>Средний балл</th>
                <th>Последний вход</th>
                <th>Сдач / 7 дн.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="teacher-students-section__row"
                  onClick={() => setModalStudent(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setModalStudent(r);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td
                    className="teacher-students-section__check-cell"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggleSelectId(r.id)}
                      aria-label={`Выбрать ${r.fullName}`}
                    />
                  </td>
                  <td className="teacher-students-section__status-cell">
                    <span
                      className={
                        r.isActive
                          ? 'teacher-students-section__status is-active'
                          : 'teacher-students-section__status is-blocked'
                      }
                      title={r.isActive ? 'Активен' : 'Заблокирован'}
                    />
                  </td>
                  <td>{r.fullName}</td>
                  <td>{r.groupName || '—'}</td>
                  <td>{r.submittedCount}</td>
                  <td>{r.missingCount}</td>
                  <td>{r.averageScore != null ? r.averageScore : '—'}</td>
                  <td>{r.lastLogin ? formatDate(r.lastLogin) : '—'}</td>
                  <td>{r.submissionsLastWeek ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && students.length > 0 && filtered.length === 0 ? (
        <p className="teacher-students-section__muted">Никого не найдено по фильтрам</p>
      ) : null}

      <StudentProgressModal
        isOpen={Boolean(modalStudent)}
        studentId={modalStudent?.id}
        fallbackTitle={modalStudent?.fullName}
        onClose={() => setModalStudent(null)}
      />

      {broadcastOpen ? (
        <div
          className="teacher-students-broadcast-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="teacher-broadcast-title"
          onClick={() => {
            if (!broadcastSending) setBroadcastOpen(false);
          }}
        >
          <div
            className="teacher-students-broadcast"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="teacher-students-broadcast__head">
              <h2 id="teacher-broadcast-title">Сообщение выбранным студентам</h2>
              <button
                type="button"
                className="teacher-students-broadcast__close"
                disabled={broadcastSending}
                onClick={() => setBroadcastOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <p className="teacher-students-broadcast__meta">
              Получателей в списке: {selectedIds.length} (за один раз — не больше {BROADCAST_MAX_RECIPIENTS}). Каждый
              студент увидит текст в «Сообщениях» как обычное входящее.
            </p>
            <textarea
              className="teacher-students-broadcast__textarea"
              rows={6}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              disabled={broadcastSending}
            />
            <div className="teacher-students-broadcast__actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setBroadcastOpen(false)}
                disabled={broadcastSending}
              >
                Отмена
              </Button>
              <Button type="button" variant="primary" onClick={sendBroadcast} disabled={broadcastSending}>
                {broadcastSending ? 'Отправка…' : 'Отправить'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TeacherStudentsSection;
