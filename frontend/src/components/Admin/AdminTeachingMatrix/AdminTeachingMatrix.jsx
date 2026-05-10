import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Button from '../../UI/Button/Button';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import Modal from '../../UI/Modal/Modal';
import DashboardFilterToolbar from '../../Shared/DashboardFilterToolbar';
import './AdminTeachingMatrix.scss';

const LIST_LIMIT = 100;

const initialsLine = (firstName, middleName) => {
  const a = firstName?.trim()?.[0];
  const b = middleName?.trim()?.[0];
  const parts = [];
  if (a) parts.push(`${a}.`);
  if (b) parts.push(`${b}.`);
  return parts.join('') || '';
};

const teacherLines = (t) => {
  if (!t) return { last: '—', io: '' };
  const last = (t.lastName ?? t.last_name ?? '').trim() || '—';
  const io = initialsLine(t.firstName ?? t.first_name, t.middleName ?? t.middle_name);
  return { last, io };
};

const teacherLabel = (t) => {
  const { last, io } = teacherLines(t);
  return io ? `${last} ${io}`.trim() : last;
};

const AdminTeachingMatrix = () => {
  const { showSuccess, showError } = useNotification();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const [matrix, setMatrix] = useState({ subjects: [], groups: [], loads: [] });
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addCtx, setAddCtx] = useState(null);
  const [editCtx, setEditCtx] = useState(null);
  const [modalTeacherId, setModalTeacherId] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [removeTarget, setRemoveTarget] = useState(null);

  const loadMap = useMemo(() => {
    const m = new Map();
    for (const L of matrix.loads) {
      const sid = L.subjectId ?? L.subject_id;
      const gid = L.groupId ?? L.group_id;
      if (sid != null && gid != null) {
        m.set(`${sid}:${gid}`, L);
      }
    }
    return m;
  }, [matrix.loads]);

  const filteredSubjects = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return matrix.subjects;
    return matrix.subjects.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const code = (s.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [matrix.subjects, debouncedSearch]);

  const filteredGroups = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return matrix.groups;
    return matrix.groups.filter((g) => (g.name || '').toLowerCase().includes(q));
  }, [matrix.groups, debouncedSearch]);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/teaching-loads/matrix');
      setMatrix({
        subjects: Array.isArray(data?.subjects) ? data.subjects : [],
        groups: Array.isArray(data?.groups) ? data.groups : [],
        loads: Array.isArray(data?.loads) ? data.loads : [],
      });
    } catch (e) {
      setMatrix({ subjects: [], groups: [], loads: [] });
      setError(firstApiErrorMessage(e, 'Не удалось загрузить матрицу назначений'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMatrix();
  }, [fetchMatrix]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/users', {
          params: { role: 'teacher', per_page: LIST_LIMIT, sort: 'name_asc' },
        });
        if (!cancelled) setTeacherOptions(Array.isArray(data?.data) ? data.data : []);
      } catch {
        if (!cancelled) setTeacherOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetSearch = useCallback(() => setSearch(''), []);
  const resetDisabled = useMemo(() => !search.trim(), [search]);

  const openAdd = (subject, group) => {
    setEditCtx(null);
    setAddCtx({ subject, group });
    setModalTeacherId('');
  };

  const openEdit = (subject, group, load) => {
    setAddCtx(null);
    setEditCtx({ subject, group, load });
    const tid = load?.teacherId ?? load?.teacher_id;
    setModalTeacherId(tid != null ? String(tid) : '');
  };

  const closeModals = () => {
    setAddCtx(null);
    setEditCtx(null);
    setModalTeacherId('');
    setModalSubmitting(false);
  };

  const submitModal = async () => {
    if (!modalTeacherId) {
      showError('Выберите преподавателя');
      return;
    }
    setModalSubmitting(true);
    try {
      if (addCtx) {
        await api.post('/admin/teaching-loads', {
          teacher_id: Number(modalTeacherId),
          subject_id: addCtx.subject.id,
          group_id: addCtx.group.id,
        });
        showSuccess('Назначение добавлено');
      } else if (editCtx?.load) {
        await api.put(`/admin/teaching-loads/${editCtx.load.id}`, {
          teacher_id: Number(modalTeacherId),
        });
        showSuccess('Назначение обновлено');
      }
      closeModals();
      void fetchMatrix();
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось сохранить'));
    } finally {
      setModalSubmitting(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget?.id) return;
    try {
      await api.delete(`/admin/teaching-loads/${removeTarget.id}`);
      showSuccess('Назначение снято');
      setRemoveTarget(null);
      void fetchMatrix();
    } catch (e) {
      showError(firstApiErrorMessage(e, 'Не удалось удалить назначение'));
      throw e;
    }
  };

  const modalOpen = Boolean(addCtx || editCtx);
  const modalTitle = addCtx ? 'Новое назначение' : 'Редактирование назначения';
  const modalSubject = addCtx?.subject ?? editCtx?.subject;
  const modalGroup = addCtx?.group ?? editCtx?.group;

  const emptyMatrix =
    !loading &&
    (matrix.subjects.length === 0 || matrix.groups.length === 0) &&
    !error;
  const noRowsAfterFilter =
    !loading && !error && matrix.subjects.length > 0 && filteredSubjects.length === 0;
  const noColsAfterFilter =
    !loading && !error && matrix.groups.length > 0 && filteredGroups.length === 0;

  return (
    <div className="admin-teaching-matrix">
      <div className="admin-teaching-matrix__head">
        <div className="admin-teaching-matrix__titles">
          <h1 className="admin-teaching-matrix__title">Матрица назначений</h1>
          <p className="admin-teaching-matrix__subtitle">
            Строки — предметы, столбцы — группы. В ячейке — преподаватель (клик по ФИО — сменить), «×» — снять назначение;
            пустая ячейка — «+доб».
          </p>
        </div>
      </div>

      <DashboardFilterToolbar
        className="admin-teaching-matrix__filter-toolbar"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Фильтр по названию предмета, коду или группы…"
        onReset={resetSearch}
        resetDisabled={resetDisabled}
        showFilterPanel={false}
        popoverAriaLabel="Поиск"
      />

      {error && (
        <div className="admin-teaching-matrix__banner admin-teaching-matrix__banner--error" role="alert">
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={() => void fetchMatrix()}>
            Повторить
          </Button>
        </div>
      )}

      <div className={`admin-teaching-matrix__grid-wrap${loading ? ' admin-teaching-matrix__grid-wrap--loading' : ''}`}>
        {loading && <p className="admin-teaching-matrix__hint">Загрузка…</p>}
        {emptyMatrix && !error && !loading && (
          <p className="admin-teaching-matrix__hint">
            Нет активных предметов или групп. Добавьте их в разделах «Предметы» и «Группы».
          </p>
        )}
        {noRowsAfterFilter && (
          <p className="admin-teaching-matrix__hint">Нет предметов по фильтру. Измените поиск.</p>
        )}
        {noColsAfterFilter && (
          <p className="admin-teaching-matrix__hint">Нет групп по фильтру. Измените поиск.</p>
        )}
        {!loading &&
          !emptyMatrix &&
          filteredSubjects.length > 0 &&
          filteredGroups.length > 0 &&
          !error && (
            <div className="admin-teaching-matrix__matrix-scroll">
              <table className="admin-teaching-matrix__matrix">
                <thead>
                  <tr>
                    <th className="admin-teaching-matrix__corner" scope="col">
                      <span className="admin-teaching-matrix__corner-line">
                        Предметы <span aria-hidden="true">↓</span>
                      </span>
                      <span className="admin-teaching-matrix__corner-sep">/</span>
                      <span className="admin-teaching-matrix__corner-line">
                        Группы <span aria-hidden="true">→</span>
                      </span>
                    </th>
                    {filteredGroups.map((g) => (
                      <th key={g.id} className="admin-teaching-matrix__col-head" scope="col">
                        {g.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((subject) => (
                    <tr key={subject.id}>
                      <th className="admin-teaching-matrix__row-head" scope="row">
                        <div className="admin-teaching-matrix__row-head-inner">
                          <Link
                            className="admin-teaching-matrix__subject-link"
                            to="/admin/subjects"
                            state={{ viewSubjectId: subject.id }}
                          >
                            {subject.name}
                          </Link>
                          {subject.code ? (
                            <span className="admin-teaching-matrix__subject-code">({subject.code})</span>
                          ) : null}
                        </div>
                      </th>
                      {filteredGroups.map((group) => {
                        const load = loadMap.get(`${subject.id}:${group.id}`);
                        if (load) {
                          const { last, io } = teacherLines(load.teacher);
                          return (
                            <td key={group.id} className="admin-teaching-matrix__cell">
                              <div className="admin-teaching-matrix__cell-filled">
                                <button
                                  type="button"
                                  className="admin-teaching-matrix__teacher-btn"
                                  onClick={() => openEdit(subject, group, load)}
                                >
                                  <span className="admin-teaching-matrix__teacher-line">{last}</span>
                                  {io ? <span className="admin-teaching-matrix__teacher-line">{io}</span> : null}
                                </button>
                                <button
                                  type="button"
                                  className="admin-teaching-matrix__cell-remove"
                                  aria-label="Снять назначение"
                                  title="Снять назначение"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemoveTarget(load);
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={group.id} className="admin-teaching-matrix__cell admin-teaching-matrix__cell--empty">
                            <button type="button" className="admin-teaching-matrix__add-btn" onClick={() => openAdd(subject, group)}>
                              +доб
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => !modalSubmitting && closeModals()} title={modalTitle} size="medium">
        <div className="atm-modal">
          {modalSubject && (
            <p className="atm-modal__ctx">
              <span className="atm-modal__ctx-label">Предмет:</span> {modalSubject.name}
              {modalSubject.code ? ` (${modalSubject.code})` : ''}
            </p>
          )}
          {modalGroup && (
            <p className="atm-modal__ctx">
              <span className="atm-modal__ctx-label">Группа:</span> {modalGroup.name}
            </p>
          )}
          <label className="atm-modal__label" htmlFor="atm-modal-teacher">
            Преподаватель
          </label>
          <select
            id="atm-modal-teacher"
            className="atm-modal__select"
            value={modalTeacherId}
            onChange={(e) => setModalTeacherId(e.target.value)}
            disabled={modalSubmitting}
          >
            <option value="">Выберите</option>
            {teacherOptions.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {teacherLabel(t)}
              </option>
            ))}
          </select>
          <div className="atm-modal__actions">
            <Button type="button" variant="secondary" onClick={closeModals} disabled={modalSubmitting}>
              Отмена
            </Button>
            <Button type="button" variant="primary" onClick={() => void submitModal()} loading={modalSubmitting}>
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Снять назначение"
        message="Преподаватель потеряет доступ к этому предмету в выбранной группе. Задания сохранятся."
        confirmText="Убрать"
        cancelText="Отмена"
        danger
        onConfirm={async () => {
          await confirmRemove();
        }}
      />
    </div>
  );
};

export default AdminTeachingMatrix;
