import React, { useEffect, useMemo, useState } from 'react';
import Button from '../../UI/Button/Button';
import Badge from '../../UI/Badge/Badge';
import Card from '../../UI/Card/Card';
import Modal from '../../UI/Modal/Modal';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import Pagination from '../../UI/Pagination/Pagination';
import { useNotification } from '../../../context/NotificationContext';
import {
  updateAdminFilterField,
  resetAdminFilterState,
  prevAdminFilterPage,
  nextAdminFilterPage,
  handleAdminActionResult,
} from '../../../utils';
import '../SubjectManagement/SubjectManagement.scss';

const emptyForm = {
  teacherId: '',
  subjectId: '',
  groupId: '',
  status: 'active',
};

const getPersonName = (user) =>
  user?.fullName || [user?.lastName, user?.firstName, user?.middleName].filter(Boolean).join(' ').trim() || user?.login || '';

const getLoadTitle = (load) =>
  `${getPersonName(load?.teacher) || 'Преподаватель'} · ${load?.subject?.name || 'Предмет'} · ${load?.group?.name || 'Группа'}`;

const TeachingLoadManagement = ({
  teachingLoads = [],
  teachers = [],
  subjects = [],
  groups = [],
  paginationMeta = {},
  query = {},
  onFetchTeachingLoads,
  onCreateTeachingLoad,
  onUpdateTeachingLoad,
  onDeleteTeachingLoad,
}) => {
  const { showError, showSuccess } = useNotification();
  const [filterState, setFilterState] = useState({
    search: '',
    teacherId: 'all',
    subjectId: 'all',
    groupId: 'all',
    status: 'all',
    sort: query.sort || 'teacher_asc',
    page: query.page || 1,
    perPage: query.perPage || 18,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingLoad, setEditingLoad] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loadToDelete, setLoadToDelete] = useState(null);

  const activeSubjects = useMemo(
    () => subjects.filter((subject) => subject.status !== 'inactive'),
    [subjects]
  );
  const activeGroups = useMemo(
    () => groups.filter((group) => group.status !== 'inactive'),
    [groups]
  );

  useEffect(() => {
    onFetchTeachingLoads?.({
      search: filterState.search || undefined,
      teacherId: filterState.teacherId !== 'all' ? Number(filterState.teacherId) : undefined,
      subjectId: filterState.subjectId !== 'all' ? Number(filterState.subjectId) : undefined,
      groupId: filterState.groupId !== 'all' ? Number(filterState.groupId) : undefined,
      status: filterState.status !== 'all' ? filterState.status : undefined,
      sort: filterState.sort,
      page: filterState.page,
      perPage: filterState.perPage,
    });
  }, [filterState, onFetchTeachingLoads]);

  const closeForm = () => {
    setShowForm(false);
    setEditingLoad(null);
    setFormData(emptyForm);
  };

  const openCreateForm = () => {
    setEditingLoad(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (load) => {
    setEditingLoad(load);
    setFormData({
      teacherId: String(load.teacherId || ''),
      subjectId: String(load.subjectId || ''),
      groupId: String(load.groupId || ''),
      status: load.status || 'active',
    });
    setShowForm(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (!formData.teacherId || !formData.subjectId || !formData.groupId) {
      showError('Выберите преподавателя, предмет и группу.');
      return;
    }

    const payload = {
      teacherId: Number(formData.teacherId),
      subjectId: Number(formData.subjectId),
      groupId: Number(formData.groupId),
      status: formData.status,
    };

    setSaving(true);
    try {
      const result = editingLoad
        ? await onUpdateTeachingLoad?.(editingLoad.id, payload)
        : await onCreateTeachingLoad?.(payload);
      const isSuccess = handleAdminActionResult({
        result,
        showSuccess,
        showError,
        errorMessage: 'Не удалось сохранить нагрузку.',
      });
      if (!isSuccess) {
        return;
      }
      showSuccess(editingLoad ? 'Нагрузка обновлена.' : 'Нагрузка назначена.');
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!loadToDelete) {
      return;
    }
    const result = await onDeleteTeachingLoad?.(loadToDelete.id);
    const isSuccess = handleAdminActionResult({
      result,
      showSuccess,
      showError,
      errorMessage: 'Не удалось удалить нагрузку.',
    });
    if (!isSuccess) {
      return;
    }
    showSuccess('Нагрузка удалена.');
    setLoadToDelete(null);
  };

  return (
    <div className="subject-management teaching-load-management">
      <div className="subject-management__header">
        <div className="header-info">
          <h1>Учебная нагрузка</h1>
          <p>Назначайте, какой преподаватель ведет конкретный предмет у конкретной группы.</p>
        </div>
        <div className="subject-management__header-actions">
          <Button variant="primary" onClick={openCreateForm}>
            Назначить нагрузку
          </Button>
        </div>
      </div>

      <Card className="subject-management__filters">
        <div className="subject-management__filters-grid">
          <div className="subject-management__filter-field subject-management__filter-field--search">
            <label>Поиск</label>
            <input
              type="text"
              placeholder="ФИО, предмет или группа"
              value={filterState.search}
              onChange={(event) => setFilterState((prev) => updateAdminFilterField(prev, 'search', event.target.value))}
            />
          </div>
          <div className="subject-management__filter-field">
            <label>Преподаватель</label>
            <select
              value={filterState.teacherId}
              onChange={(event) => setFilterState((prev) => updateAdminFilterField(prev, 'teacherId', event.target.value))}
            >
              <option value="all">Все преподаватели</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{getPersonName(teacher)}</option>
              ))}
            </select>
          </div>
          <div className="subject-management__filter-field">
            <label>Предмет</label>
            <select
              value={filterState.subjectId}
              onChange={(event) => setFilterState((prev) => updateAdminFilterField(prev, 'subjectId', event.target.value))}
            >
              <option value="all">Все предметы</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>
          <div className="subject-management__filter-field">
            <label>Группа</label>
            <select
              value={filterState.groupId}
              onChange={(event) => setFilterState((prev) => updateAdminFilterField(prev, 'groupId', event.target.value))}
            >
              <option value="all">Все группы</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          <div className="subject-management__filter-field">
            <label>Статус</label>
            <select
              value={filterState.status}
              onChange={(event) => setFilterState((prev) => updateAdminFilterField(prev, 'status', event.target.value))}
            >
              <option value="all">Любой статус</option>
              <option value="active">Активная</option>
              <option value="inactive">Неактивная</option>
            </select>
          </div>
          <div className="subject-management__filter-field subject-management__filter-field--action">
            <label>Действия</label>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setFilterState((prev) => resetAdminFilterState(prev, {
                  search: '',
                  teacherId: 'all',
                  subjectId: 'all',
                  groupId: 'all',
                  status: 'all',
                  sort: query.sort || 'teacher_asc',
                  page: 1,
                }))
              }
            >
              Сбросить
            </Button>
          </div>
        </div>
      </Card>

      <div className="subject-management__cards">
        {teachingLoads.length === 0 ? (
          <Card className="subjects-table-container"><p>Нагрузка не назначена</p></Card>
        ) : (
          teachingLoads.map((load) => (
            <Card className="subject-card teaching-load-card" key={load.id} padding="small">
              <div className="subject-card__top">
                <h3>{load.subject?.name || 'Предмет'}</h3>
                <Badge size="small" variant={load.status === 'active' ? 'success' : 'secondary'}>
                  {load.status === 'active' ? 'Активна' : 'Неактивна'}
                </Badge>
              </div>
              <p className="subject-card__meta">
                {getPersonName(load.teacher)} · {load.group?.name || 'Группа'}
              </p>
              <div className="subject-actions">
                <Button size="small" variant="secondary" onClick={() => openEditForm(load)}>
                  Изменить
                </Button>
                <Button size="small" variant="danger" onClick={() => setLoadToDelete(load)}>
                  Удалить
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Pagination
        className="subject-management__pagination"
        currentPage={paginationMeta.currentPage}
        lastPage={paginationMeta.lastPage}
        total={paginationMeta.total}
        fallbackCount={teachingLoads.length}
        onPrev={() => setFilterState((prev) => prevAdminFilterPage(prev, paginationMeta.currentPage))}
        onNext={() => setFilterState((prev) => nextAdminFilterPage(prev, paginationMeta.currentPage))}
      />

      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingLoad ? 'Редактировать нагрузку' : 'Назначить нагрузку'}
        size="medium"
        className="admin-form-modal"
      >
        <form className="subject-form-card subject-form-card--modal" onSubmit={handleSave} aria-busy={saving}>
          <div className="form-grid">
            <div className="form-group">
              <label>Преподаватель *</label>
              <select
                value={formData.teacherId}
                onChange={(event) => setFormData((prev) => ({ ...prev, teacherId: event.target.value }))}
                required
              >
                <option value="">Выберите преподавателя</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{getPersonName(teacher)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Предмет *</label>
              <select
                value={formData.subjectId}
                onChange={(event) => setFormData((prev) => ({ ...prev, subjectId: event.target.value }))}
                required
              >
                <option value="">Выберите предмет</option>
                {activeSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Группа *</label>
              <select
                value={formData.groupId}
                onChange={(event) => setFormData((prev) => ({ ...prev, groupId: event.target.value }))}
                required
              >
                <option value="">Выберите группу</option>
                {activeGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Статус</label>
              <select
                value={formData.status}
                onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="active">Активная</option>
                <option value="inactive">Неактивная</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <Button type="submit" variant="primary" loading={saving} disabled={saving}>
              {editingLoad ? 'Сохранить' : 'Назначить'}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(loadToDelete)}
        onClose={() => setLoadToDelete(null)}
        onConfirm={confirmDelete}
        title="Удаление нагрузки"
        message={loadToDelete ? `Удалить назначение "${getLoadTitle(loadToDelete)}"?` : ''}
        confirmText="Удалить"
        cancelText="Отмена"
        danger
      />
    </div>
  );
};

export default TeachingLoadManagement;
