import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { getApiErrorMessage } from '../../../utils/adminApiErrors';
import {
  TEACHER_REQUEST_MESSAGES,
  groupsWithActiveSubjectOnCourse,
  mergeGroupsForSubject,
  resolveDisciplinePickerEmptyMessage,
  resolveLoadGroupEmptyMessage,
} from '../../../utils/teacherRequestMessages';
import Button from '../../UI/Button/Button';
import EmptyState from '../../UI/EmptyState/EmptyState';
import FileDropzone from '../../UI/FileDropzone/FileDropzone';
import LoadingState from '../../UI/LoadingState/LoadingState';
import Modal from '../../UI/Modal/Modal';
import TextArea from '../../UI/TextArea/TextArea';
import './TeacherDisciplinesSection.scss';

const requestStatusLabel = (status) => {
  if (status === 'approved') return 'Одобрена';
  if (status === 'rejected') return 'Отклонена';
  return 'На рассмотрении';
};

const TeacherDisciplinesSection = () => {
  const { showSuccess, showError } = useNotification();
  const [data, setData] = useState({
    disciplines: [],
    teachingLoads: [],
    disciplineRequests: [],
    teachingLoadRequests: [],
  });
  const [options, setOptions] = useState({ subjects: [], groups: [] });
  const [loading, setLoading] = useState(true);
  const [disciplineModalOpen, setDisciplineModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [specialtyId, setSpecialtyId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [programSubjects, setProgramSubjects] = useState([]);
  const [programSubjectsLoading, setProgramSubjectsLoading] = useState(false);
  const [subjectComment, setSubjectComment] = useState('');
  const [subjectFile, setSubjectFile] = useState(null);
  const [loadSubjectId, setLoadSubjectId] = useState('');
  const [loadGroupId, setLoadGroupId] = useState('');
  const [loadComment, setLoadComment] = useState('');
  const [loadFile, setLoadFile] = useState(null);
  const [disciplineSubmitting, setDisciplineSubmitting] = useState(false);
  const [loadSubmitting, setLoadSubmitting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const loadsByGroup = useMemo(() => {
    const map = new Map();
    data.teachingLoads.forEach((item) => {
      const groupId = item.group?.id ?? item.group_id ?? item.id;
      const groupName = item.group?.name || 'Группа';
      const course = item.group?.currentCourse ?? item.group?.current_course;
      const label = course ? `${groupName} · ${course} курс` : groupName;
      if (!map.has(groupId)) {
        map.set(groupId, { id: groupId, label, items: [] });
      }
      map.get(groupId).items.push(item);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [data.teachingLoads]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, optionsRes] = await Promise.all([
        api.get('/teacher/disciplines'),
        api.get('/teacher/disciplines/options'),
      ]);
      setData({
        disciplines: listRes.data?.disciplines || [],
        teachingLoads: listRes.data?.teachingLoads || listRes.data?.teaching_loads || [],
        disciplineRequests: listRes.data?.disciplineRequests || [],
        teachingLoadRequests: listRes.data?.teachingLoadRequests || [],
      });
      setOptions({
        subjects: optionsRes.data?.subjects || [],
        specialties: optionsRes.data?.specialties || [],
        groups: optionsRes.data?.groups || [],
      });
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось загрузить дисциплины'));
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const catalogGroupsForSubject = useMemo(
    () => groupsWithActiveSubjectOnCourse(options.groups, loadSubjectId),
    [options.groups, loadSubjectId],
  );

  const programGroupsForSubject = useMemo(
    () => mergeGroupsForSubject(catalogGroupsForSubject, data.teachingLoads, loadSubjectId),
    [catalogGroupsForSubject, data.teachingLoads, loadSubjectId],
  );

  const assignedGroupIdsForSubject = useMemo(() => {
    const ids = new Set();
    if (!loadSubjectId) {
      return ids;
    }
    (data.teachingLoads || []).forEach((load) => {
      const subjectId = load.subject?.id ?? load.subjectId ?? load.subject_id;
      const groupId = load.group?.id ?? load.groupId ?? load.group_id;
      if (String(subjectId) === String(loadSubjectId) && groupId != null && groupId !== '') {
        ids.add(String(groupId));
      }
    });
    return ids;
  }, [data.teachingLoads, loadSubjectId]);

  const pendingGroupIdsForSubject = useMemo(() => {
    const ids = new Set();
    if (!loadSubjectId) {
      return ids;
    }
    (data.teachingLoadRequests || []).forEach((request) => {
      if (request.status !== 'pending') {
        return;
      }
      const subjectId = request.subject?.id ?? request.subjectId ?? request.subject_id;
      const groupId = request.group?.id ?? request.groupId ?? request.group_id;
      if (String(subjectId) === String(loadSubjectId) && groupId != null && groupId !== '') {
        ids.add(String(groupId));
      }
    });
    return ids;
  }, [data.teachingLoadRequests, loadSubjectId]);

  const selectableGroupsForSubject = useMemo(
    () => programGroupsForSubject.filter(
      (group) => !assignedGroupIdsForSubject.has(String(group.id))
        && !pendingGroupIdsForSubject.has(String(group.id)),
    ),
    [programGroupsForSubject, assignedGroupIdsForSubject, pendingGroupIdsForSubject],
  );

  const hasLoadSubjectSelected = Boolean(loadSubjectId);
  const loadRequestBlocked = hasLoadSubjectSelected && selectableGroupsForSubject.length === 0;

  const loadGroupEmptyMessage = useMemo(
    () => resolveLoadGroupEmptyMessage({
      loadSubjectId,
      selectableGroups: selectableGroupsForSubject,
      catalogGroups: catalogGroupsForSubject,
      assignedGroupIds: assignedGroupIdsForSubject,
      pendingGroupIds: pendingGroupIdsForSubject,
    }),
    [
      loadSubjectId,
      selectableGroupsForSubject,
      catalogGroupsForSubject,
      assignedGroupIdsForSubject,
      pendingGroupIdsForSubject,
    ],
  );

  const ownedSubjectIds = useMemo(() => {
    const ids = new Set();
    data.disciplines.forEach((item) => {
      const id = item.subject?.id ?? item.subjectId ?? item.subject_id;
      if (id != null && id !== '') {
        ids.add(String(id));
      }
    });
    return ids;
  }, [data.disciplines]);

  const pendingDisciplineSubjectIds = useMemo(() => {
    const ids = new Set();
    (data.disciplineRequests || []).forEach((request) => {
      if (request.status !== 'pending') {
        return;
      }
      const id = request.subject?.id ?? request.subjectId ?? request.subject_id;
      if (id != null && id !== '') {
        ids.add(String(id));
      }
    });
    return ids;
  }, [data.disciplineRequests]);

  const selectableProgramSubjects = useMemo(
    () => programSubjects.filter(
      (subject) => !ownedSubjectIds.has(String(subject.id))
        && !pendingDisciplineSubjectIds.has(String(subject.id)),
    ),
    [programSubjects, ownedSubjectIds, pendingDisciplineSubjectIds],
  );

  const disciplinePickerEmptyMessage = useMemo(
    () => resolveDisciplinePickerEmptyMessage({
      specialtyId,
      programSubjects,
      selectableSubjects: selectableProgramSubjects,
      ownedSubjectIds,
      pendingSubjectIds: pendingDisciplineSubjectIds,
    }),
    [specialtyId, programSubjects, selectableProgramSubjects, ownedSubjectIds, pendingDisciplineSubjectIds],
  );

  const filteredProgramSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    if (!query) {
      return selectableProgramSubjects;
    }
    return selectableProgramSubjects.filter((subject) => {
      const name = String(subject.name || '').toLowerCase();
      const code = String(subject.code || '').toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [selectableProgramSubjects, subjectSearch]);

  useEffect(() => {
    if (!disciplineModalOpen || !specialtyId) {
      setProgramSubjects([]);
      setProgramSubjectsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setProgramSubjectsLoading(true);

    (async () => {
      try {
        const { data: response } = await api.get(`/teacher/disciplines/specialties/${specialtyId}/subjects`);
        if (cancelled) {
          return;
        }
        const list = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
        setProgramSubjects(list);
      } catch (e) {
        if (!cancelled) {
          setProgramSubjects([]);
          showError(getApiErrorMessage(e, 'Не удалось загрузить дисциплины программы'));
        }
      } finally {
        if (!cancelled) {
          setProgramSubjectsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [disciplineModalOpen, specialtyId, showError]);

  const resetDisciplineForm = () => {
    setSpecialtyId('');
    setSubjectId('');
    setSubjectSearch('');
    setProgramSubjects([]);
    setProgramSubjectsLoading(false);
    setSubjectComment('');
    setSubjectFile(null);
  };

  const resetLoadForm = () => {
    setLoadSubjectId('');
    setLoadGroupId('');
    setLoadComment('');
    setLoadFile(null);
  };

  const closeDisciplineModal = () => {
    if (disciplineSubmitting) return;
    setDisciplineModalOpen(false);
    resetDisciplineForm();
  };

  const closeLoadModal = () => {
    if (loadSubmitting) return;
    setLoadModalOpen(false);
    resetLoadForm();
  };

  const submitDisciplineRequest = async () => {
    if (!specialtyId) {
      showError('Выберите специальность');
      return;
    }
    if (!subjectId) {
      showError('Выберите дисциплину из программы специальности');
      return;
    }
    setDisciplineSubmitting(true);
    try {
      const form = new FormData();
      form.append('subject_id', subjectId);
      if (subjectComment.trim()) form.append('comment', subjectComment.trim());
      if (subjectFile) form.append('document', subjectFile);
      await api.post('/teacher/discipline-requests', form);
      showSuccess('Заявка на дисциплину отправлена');
      setDisciplineModalOpen(false);
      resetDisciplineForm();
      await load();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось отправить заявку'));
    } finally {
      setDisciplineSubmitting(false);
    }
  };

  const submitLoadRequest = async () => {
    if (!loadSubjectId) {
      showError('Выберите дисциплину');
      return;
    }
    if (loadRequestBlocked) {
      showError(loadGroupEmptyMessage || 'Нет доступных групп для нового назначения');
      return;
    }
    if (!loadGroupId) {
      showError('Выберите группу');
      return;
    }
    setLoadSubmitting(true);
    try {
      const form = new FormData();
      form.append('subject_id', loadSubjectId);
      form.append('group_id', loadGroupId);
      if (loadComment.trim()) form.append('comment', loadComment.trim());
      if (loadFile) form.append('document', loadFile);
      await api.post('/teacher/teaching-load-requests', form);
      showSuccess('Заявка на назначение отправлена');
      setLoadModalOpen(false);
      resetLoadForm();
      await load();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось отправить заявку'));
    } finally {
      setLoadSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState message="Загрузка дисциплин..." />;
  }

  return (
    <section className="teacher-disciplines-section">
      <div className="teacher-disciplines-section__actions">
        <Button type="button" variant="primary" onClick={() => setDisciplineModalOpen(true)}>
          Запросить дисциплину
        </Button>
        <Button type="button" variant="outline" onClick={() => setLoadModalOpen(true)}>
          Запросить назначение
        </Button>
      </div>

      <div className="teacher-disciplines-section__grid">
        <div className="teacher-disciplines-section__card">
          <h2>Мои дисциплины</h2>
          {data.disciplines.length === 0 && <EmptyState title="Допусков пока нет" message="Подайте заявку или обратитесь к администратору" />}
          {data.disciplines.map((item) => (
            <div key={item.id} className="teacher-disciplines-section__item">
              <strong>{item.subject?.name || 'Дисциплина'}</strong>
              <span>{item.subject?.code || '—'}</span>
            </div>
          ))}
        </div>

        <div className="teacher-disciplines-section__card">
          <h2>Мои назначения</h2>
          {data.teachingLoads.length === 0 && (
            <EmptyState title="Назначений пока нет" message="Запросите назначение на группу или обратитесь к администратору" />
          )}
          {loadsByGroup.length > 0 && (
            <div className="teacher-disciplines-section__accordion">
              {loadsByGroup.map((group) => {
                const isOpen = expandedGroups.has(group.id);
                return (
                  <div
                    key={group.id}
                    className={`teacher-disciplines-section__accordion-item${isOpen ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="teacher-disciplines-section__accordion-trigger"
                      aria-expanded={isOpen}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <span className="teacher-disciplines-section__accordion-title">{group.label}</span>
                      <span className="teacher-disciplines-section__accordion-meta">
                        {group.items.length} {group.items.length === 1 ? 'дисциплина' : group.items.length < 5 ? 'дисциплины' : 'дисциплин'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="teacher-disciplines-section__accordion-panel">
                        {group.items.map((item) => (
                          <div key={item.id} className="teacher-disciplines-section__item">
                            <strong>{item.subject?.name || 'Дисциплина'}</strong>
                            {item.subject?.code && <span>{item.subject.code}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="teacher-disciplines-section__card">
        <h2>История заявок</h2>
        {[...data.disciplineRequests, ...data.teachingLoadRequests].length === 0 && (
          <p className="teacher-disciplines-section__muted">Заявок пока нет</p>
        )}
        {data.disciplineRequests.map((request) => (
          <div key={`d-${request.id}`} className="teacher-disciplines-section__request">
            <strong>Дисциплина: {request.subject?.name || '—'}</strong>
            <span>{requestStatusLabel(request.status)}</span>
          </div>
        ))}
        {data.teachingLoadRequests.map((request) => (
          <div key={`l-${request.id}`} className="teacher-disciplines-section__request">
            <strong>Назначение: {request.subject?.name || '—'} · {request.group?.name || '—'}</strong>
            <span>{requestStatusLabel(request.status)}</span>
          </div>
        ))}
      </div>

      <Modal
        isOpen={disciplineModalOpen}
        onClose={closeDisciplineModal}
        title="Запросить дисциплину"
        subtitle="Заявка уйдёт администратору на рассмотрение"
        size="medium"
        contentClassName="teacher-disciplines-section__modal"
        closeDisabled={disciplineSubmitting}
        footer={(
          <>
            <Button
              type="button"
              variant="primary"
              loading={disciplineSubmitting}
              disabled={!specialtyId || !subjectId}
              onClick={() => void submitDisciplineRequest()}
            >
              Отправить заявку
            </Button>
          </>
        )}
      >
        <label className="teacher-disciplines-section__field">
          <span>Специальность</span>
          <select
            value={specialtyId}
            onChange={(e) => {
              setSpecialtyId(e.target.value);
              setSubjectId('');
              setSubjectSearch('');
            }}
            disabled={disciplineSubmitting}
          >
            <option value="">Выберите специальность</option>
            {(options.specialties || []).map((specialty) => (
              <option key={specialty.id} value={String(specialty.id)}>
                {specialty.code ? `${specialty.name} (${specialty.code})` : specialty.name}
              </option>
            ))}
          </select>
        </label>

        <div className="teacher-disciplines-section__picker">
          <span className="teacher-disciplines-section__picker-label">Дисциплина</span>
          {!specialtyId ? (
            <p className="teacher-disciplines-section__picker-hint" role="status">
              Сначала выберите специальность — затем откроется список дисциплин из её учебной программы.
            </p>
          ) : (
            <>
              <input
                type="search"
                className="teacher-disciplines-section__picker-search search-input"
                placeholder="Поиск по названию или коду дисциплины…"
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                disabled={disciplineSubmitting || programSubjectsLoading}
              />
              {programSubjectsLoading ? (
                <LoadingState message="Загрузка дисциплин..." />
              ) : disciplinePickerEmptyMessage ? (
                <p className="teacher-disciplines-section__picker-empty" role="status">
                  {disciplinePickerEmptyMessage}
                </p>
              ) : filteredProgramSubjects.length === 0 ? (
                <p className="teacher-disciplines-section__picker-empty" role="status">
                  {TEACHER_REQUEST_MESSAGES.discipline.searchEmpty}
                </p>
              ) : (
                <ul className="teacher-disciplines-section__picker-list">
                  {filteredProgramSubjects.map((subject) => (
                    <li key={subject.id}>
                      <label className="teacher-disciplines-section__picker-option">
                        <input
                          type="radio"
                          name="discipline-request-subject"
                          checked={String(subjectId) === String(subject.id)}
                          onChange={() => setSubjectId(String(subject.id))}
                          disabled={disciplineSubmitting}
                        />
                        <span>
                          {subject.name}
                          {subject.code ? ` (${subject.code})` : ''}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <TextArea
          label="Комментарий"
          value={subjectComment}
          onChange={setSubjectComment}
          placeholder="Основание, повышение квалификации, опыт преподавания..."
          rows={4}
          className="teacher-disciplines-section__textarea"
          disabled={disciplineSubmitting}
        />
        <FileDropzone
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          selectedFiles={subjectFile ? [subjectFile] : []}
          onFilesSelected={(files) => setSubjectFile(files?.[0] || null)}
          buttonText="Прикрепить файл"
          hint="PDF, DOC/DOCX, JPG или PNG до 5 МБ."
          disabled={disciplineSubmitting}
        />
      </Modal>

      <Modal
        isOpen={loadModalOpen}
        onClose={closeLoadModal}
        title="Запросить назначение"
        subtitle="Выберите дисциплину с допуском и группу, где она идёт на текущем курсе"
        size="medium"
        contentClassName="teacher-disciplines-section__modal"
        closeDisabled={loadSubmitting}
        footer={(
          <>
            <Button
              type="button"
              variant="primary"
              loading={loadSubmitting}
              disabled={loadRequestBlocked}
              onClick={() => void submitLoadRequest()}
            >
              Отправить на модерацию
            </Button>
          </>
        )}
      >
        <label className="teacher-disciplines-section__field">
          <span>Дисциплина</span>
          <select
            value={loadSubjectId}
            onChange={(e) => { setLoadSubjectId(e.target.value); setLoadGroupId(''); }}
            disabled={loadSubmitting}
          >
            <option value="">Выберите дисциплину</option>
            {options.subjects.map((subject) => (
              <option key={subject.id} value={String(subject.id)}>
                {subject.code ? `${subject.name} (${subject.code})` : subject.name}
              </option>
            ))}
          </select>
        </label>
        <div className="teacher-disciplines-section__field">
          <span>Группа</span>
          {loadGroupEmptyMessage ? (
            <p className="teacher-disciplines-section__empty-hint" role="status">
              {loadGroupEmptyMessage}
            </p>
          ) : (
            <select
              value={loadGroupId}
              onChange={(e) => setLoadGroupId(e.target.value)}
              disabled={!loadSubjectId || loadSubmitting}
            >
              <option value="">
                {loadSubjectId
                  ? 'Выберите группу'
                  : TEACHER_REQUEST_MESSAGES.load.selectDisciplineFirst}
              </option>
              {selectableGroupsForSubject.map((group) => {
                const course = group.currentCourse ?? group.current_course;
                return (
                  <option key={group.id} value={String(group.id)}>
                    {course ? `${group.name} · ${course} курс` : group.name}
                  </option>
                );
              })}
            </select>
          )}
        </div>
        <TextArea
          label="Комментарий"
          value={loadComment}
          onChange={setLoadComment}
          placeholder="Комментарий для администратора..."
          rows={4}
          className="teacher-disciplines-section__textarea"
          disabled={loadSubmitting}
        />
        <FileDropzone
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          selectedFiles={loadFile ? [loadFile] : []}
          onFilesSelected={(files) => setLoadFile(files?.[0] || null)}
          buttonText="Прикрепить файл"
          hint="PDF, DOC/DOCX, JPG или PNG до 5 МБ."
          disabled={loadSubmitting}
        />
      </Modal>
    </section>
  );
};

export default TeacherDisciplinesSection;
