import React, { useEffect, useState } from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import Badge from '../../UI/Badge/Badge';
import Modal from '../../UI/Modal/Modal';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import FileDropzone from '../../UI/FileDropzone/FileDropzone';
import Pagination from '../../UI/Pagination/Pagination';
import { useNotification } from '../../../context/NotificationContext';
import './GroupManagement.scss';

const GROUP_NAME_REGEX = /^[А-ЯЁA-Z0-9-]+$/i;

const SINGLE_TEMPLATE = `login,email,last_name,first_name,middle_name,phone
ivanov01,ivanov@mail.ru,Иванов,Иван,Иванович,+7 (999) 123-45-67`;

const BATCH_TEMPLATE = `group_name,login,email,last_name,first_name,middle_name,phone
ИСП-401,ivanov01,ivanov@mail.ru,Иванов,Иван,Иванович,+7 (999) 123-45-67
ИСП-401,petrov01,petrov@mail.ru,Петров,Петр,Петрович,+7 (999) 234-56-78
ИСП-402,sidorov01,sidorov@mail.ru,Сидоров,Сидор,Сидорович,+7 (999) 345-67-89`;

const splitCsvRow = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const parseCsvText = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvRow);

const normalizeStudent = (cells = []) => ({
  login: String(cells[0] || '').trim(),
  email: String(cells[1] || '').trim(),
  lastName: String(cells[2] || '').trim(),
  firstName: String(cells[3] || '').trim(),
  middleName: String(cells[4] || '').trim(),
  phone: String(cells[5] || '').trim(),
});

const GroupManagement = ({
  groups = [],
  paginationMeta = {},
  query = {},
  onFetchGroups,
  onUpdateGroup,
  onDeleteGroup,
  onCreateGroupWithStudents,
  onBulkAttachStudents,
}) => {
  const { showSuccess, showError, showInfo } = useNotification();
  const [pendingGroupId, setPendingGroupId] = useState(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [manageGroupName, setManageGroupName] = useState('');
  const [manageGroupStatus, setManageGroupStatus] = useState('active');
  const [manageStudentsInput, setManageStudentsInput] = useState('');
  const [manageStudentsFile, setManageStudentsFile] = useState(null);
  const [filterState, setFilterState] = useState({
    search: '',
    status: 'all',
    sort: query.sort || 'name_asc',
    page: query.page || 1,
    perPage: query.perPage || 18,
  });
  const [groupToDelete, setGroupToDelete] = useState(null);

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [createMode, setCreateMode] = useState('single');
  const [singleGroupName, setSingleGroupName] = useState('');
  const [singleStudentsText, setSingleStudentsText] = useState('');
  const [singleStudentsFile, setSingleStudentsFile] = useState(null);
  const [batchText, setBatchText] = useState('');
  const [batchFile, setBatchFile] = useState(null);
  const [sendCredentials, setSendCredentials] = useState(true);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [batchPreview, setBatchPreview] = useState(null);

  const downloadTemplate = (filename, content) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyTemplate = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccess('Шаблон скопирован в буфер обмена');
    } catch {
      showError('Не удалось скопировать шаблон');
    }
  };

  useEffect(() => {
    onFetchGroups?.({
      search: filterState.search || undefined,
      status: filterState.status !== 'all' ? filterState.status : undefined,
      sort: filterState.sort,
      page: filterState.page,
      perPage: filterState.perPage,
    });
  }, [filterState, onFetchGroups]);

  const parseStudents = (text) => {
    const rows = parseCsvText(text);
    if (!rows.length) {
      return { students: [], errors: ['Добавьте хотя бы одну строку студентов.'] };
    }

    const headerLine = rows[0].map((cell) => cell.toLowerCase());
    const hasHeader = headerLine.includes('login') || headerLine.includes('email');
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const students = [];
    const errors = [];

    dataRows.forEach((cells, index) => {
      const student = normalizeStudent(cells);
      if (!student.login || !student.email || !student.lastName || !student.firstName) {
        errors.push(`Строка ${index + 1}: заполните login, email, фамилию и имя.`);
        return;
      }
      students.push(student);
    });

    if (!students.length && !errors.length) {
      errors.push('Не найдено валидных строк для создания студентов.');
    }

    return { students, errors };
  };

  const parseGroupedStudents = (text) => {
    const rows = parseCsvText(text);
    if (!rows.length) {
      return { grouped: [], errors: ['Добавьте строки в формате group_name,login,email,...'] };
    }

    const headerLine = rows[0].map((cell) => cell.toLowerCase());
    const hasHeader = headerLine.includes('group_name') || headerLine[0] === 'group';
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const groupsMap = new Map();
    const errors = [];

    dataRows.forEach((cells, index) => {
      const groupName = String(cells[0] || '').trim().toUpperCase();
      const student = normalizeStudent(cells.slice(1));

      if (!groupName) {
        errors.push(`Строка ${index + 1}: не указано название группы.`);
        return;
      }
      if (!GROUP_NAME_REGEX.test(groupName)) {
        errors.push(`Строка ${index + 1}: группа "${groupName}" в неверном формате.`);
        return;
      }
      if (!student.login || !student.email || !student.lastName || !student.firstName) {
        errors.push(`Строка ${index + 1}: заполните login, email, фамилию и имя студента.`);
        return;
      }

      if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, []);
      }
      groupsMap.get(groupName).push(student);
    });

    return {
      grouped: Array.from(groupsMap.entries()).map(([name, students]) => ({ name, students })),
      errors,
    };
  };

  const readInputSource = async (textValue, fileValue) => {
    if (fileValue) {
      return fileValue.text();
    }
    return textValue;
  };

  const handleCreateSingleGroup = async () => {
    const normalizedName = singleGroupName.trim().toUpperCase();
    if (!normalizedName) {
      showError('Введите название группы.');
      return;
    }
    if (!GROUP_NAME_REGEX.test(normalizedName)) {
      showError('Название группы: только буквы, цифры и дефис (например, ИСП-401).');
      return;
    }

    const sourceText = await readInputSource(singleStudentsText, singleStudentsFile);
    const parsed = parseStudents(sourceText);
    if (parsed.errors.length) {
      showError(parsed.errors[0]);
      return;
    }

    setWizardLoading(true);
    const result = await onCreateGroupWithStudents?.({
      name: normalizedName,
      status: 'active',
      sendCredentials,
      students: parsed.students,
    });
    setWizardLoading(false);

    if (!result?.success) {
      showError(result?.error || 'Не удалось создать группу со студентами.');
      return;
    }

    showSuccess(`Создана группа ${normalizedName}, добавлено студентов: ${parsed.students.length}.`);
    setShowCreateWizard(false);
    setSingleGroupName('');
    setSingleStudentsText('');
    setSingleStudentsFile(null);
  };

  const handlePreviewBatch = async () => {
    const sourceText = await readInputSource(batchText, batchFile);
    const parsed = parseGroupedStudents(sourceText);

    setBatchPreview({
      totalGroups: parsed.grouped.length,
      totalStudents: parsed.grouped.reduce((sum, group) => sum + group.students.length, 0),
      errors: parsed.errors,
      grouped: parsed.grouped,
    });

    if (parsed.errors.length) {
      showError(parsed.errors[0]);
      return;
    }
    showInfo(`К созданию: ${parsed.grouped.length} групп, ${parsed.grouped.reduce((sum, group) => sum + group.students.length, 0)} студентов.`);
  };

  const handleCreateBatch = async () => {
    const preview = batchPreview?.grouped?.length ? batchPreview : null;
    let parsedData = preview;
    if (!parsedData) {
      const sourceText = await readInputSource(batchText, batchFile);
      const groupedResult = parseGroupedStudents(sourceText || '');
      parsedData = {
        totalGroups: groupedResult.grouped.length,
        totalStudents: groupedResult.grouped.reduce((sum, group) => sum + group.students.length, 0),
        errors: groupedResult.errors,
        grouped: groupedResult.grouped,
      };
    }

    if (parsedData.errors.length) {
      showError(parsedData.errors[0]);
      return;
    }
    if (!parsedData.grouped.length) {
      showError('Нет валидных групп для создания.');
      return;
    }

    setWizardLoading(true);
    let createdGroups = 0;
    let createdStudents = 0;
    const failedGroups = [];

    for (const entry of parsedData.grouped) {
      // eslint-disable-next-line no-await-in-loop
      const result = await onCreateGroupWithStudents?.({
        name: entry.name,
        status: 'active',
        sendCredentials,
        students: entry.students,
      });

      if (result?.success) {
        createdGroups += 1;
        createdStudents += entry.students.length;
      } else {
        failedGroups.push(entry.name);
      }
    }

    setWizardLoading(false);

    if (createdGroups > 0) {
      showSuccess(`Создано групп: ${createdGroups}, студентов: ${createdStudents}.`);
    }
    if (failedGroups.length) {
      showError(`Не удалось создать группы: ${failedGroups.join(', ')}`);
      return;
    }

    setShowCreateWizard(false);
    setBatchText('');
    setBatchFile(null);
    setBatchPreview(null);
  };

  const handleOpenManageGroup = (group) => {
    setActiveGroup(group);
    setManageGroupName(group?.name || '');
    setManageGroupStatus(group?.status || 'active');
    setManageStudentsInput('');
    setManageStudentsFile(null);
    setShowManageModal(true);
  };

  const handleUpdateGroupSettings = async () => {
    if (!activeGroup?.id) {
      return;
    }

    const normalizedName = String(manageGroupName || '').trim().toUpperCase();
    if (!normalizedName) {
      showError('Введите название группы.');
      return;
    }
    if (!GROUP_NAME_REGEX.test(normalizedName)) {
      showError('Название группы: только буквы, цифры и дефис (например, ИСП-401).');
      return;
    }

    setManageLoading(true);
    const result = await onUpdateGroup?.(activeGroup.id, {
      name: normalizedName,
      status: manageGroupStatus,
    });
    setManageLoading(false);

    if (!result?.success) {
      showError(result?.error || 'Не удалось обновить группу.');
      return;
    }

    showSuccess('Параметры группы сохранены.');
    setActiveGroup((prev) => (
      prev
        ? {
            ...prev,
            name: normalizedName,
            status: manageGroupStatus,
          }
        : prev
    ));
    setManageGroupName(normalizedName);
  };

  const handleBulkAttach = async () => {
    if (!activeGroup) return;
    const sourceText = await readInputSource(manageStudentsInput, manageStudentsFile);
    const parsed = parseStudents(sourceText);
    if (parsed.errors.length) {
      showError(parsed.errors[0]);
      return;
    }

    const result = await onBulkAttachStudents?.(activeGroup.id, { students: parsed.students });
    if (!result?.success) {
      showError(result?.error || 'Не удалось добавить студентов.');
      return;
    }

    showSuccess('Студенты добавлены в группу.');
    setManageStudentsInput('');
    setManageStudentsFile(null);
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;

    setPendingGroupId(groupToDelete.id);
    const result = await onDeleteGroup?.(groupToDelete.id);
    setPendingGroupId(null);

    if (!result?.success) {
      showError(result?.error || 'Не удалось удалить группу');
      return;
    }

    setGroupToDelete(null);
    showSuccess('Группа удалена');
    if (activeGroup?.id === groupToDelete.id) {
      setShowManageModal(false);
      setActiveGroup(null);
      setManageGroupName('');
      setManageGroupStatus('active');
      setManageStudentsInput('');
      setManageStudentsFile(null);
    }
  };

  return (
    <div className="group-management">
      <div className="group-management__header">
        <div>
          <h2>Управление группами</h2>
          <p>Создавайте группы сразу со студентами: одной группой или массово.</p>
        </div>
        <div className="group-management__header-actions">
          <Button variant="primary" onClick={() => setShowCreateWizard(true)}>
            Создать группы и студентов
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        title="Создание групп и студентов"
        size="large"
        className="admin-form-modal"
      >
        <div className="group-wizard">
          <div className="group-wizard__modes">
            <Button
              variant={createMode === 'single' ? 'primary' : 'outline'}
              type="button"
              onClick={() => setCreateMode('single')}
            >
              Одна группа + студенты
            </Button>
            <Button
              variant={createMode === 'batch' ? 'primary' : 'outline'}
              type="button"
              onClick={() => setCreateMode('batch')}
            >
              Несколько групп + студенты
            </Button>
          </div>

          <div className="group-wizard__checkbox">
            <label>
              <input
                type="checkbox"
                checked={sendCredentials}
                onChange={(event) => setSendCredentials(event.target.checked)}
              />
              Отправлять студентам логин и временный пароль на email
            </label>
          </div>

          {createMode === 'single' ? (
            <div className="group-wizard__section">
              <div className="group-management__create-field">
                <label>Название группы</label>
                <input
                  type="text"
                  placeholder="Например, ИСП-401"
                  value={singleGroupName}
                  onChange={(event) => setSingleGroupName(event.target.value)}
                />
              </div>

              <div className="group-management__create-field">
                <label>Студенты (CSV)</label>
                <textarea
                  rows={6}
                  placeholder="Вставьте CSV-строки студентов"
                  value={singleStudentsText}
                  onChange={(event) => setSingleStudentsText(event.target.value)}
                />
                <div className="group-wizard__or">или загрузите CSV файл</div>
                <FileDropzone
                  accept=".csv,.txt"
                  selectedFiles={singleStudentsFile ? [singleStudentsFile] : []}
                  buttonText="Выбрать CSV файл"
                  onFilesSelected={(files) => setSingleStudentsFile(files[0] || null)}
                />
              </div>

              <div className="admin-modal-help">
                <p className="admin-modal-help__title">Шаблон для студентов</p>
                <p className="admin-modal-help__sample">{SINGLE_TEMPLATE}</p>
                <div className="admin-modal-help__actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={() => downloadTemplate('group-single-template.csv', SINGLE_TEMPLATE)}
                  >
                    Скачать шаблон CSV
                  </Button>
                  <Button
                    type="button"
                    variant="warning"
                    size="small"
                    onClick={() => copyTemplate(SINGLE_TEMPLATE)}
                  >
                    Скопировать шаблон
                  </Button>
                </div>
              </div>

              <div className="group-wizard__actions">
                <Button type="button" variant="primary" loading={wizardLoading} onClick={handleCreateSingleGroup}>
                  Создать группу со студентами
                </Button>
              </div>
            </div>
          ) : (
            <div className="group-wizard__section">
              <div className="group-management__create-field">
                <label>CSV для нескольких групп и студентов</label>
                <textarea
                  rows={8}
                  placeholder="Вставьте строки формата group_name,login,email,..."
                  value={batchText}
                  onChange={(event) => setBatchText(event.target.value)}
                />
                <div className="group-wizard__or">или загрузите CSV файл</div>
                <FileDropzone
                  accept=".csv,.txt"
                  selectedFiles={batchFile ? [batchFile] : []}
                  buttonText="Выбрать CSV файл"
                  onFilesSelected={(files) => {
                    setBatchFile(files[0] || null);
                    setBatchPreview(null);
                  }}
                />
              </div>

              <div className="admin-modal-help">
                <p className="admin-modal-help__title">Шаблон для массового создания</p>
                <p className="admin-modal-help__sample">{BATCH_TEMPLATE}</p>
                <div className="admin-modal-help__actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={() => downloadTemplate('groups-batch-template.csv', BATCH_TEMPLATE)}
                  >
                    Скачать шаблон CSV
                  </Button>
                  <Button
                    type="button"
                    variant="warning"
                    size="small"
                    onClick={() => copyTemplate(BATCH_TEMPLATE)}
                  >
                    Скопировать шаблон
                  </Button>
                </div>
              </div>

              <div className="group-wizard__actions">
                <Button type="button" variant="secondary" onClick={handlePreviewBatch}>
                  Проверить файл
                </Button>
                <Button type="button" variant="primary" loading={wizardLoading} onClick={handleCreateBatch}>
                  Создать группы
                </Button>
              </div>

              {batchPreview && (
                <div className="group-wizard__preview">
                  <p>
                    Групп: {batchPreview.totalGroups} · Студентов: {batchPreview.totalStudents}
                  </p>
                  {batchPreview.errors?.length > 0 && (
                    <ul>
                      {batchPreview.errors.slice(0, 6).map((error, index) => (
                        <li key={`batch-error-${index + 1}`}>{error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Card className="group-management__bulk-card">
        <div className="group-management__bulk-controls">
          <div className="group-management__search">
            <label>Поиск группы</label>
            <input
              type="text"
              value={filterState.search}
              onChange={(event) => setFilterState((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
              placeholder="По названию группы"
            />
          </div>
          <div className="group-management__sort">
            <label>Статус</label>
            <select
              value={filterState.status}
              onChange={(event) => setFilterState((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
          </div>
          <div className="group-management__sort">
            <label>Сортировка</label>
            <select value={filterState.sort} onChange={(event) => setFilterState((prev) => ({ ...prev, sort: event.target.value, page: 1 }))}>
              <option value="name_asc">Название (А-Я)</option>
              <option value="name_desc">Название (Я-А)</option>
              <option value="students_desc">Больше студентов</option>
              <option value="students_asc">Меньше студентов</option>
            </select>
          </div>
          <div className="group-management__filter-action">
            <label>Действия</label>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setFilterState((prev) => ({
                  ...prev,
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

      <div className="group-management__cards">
        {groups.length === 0 ? (
          <Card><p>Группы не найдены</p></Card>
        ) : (
          groups.map((group) => (
            <Card className="group-card" key={group.id} padding="small">
              <div className="group-card__top">
                <h3>{group.name}</h3>
                <Badge size="small" variant={group.status === 'active' ? 'success' : 'secondary'}>
                  {group.status === 'active' ? 'Активна' : 'Неактивна'}
                </Badge>
              </div>
              <p className="group-card__meta">Студентов: {group.studentsCount || 0}</p>
              <div className="group-card__actions">
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => handleOpenManageGroup(group)}
                >
                  Изменить
                </Button>
                <Button
                  size="small"
                  variant="danger"
                  onClick={() => setGroupToDelete(group)}
                  disabled={pendingGroupId !== null && pendingGroupId !== group.id}
                >
                  Удалить
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Pagination
        className="group-management__pagination"
        currentPage={paginationMeta.currentPage}
        lastPage={paginationMeta.lastPage}
        total={paginationMeta.total}
        fallbackCount={groups.length}
        onPrev={() => setFilterState((prev) => ({ ...prev, page: Math.max(1, (paginationMeta.currentPage || 1) - 1) }))}
        onNext={() => setFilterState((prev) => ({ ...prev, page: (paginationMeta.currentPage || 1) + 1 }))}
      />

      <Modal
        isOpen={showManageModal}
        onClose={() => {
          setShowManageModal(false);
          setActiveGroup(null);
          setManageGroupName('');
          setManageGroupStatus('active');
          setManageStudentsInput('');
          setManageStudentsFile(null);
        }}
        title="Управление группой"
        size="large"
        className="admin-form-modal"
      >
        <div className="group-management__manage group-management__create-card--modal">
          <div className="group-management__manage-grid">
            <div className="group-management__create-field">
              <label>Название группы</label>
              <input
                type="text"
                value={manageGroupName}
                onChange={(event) => setManageGroupName(event.target.value)}
                placeholder="Например, ИСП-401"
              />
            </div>
            <div className="group-management__create-field">
              <label>Статус</label>
              <select
                value={manageGroupStatus}
                onChange={(event) => setManageGroupStatus(event.target.value)}
              >
                <option value="active">Активна</option>
                <option value="inactive">Неактивна</option>
              </select>
            </div>
          </div>
          <div className="group-management__metric" aria-label="Всего студентов">
            <span className="group-management__metric-label">Всего студентов</span>
            <strong className="group-management__metric-value">{String(activeGroup?.studentsCount || 0)}</strong>
          </div>
          <div className="group-management__create-field">
            <label>Добавить студентов (login,email,last_name,first_name,middle_name,phone)</label>
            <textarea
              rows={6}
              value={manageStudentsInput}
              onChange={(event) => setManageStudentsInput(event.target.value)}
              placeholder="petrov01,petrov@mail.ru,Петров,Петр,Петрович,+7..."
            />
            <div className="group-wizard__or">или загрузите CSV файл</div>
            <FileDropzone
              accept=".csv,.txt"
              selectedFiles={manageStudentsFile ? [manageStudentsFile] : []}
              buttonText="Выбрать CSV файл"
              onFilesSelected={(files) => setManageStudentsFile(files[0] || null)}
            />
          </div>
          <div className="admin-modal-help">
            <p className="admin-modal-help__title">Шаблон для добавления студентов</p>
            <p className="admin-modal-help__sample">{SINGLE_TEMPLATE}</p>
            <div className="admin-modal-help__actions">
              <Button type="button" variant="secondary" size="small" onClick={() => downloadTemplate('group-students-template.csv', SINGLE_TEMPLATE)}>
                Скачать шаблон CSV
              </Button>
              <Button type="button" variant="warning" size="small" onClick={() => copyTemplate(SINGLE_TEMPLATE)}>
                Скопировать шаблон
              </Button>
            </div>
          </div>
          <div className="group-management__manage-actions">
            <Button variant="success" onClick={handleUpdateGroupSettings} loading={manageLoading}>
              Сохранить группу
            </Button>
            <Button variant="primary" onClick={handleBulkAttach}>
              Добавить студентов
            </Button>
            <Button
              variant="danger"
              onClick={() => activeGroup && setGroupToDelete(activeGroup)}
              disabled={(pendingGroupId !== null && pendingGroupId !== activeGroup?.id) || !activeGroup}
            >
              Удалить группу
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(groupToDelete)}
        onClose={() => setGroupToDelete(null)}
        onConfirm={handleDeleteGroup}
        title="Удаление группы"
        message={groupToDelete ? `Удалить группу ${groupToDelete.name}?` : ''}
        confirmText="Удалить"
        cancelText="Отмена"
        danger
      />
    </div>
  );
};

export default GroupManagement;
