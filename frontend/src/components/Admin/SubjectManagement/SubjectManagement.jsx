import React, { useEffect, useState } from 'react';
import Button from '../../UI/Button/Button';
import Badge from '../../UI/Badge/Badge';
import Card from '../../UI/Card/Card';
import Modal from '../../UI/Modal/Modal';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import FileDropzone from '../../UI/FileDropzone/FileDropzone';
import Pagination from '../../UI/Pagination/Pagination';
import { useNotification } from '../../../context/NotificationContext';
import {
  copyTextToClipboard,
  downloadCsvTemplate,
  updateAdminFilterField,
  resetAdminFilterState,
  prevAdminFilterPage,
  nextAdminFilterPage,
  handleAdminActionResult,
} from '../../../utils';
import './SubjectManagement.scss';

const SUBJECT_IMPORT_TEMPLATE = `name,status
Программирование,active
Базы данных,active`;

const createDefaultSubjectFormData = () => ({
  name: '',
  status: 'active',
});

const createSubjectFormDataFromSubject = (subject) => ({
  name: subject?.name || '',
  status: subject?.status || 'active',
});

const SubjectManagement = ({
  subjects = [],
  paginationMeta = {},
  query = {},
  onFetchSubjects,
  onCreateSubject,
  onUpdateSubject,
  onDeleteSubject,
  onPreviewSubjectsImport,
  onImportSubjects,
  className = '',
}) => {
  const { showError, showSuccess, showInfo } = useNotification();
  const [showForm, setShowForm] = useState(false);
  const [createMode, setCreateMode] = useState('manual');
  const [manualNamesInput, setManualNamesInput] = useState('');
  const [editingSubject, setEditingSubject] = useState(null);
  const [formData, setFormData] = useState(createDefaultSubjectFormData);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importMode, setImportMode] = useState('strict');
  const [importLoading, setImportLoading] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [filterState, setFilterState] = useState({
    search: '',
    status: 'all',
    sort: query.sort || 'name_asc',
    page: query.page || 1,
    perPage: query.perPage || 18,
  });

  const closeSubjectForm = () => {
    setShowForm(false);
    setEditingSubject(null);
    setFormData(createDefaultSubjectFormData());
  };

  const copyTemplate = async (content) => {
    try {
      await copyTextToClipboard(content);
      showSuccess('Шаблон скопирован в буфер обмена');
    } catch {
      showError('Не удалось скопировать шаблон');
    }
  };

  useEffect(() => {
    onFetchSubjects?.({
      search: filterState.search || undefined,
      status: filterState.status !== 'all' ? filterState.status : undefined,
      sort: filterState.sort,
      page: filterState.page,
      perPage: filterState.perPage,
    });
  }, [filterState, onFetchSubjects]);

  const handleCreate = () => {
    setFormData(createDefaultSubjectFormData());
    setManualNamesInput('');
    setImportFile(null);
    setImportPreview(null);
    setImportMode('strict');
    setCreateMode('manual');
    setEditingSubject(null);
    setFormErrors({});
    setShowForm(true);
  };

  const handleEdit = (subject) => {
    setFormData(createSubjectFormDataFromSubject(subject));
    setEditingSubject(subject);
    setFormErrors({});
    setShowForm(true);
  };

  const validateForm = () => {
    const errors = {};
    const trimmedName = formData.name?.trim() || '';

    if (!trimmedName) {
      errors.name = 'Название предмета обязательно';
    } else if (trimmedName.length < 2) {
      errors.name = 'Название предмета должно содержать минимум 2 символа';
    } else if (trimmedName.length > 100) {
      errors.name = 'Название предмета не должно превышать 100 символов';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const parseManualNames = (value) =>
    Array.from(
      new Set(
        value
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

  const handleSaveSubject = async (event) => {
    event.preventDefault();
    if (savingSubject) {
      return;
    }
    const payload = {
      name: formData.name?.trim() || '',
      status: formData.status,
    };
    setFormData((prev) => ({ ...prev, name: payload.name }));

    if (!validateForm()) {
      return;
    }

    setSavingSubject(true);
    try {
      const result = await onUpdateSubject?.(editingSubject.id, payload);
      const isSuccess = handleAdminActionResult({
        result,
        showSuccess,
        showError,
        errorMessage: 'Не удалось обновить предмет',
      });
      if (!isSuccess) {
        return;
      }

      showSuccess('Изменения сохранены');
      closeSubjectForm();
    } finally {
      setSavingSubject(false);
    }
  };

  const handleCreateManual = async () => {
    const names = parseManualNames(manualNamesInput);
    if (!names.length) {
      showError('Введите хотя бы одно название предмета.');
      return;
    }

    setImportLoading(true);
    let created = 0;
    const failed = [];

    for (const name of names) {
      // eslint-disable-next-line no-await-in-loop
      const result = await onCreateSubject?.({
        name,
        status: formData.status,
      });
      if (result?.success) {
        created += 1;
      } else {
        failed.push(name);
      }
    }
    setImportLoading(false);

    if (created > 0) {
      showSuccess(`Создано предметов: ${created}`);
    }
    if (failed.length) {
      showError(`Не удалось создать: ${failed.join(', ')}`);
      return;
    }

    closeSubjectForm();
    setManualNamesInput('');
  };

  const handleDelete = (subject) => {
    setSubjectToDelete(subject);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!subjectToDelete) {
      return;
    }
    await onDeleteSubject?.(subjectToDelete.id);
    setShowDeleteConfirm(false);
    setSubjectToDelete(null);
  };

  const handlePreviewImport = async () => {
    if (!importFile) {
      showError('Сначала выберите CSV файл');
      return;
    }
    setImportLoading(true);
    const result = await onPreviewSubjectsImport?.(importFile);
    setImportLoading(false);
    const isSuccess = handleAdminActionResult({
      result,
      showSuccess,
      showError,
      errorMessage: 'Не удалось проверить файл',
    });
    if (!isSuccess) {
      return;
    }
    setImportPreview(result.data?.data || result.data);
    const summary = (result.data?.data || result.data)?.summary;
    showInfo(`Проверено: валидных ${summary?.validRows ?? 0}, с ошибками ${summary?.errorRows ?? 0}`);
  };

  const handleCommitImport = async () => {
    if (!importPreview?.validRows?.length) {
      showError('Нет валидных строк для импорта');
      return;
    }
    setImportLoading(true);
    const result = await onImportSubjects?.(importPreview.validRows, importMode);
    setImportLoading(false);
    const isSuccess = handleAdminActionResult({
      result,
      showSuccess,
      showError,
      errorMessage: 'Импорт завершился с ошибкой',
    });
    if (!isSuccess) {
      return;
    }
    showSuccess('Импорт предметов завершен');
    setImportPreview(null);
    setImportFile(null);
    closeSubjectForm();
  };

  return (
    <div className={`subject-management ${className}`}>
      <div className="subject-management__header">
        <div className="header-info">
          <h1>Управление предметами</h1>
          <p>Создавайте предметы вручную списком или импортируйте CSV в одной модалке.</p>
        </div>
        <div className="subject-management__header-actions">
          <Button variant="primary" onClick={handleCreate}>
            Добавить / импортировать предметы
          </Button>
        </div>
      </div>

      <Card className="subject-management__filters">
        <div className="subject-management__filters-grid">
          <div className="subject-management__filter-field subject-management__filter-field--search">
            <label>Поиск</label>
            <input
              type="text"
              placeholder="По названию предмета"
              value={filterState.search}
              onChange={(event) => setFilterState((prev) => updateAdminFilterField(prev, 'search', event.target.value))}
            />
          </div>
          <div className="subject-management__filter-field">
            <label>Статус</label>
            <select
              value={filterState.status}
              onChange={(event) => setFilterState((prev) => updateAdminFilterField(prev, 'status', event.target.value))}
            >
              <option value="all">Любой статус</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
          </div>
          <div className="subject-management__filter-field">
            <label>Сортировка</label>
            <select
              value={filterState.sort}
              onChange={(event) => setFilterState((prev) => updateAdminFilterField(prev, 'sort', event.target.value))}
            >
              <option value="name_asc">Название А-Я</option>
              <option value="name_desc">Название Я-А</option>
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
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
                  status: 'all',
                  sort: query.sort || 'name_asc',
                  page: 1,
                }))
              }
            >
              Сбросить
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showForm}
        onClose={closeSubjectForm}
        title={editingSubject ? 'Редактировать предмет' : 'Создание и импорт предметов'}
        size="large"
        className="admin-form-modal"
      >
        <div className="subject-form-card subject-form-card--modal">
          {editingSubject ? (
            <form onSubmit={handleSaveSubject} aria-busy={savingSubject}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Название предмета *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    className={formErrors.name ? 'error' : ''}
                    placeholder="Введите название предмета"
                  />
                  {formErrors.name && <div className="error-text">{formErrors.name}</div>}
                </div>

                <div className="form-group">
                  <label>Статус</label>
                  <select
                    value={formData.status}
                    onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="active">Активный</option>
                    <option value="inactive">Неактивный</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <Button type="submit" variant="primary" loading={savingSubject} disabled={savingSubject}>
                  Сохранить изменения
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeSubjectForm}
                >
                  Отмена
                </Button>
              </div>
            </form>
          ) : (
            <div className="subject-create-wizard">
              <div className="subject-create-wizard__modes">
                <Button
                  type="button"
                  variant={createMode === 'manual' ? 'primary' : 'outline'}
                  onClick={() => setCreateMode('manual')}
                >
                  Ввести вручную
                </Button>
                <Button
                  type="button"
                  variant={createMode === 'import' ? 'primary' : 'outline'}
                  onClick={() => setCreateMode('import')}
                >
                  Импорт CSV
                </Button>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Статус по умолчанию</label>
                  <select
                    value={formData.status}
                    onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="active">Активный</option>
                    <option value="inactive">Неактивный</option>
                  </select>
                </div>
              </div>

              {createMode === 'manual' ? (
                <div className="form-group">
                  <label>Названия предметов (через запятую или с новой строки)</label>
                  <textarea
                    rows={5}
                    value={manualNamesInput}
                    onChange={(event) => setManualNamesInput(event.target.value)}
                    placeholder="Математика, Физика, Информатика"
                  />
                </div>
              ) : (
                <div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>CSV файл</label>
                      <FileDropzone
                        accept=".csv,.txt"
                        selectedFiles={importFile ? [importFile] : []}
                        buttonText="Выбрать CSV файл"
                        onFilesSelected={(files) => {
                          setImportFile(files[0] || null);
                          setImportPreview(null);
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Режим импорта</label>
                      <select value={importMode} onChange={(event) => setImportMode(event.target.value)}>
                        <option value="strict">Strict</option>
                        <option value="partial">Partial</option>
                      </select>
                    </div>
                  </div>
                  <div className="admin-modal-help">
                    <p className="admin-modal-help__title">Шаблон CSV для импорта предметов</p>
                    <p className="admin-modal-help__sample">{SUBJECT_IMPORT_TEMPLATE}</p>
                    <div className="admin-modal-help__actions">
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={() => downloadCsvTemplate('subjects-import-template.csv', SUBJECT_IMPORT_TEMPLATE)}
                      >
                        Скачать шаблон CSV
                      </Button>
                      <Button
                        type="button"
                        variant="warning"
                        size="small"
                        onClick={() => copyTemplate(SUBJECT_IMPORT_TEMPLATE)}
                      >
                        Скопировать шаблон
                      </Button>
                    </div>
                  </div>
                  {importPreview?.summary && (
                    <p className="subject-import-summary">
                      Всего: {importPreview.summary.totalRows} · валидных: {importPreview.summary.validRows} · ошибок: {importPreview.summary.errorRows}
                    </p>
                  )}
                </div>
              )}

              <div className="form-actions">
                {createMode === 'import' && (
                  <Button type="button" variant="secondary" onClick={handlePreviewImport} loading={importLoading}>
                    Проверить файл
                  </Button>
                )}
                <Button
                  type="button"
                  variant="primary"
                  onClick={createMode === 'manual' ? handleCreateManual : handleCommitImport}
                  loading={importLoading}
                >
                  {createMode === 'manual' ? 'Создать предметы' : 'Импортировать предметы'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <div className="subject-management__cards">
        {subjects.length === 0 ? (
          <Card className="subjects-table-container"><p>Предметы не найдены</p></Card>
        ) : (
          subjects.map((subject) => (
            <Card className="subject-card" key={subject.id} padding="small">
              <div className="subject-card__top">
                <h3>{subject.name}</h3>
                <Badge size="small" variant={subject.status === 'active' ? 'success' : 'secondary'}>
                  {subject.status === 'active' ? 'Активен' : 'Неактивен'}
                </Badge>
              </div>
              <p className="subject-card__meta">
                Назначений в нагрузке: {subject.teachingLoadsCount || 0}
              </p>
              <div className="subject-actions">
                <Button size="small" variant="secondary" onClick={() => handleEdit(subject)}>
                  Изменить
                </Button>
                <Button size="small" variant="danger" onClick={() => handleDelete(subject)}>
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
        fallbackCount={subjects.length}
        onPrev={() => setFilterState((prev) => prevAdminFilterPage(prev, paginationMeta.currentPage))}
        onNext={() => setFilterState((prev) => nextAdminFilterPage(prev, paginationMeta.currentPage))}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSubjectToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Удаление предмета"
        message={subjectToDelete ? `Вы уверены, что хотите удалить предмет "${subjectToDelete.name}"?` : ''}
        confirmText="Удалить"
        cancelText="Отмена"
        danger
      />
    </div>
  );
};

export default SubjectManagement;
