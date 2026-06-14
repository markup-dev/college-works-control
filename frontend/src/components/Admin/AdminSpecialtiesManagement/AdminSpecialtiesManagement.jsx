import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { getApiErrorMessage } from '../../../utils/adminApiErrors';
import Button from '../../UI/Button/Button';
import EmptyState from '../../UI/EmptyState/EmptyState';
import EntityCard from '../../UI/EntityCard/EntityCard';
import ErrorBanner from '../../UI/ErrorBanner/ErrorBanner';
import LoadingState from '../../UI/LoadingState/LoadingState';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import SearchableSelect from '../../UI/SearchableSelect/SearchableSelect';
import { toSubjectSelectOptions } from '../../../utils/selectOptions';
import './AdminSpecialtiesManagement.scss';

const emptyForm = {
  code: '',
  name: '',
  studyYears: 4,
  status: 'active',
};

const specialtyStatusPresentation = (specialty) => (
  specialty.status === 'active'
    ? { label: 'Активна', tone: 'success' }
    : { label: 'Архив', tone: 'neutral' }
);

const AdminSpecialtiesManagement = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [specialties, setSpecialties] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [programItems, setProgramItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [specialtiesRes, subjectsRes] = await Promise.all([
        api.get('/admin/specialties'),
        api.get('/admin/subjects', { params: { per_page: 100, sort: 'name_asc', status: 'active' } }),
      ]);
      setSpecialties(Array.isArray(specialtiesRes.data?.data) ? specialtiesRes.data.data : []);
      setSubjects(Array.isArray(subjectsRes.data?.data) ? subjectsRes.data.data : []);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Не удалось загрузить специальности'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = () => {
    setForm(emptyForm);
    setProgramItems([]);
    setShowModal(true);
  };

  const courses = useMemo(
    () => Array.from({ length: Number(form.studyYears) || 1 }, (_, index) => index + 1),
    [form.studyYears],
  );

  const subjectOptionsForRow = useCallback((item, rowIndex) => {
    const course = Number(item.course);
    const currentSubjectId = Number(item.subjectId);
    const usedSubjectIds = new Set(
      programItems
        .filter((row, idx) => Number(row.course) === course && idx !== rowIndex && row.subjectId)
        .map((row) => Number(row.subjectId)),
    );

    return subjects.filter((subject) => {
      const id = Number(subject.id);
      if (currentSubjectId === id) return true;
      return !usedSubjectIds.has(id);
    });
  }, [programItems, subjects]);

  const addProgramItem = (course) => {
    setProgramItems((prev) => [
      ...prev,
      {
        course,
        subjectId: '',
        position: prev.filter((item) => Number(item.course) === Number(course)).length,
        status: 'active',
        note: '',
      },
    ]);
  };

  const updateProgramItem = (index, patch) => {
    setProgramItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const removeProgramItem = (index) => {
    setProgramItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveSpecialty = async () => {
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      studyYears: Number(form.studyYears),
      status: form.status,
    };
    if (!payload.code || !payload.name) {
      showError('Заполните код и название специальности');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/admin/specialties', payload);
      const specialty = res.data?.specialty;
      const specialtyId = specialty?.id;

      if (specialtyId) {
        const items = programItems
          .filter((item) => item.subjectId)
          .map((item, index) => ({
            subjectId: Number(item.subjectId),
            course: Number(item.course),
            position: Number(item.position ?? index),
            note: item.note || null,
          }));
        await api.put(`/admin/specialties/${specialtyId}/program`, { items });
      }

      showSuccess('Специальность создана');
      setShowModal(false);
      await loadData();
    } catch (e) {
      showError(getApiErrorMessage(e, 'Не удалось сохранить специальность'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-specialties-management">
      <div className="admin-specialties-management__head">
        <div>
          <h1 className="admin-specialties-management__title">Специальности и программы обучения</h1>
        </div>
        <Button type="button" variant="primary" onClick={openCreate}>Добавить специальность</Button>
      </div>

      {error && <ErrorBanner title="Ошибка" message={error} actionLabel="Повторить" onAction={() => void loadData()} />}
      {loading && <LoadingState message="Загрузка специальностей..." />}
      {!loading && specialties.length === 0 && <EmptyState title="Специальностей пока нет" message="Создайте первую программу обучения" />}

      {!loading && specialties.length > 0 && (
        <div className="admin-specialties-management__grid">
          {specialties.map((specialty, index) => {
            const st = specialtyStatusPresentation(specialty);
            const disciplines = specialty.programSubjectsCount || 0;
            const groupsCount = specialty.groupsCount || 0;

            return (
              <EntityCard
                key={specialty.id}
                className="specialty-card app-reveal-item"
                style={{ animationDelay: `${index * 0.03}s` }}
                padding="small"
                role="button"
                tabIndex={0}
                interactive
                onClick={() => navigate(`/admin/specialties/${specialty.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/specialties/${specialty.id}`);
                  }
                }}
              >
                <div className="specialty-card__body">
                  <div className="specialty-card__top">
                    <div className="specialty-card__title-block">
                      <div className="specialty-card__name">{specialty.name}</div>
                      {specialty.code ? (
                        <span className="specialty-card__code">{specialty.code}</span>
                      ) : null}
                    </div>
                    <StatusBadge tone={st.tone} className="specialty-card__status">
                      {st.label}
                    </StatusBadge>
                  </div>

                  <div className="specialty-card__fields">
                    <div className="specialty-card__row specialty-card__row--labeled">
                      <span className="specialty-card__label">Срок обучения</span>
                      <span className="specialty-card__value">{specialty.studyYears} г.</span>
                    </div>
                    <div className="specialty-card__row specialty-card__row--labeled">
                      <span className="specialty-card__label">Дисциплин</span>
                      <span className="specialty-card__value">{disciplines}</span>
                    </div>
                    <div className="specialty-card__row specialty-card__row--labeled">
                      <span className="specialty-card__label">Групп</span>
                      <span className="specialty-card__value">{groupsCount}</span>
                    </div>
                  </div>

                  <div className="specialty-card__actions" onClick={(event) => event.stopPropagation()}>
                    <Button
                      type="button"
                      size="small"
                      variant="outline"
                      onClick={() => navigate(`/admin/specialties/${specialty.id}?tab=program`)}
                    >
                      Программа
                    </Button>
                  </div>
                </div>
              </EntityCard>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => !saving && setShowModal(false)}
        title="Новая специальность"
        size="large"
        contentClassName="admin-specialties-management__modal"
        footer={(
          <Button
            type="button"
            variant="primary"
            loading={saving}
            disabled={saving || !form.code.trim() || !form.name.trim()}
            onClick={() => void saveSpecialty()}
          >
            Сохранить
          </Button>
        )}
      >
        <ModalSection title="Основные данные">
          <div className="admin-specialties-management__form-grid">
            <label>
              Код
              <input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="09.02.07"
                autoComplete="off"
              />
            </label>
            <label>
              Название
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Например: Прикладная информатика"
                autoComplete="off"
              />
            </label>
            <label>
              Срок обучения
              <input
                type="number"
                min="1"
                max="6"
                value={form.studyYears}
                onChange={(e) => setForm((prev) => ({ ...prev, studyYears: e.target.value }))}
                placeholder="4"
              />
            </label>
          </div>
        </ModalSection>

        <ModalSection title="Дисциплины по курсам" variant="soft">
          {courses.map((course) => (
            <div key={course} className="admin-specialties-management__course">
              <div className="admin-specialties-management__course-head">
                <strong>{course} курс</strong>
                <Button type="button" size="small" variant="outline" onClick={() => addProgramItem(course)}>Добавить дисциплину</Button>
              </div>
              {programItems.filter((item) => Number(item.course) === Number(course)).length === 0 && (
                <p className="admin-specialties-management__empty">Дисциплины не добавлены</p>
              )}
              {programItems.map((item, index) => (Number(item.course) === Number(course) ? (
                <div key={`${course}-${index}`} className="admin-specialties-management__program-row">
                  <SearchableSelect
                    value={item.subjectId}
                    onChange={(subjectId) => updateProgramItem(index, { subjectId })}
                    options={toSubjectSelectOptions(subjectOptionsForRow(item, index))}
                    placeholder="Выберите дисциплину"
                    searchPlaceholder="Найти дисциплину…"
                    emptyMessage="На этом курсе все дисциплины уже добавлены"
                    ariaLabel="Дисциплина"
                  />
                  <input
                    aria-label="Комментарий"
                    value={item.note}
                    placeholder="Комментарий"
                    onChange={(e) => updateProgramItem(index, { note: e.target.value })}
                  />
                  <Button type="button" size="small" variant="danger" onClick={() => removeProgramItem(index)}>Удалить</Button>
                </div>
              ) : null))}
            </div>
          ))}
        </ModalSection>
      </Modal>

    </div>
  );
};

export default AdminSpecialtiesManagement;
