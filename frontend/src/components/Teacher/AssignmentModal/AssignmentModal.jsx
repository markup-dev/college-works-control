import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Button from '../../UI/Button/Button';
import FileDropzone from '../../UI/FileDropzone/FileDropzone';
import Modal from '../../UI/Modal/Modal';
import { useNotification } from '../../../context/NotificationContext';
import { DEFAULT_ALLOWED_FORMATS, normalizeAllowedFormats } from '../../../utils';
import { resolveAssignmentSubjectId, resolveAssignmentSubjectName } from '../../../utils/filterHelpers';
import './AssignmentModal.scss';

const MAX_MATERIAL_FILES = 10;

const normalizeCriterionPointsInput = (value) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');

  if (!digitsOnly) {
    return '';
  }

  return String(Math.min(100, Math.max(1, Number(digitsOnly))));
};

const normalizeCriteriaForForm = (criteria = []) => {
  if (!Array.isArray(criteria)) {
    return [];
  }

  return criteria.map((criterion) => {
    if (typeof criterion === 'string') {
      return { text: criterion, maxPoints: '' };
    }

    return {
      ...criterion,
      text: criterion?.text || '',
      maxPoints: Number(criterion?.maxPoints) > 0 ? criterion.maxPoints : '',
    };
  });
};

const normalizeMaterialFiles = (materials = []) => {
  if (!Array.isArray(materials)) {
    return [];
  }

  return materials
    .map((material) => ({
      id: material?.id,
      fileName: material?.fileName || material?.file_name || '',
      fileSize: material?.fileSize || material?.file_size || '',
    }))
    .filter((material) => material.id && material.fileName);
};

const normalizeSubjectOptions = (subjects = []) => {
  if (!Array.isArray(subjects)) {
    return [];
  }

  return subjects
    .map((subject) => ({
      id: Number(subject?.id),
      name: String(subject?.name || '').trim(),
    }))
    .filter((subject) => Number.isFinite(subject.id) && subject.id > 0 && subject.name)
    .filter((subject, index, array) => array.findIndex((item) => item.id === subject.id) === index);
};

const normalizeGroupSelection = (value) => {
  const normalizeSingleGroup = (group) => (
    (group || '')
      .toString()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[—–−]/g, '-')
      .toUpperCase()
  );

  if (Array.isArray(value)) {
    return value
      .map((group) => normalizeSingleGroup(group))
      .filter(Boolean)
      .filter((group, index, array) => array.indexOf(group) === index);
  }

  const singleGroup = normalizeSingleGroup(value);
  return singleGroup ? [singleGroup] : [];
};

const buildEmptyFormData = () => ({
  title: '',
  subjectId: null,
  subject: '',
  studentGroups: [],
  deadline: '',
  description: '',
  maxScore: 100,
  submissionType: 'file',
  criteria: [],
  allowedFormats: [...DEFAULT_ALLOWED_FORMATS],
  materialFiles: [],
  existingMaterials: [],
  removedMaterialIds: []
});

const AssignmentModal = ({ 
  assignment, 
  isOpen, 
  onClose,
  onBack,
  onSubmit,
  availableGroups = [],
  availableSubjects = [],
  initialFormData = null,
  modalMode = 'default',
}) => {
  const { showError } = useNotification();
  const [acceptAllFormats, setAcceptAllFormats] = useState(true);
  const [formData, setFormData] = useState(() => buildEmptyFormData());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGroupsDropdownOpen, setIsGroupsDropdownOpen] = useState(false);
  const wasOpenRef = useRef(false);
  const groupsDropdownRef = useRef(null);

  const subjectOptions = useMemo(() => {
    const normalized = normalizeSubjectOptions(availableSubjects);
    if (formData.subjectId && formData.subject) {
      const alreadyExists = normalized.some((subject) => subject.id === Number(formData.subjectId));
      if (!alreadyExists) {
        normalized.push({ id: Number(formData.subjectId), name: formData.subject });
      }
    }
    return normalized.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [availableSubjects, formData.subjectId, formData.subject]);

  const groupOptions = useMemo(() => {
    const uniqueGroups = new Set(availableGroups.filter(Boolean));
    normalizeGroupSelection(formData.studentGroups).forEach((group) => uniqueGroups.add(group));
    return Array.from(uniqueGroups);
  }, [availableGroups, formData.studentGroups]);

  const createInitialFormData = useCallback(() => {
    if (assignment && initialFormData) {
      return {
        ...buildEmptyFormData(),
        ...initialFormData,
        subjectId: initialFormData.subjectId ?? null,
        subject: initialFormData.subject ?? '',
        studentGroups: normalizeGroupSelection(initialFormData.studentGroups ?? initialFormData.group),
        criteria: normalizeCriteriaForForm(initialFormData.criteria),
        materialFiles: Array.isArray(initialFormData.materialFiles) ? initialFormData.materialFiles : [],
        existingMaterials: Array.isArray(initialFormData.existingMaterials) ? initialFormData.existingMaterials : [],
        removedMaterialIds: Array.isArray(initialFormData.removedMaterialIds) ? initialFormData.removedMaterialIds : [],
      };
    }

    if (assignment) {
      const criteria = normalizeCriteriaForForm(assignment.criteria);

      const base = {
        ...buildEmptyFormData(),
        title: assignment.title || '',
        subjectId: resolveAssignmentSubjectId(assignment),
        subject: resolveAssignmentSubjectName(assignment),
        studentGroups: normalizeGroupSelection(
          Array.isArray(assignment.studentGroups) && assignment.studentGroups.length > 0
            ? assignment.studentGroups
            : assignment.group
        ),
        deadline: assignment.deadline ? assignment.deadline.split('T')[0] : '',
        description: assignment.description || '',
        maxScore: assignment.maxScore || 100,
        submissionType: assignment.submissionType || 'file',
        criteria,
        allowedFormats: normalizeAllowedFormats(assignment.allowedFormats || assignment.allowedFormatItems?.map((item) => item?.format) || []),
        materialFiles: [],
        existingMaterials: normalizeMaterialFiles(assignment.materialFiles || assignment.materialItems || []),
        removedMaterialIds: [],
      };

      if (modalMode === 'bankTemplate') {
        base.studentGroups = [];
        base.deadline = '';
      }

      return base;
    }

    return buildEmptyFormData();
  }, [assignment, initialFormData, modalMode]);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      setIsGroupsDropdownOpen(false);
      setIsSubmitting(false);
      return;
    }

    if (wasOpenRef.current) {
      return;
    }

    wasOpenRef.current = true;
    setFormData(createInitialFormData());
  }, [isOpen, createInitialFormData]);

  useEffect(() => {
    if (!isGroupsDropdownOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!groupsDropdownRef.current?.contains(event.target)) {
        setIsGroupsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isGroupsDropdownOpen]);

  useEffect(() => {
    const selectedFormats = normalizeAllowedFormats(formData.allowedFormats);
    const hasAllFormats = DEFAULT_ALLOWED_FORMATS.every((format) => selectedFormats.includes(format));
    setAcceptAllFormats(hasAllFormats);
  }, [formData.allowedFormats]);

  if (!isOpen) return null;

  const isBankTemplateEdit = modalMode === 'bankTemplate';
  const isEdit = !!assignment;
  const criteriaCount = Array.isArray(formData.criteria) ? formData.criteria.length : 0;
  const criteriaPointsTotal = Array.isArray(formData.criteria)
    ? formData.criteria.reduce((sum, criterion) => sum + (Number(criterion?.maxPoints) || 0), 0)
    : 0;
  const totalMaterialsCount = (formData.existingMaterials?.length || 0) + (formData.materialFiles?.length || 0);
  const materialSlotsLeft = Math.max(0, MAX_MATERIAL_FILES - totalMaterialsCount);
  const hasNoAssignableGroups = !isEdit && groupOptions.length === 0;
  const hasNoAssignableSubjects = !isEdit && subjectOptions.length === 0;
  const selectedGroups = normalizeGroupSelection(formData.studentGroups);
  const selectedGroupsSummary = selectedGroups.length === 0
    ? 'Выберите группы'
    : selectedGroups.length <= 2
      ? selectedGroups.join(', ')
      : `Выбрано групп: ${selectedGroups.length}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (modalMode !== 'bankTemplate' && !isEdit && groupOptions.length === 0) {
      showError('Невозможно создать задание без назначенной учебной группы');
      return;
    }

    if (!formData.subjectId) {
      showError('Выберите предмет из назначенных');
      return;
    }
    
    const trimmedFormData = {
      ...formData,
      title: formData.title?.trim() || '',
      subject: formData.subject?.trim() || '',
      description: formData.description?.trim() || ''
    };

    let validation;
    if (modalMode === 'bankTemplate') {
      const { validateBankTemplateForm } = require('../../../utils/validation');
      validation = validateBankTemplateForm({
        ...trimmedFormData,
        subjectId: formData.subjectId,
      });
    } else {
      const { validateAssignmentForm } = require('../../../utils/validation');
      validation = validateAssignmentForm({
      ...trimmedFormData,
      studentGroups: normalizeGroupSelection(formData.studentGroups)
    });
    }
    
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      showError(firstError);
      return;
    }

    const studentGroups = normalizeGroupSelection(formData.studentGroups);
    
    const criteriaArray = formData.criteria
      .map(criterion => {
        if (typeof criterion === 'string') {
          return { text: criterion.trim(), maxPoints: 1 };
        }
        return {
          text: (criterion.text || '').trim(),
          maxPoints: parseInt(criterion.maxPoints) || 0,
        };
      })
      .filter(c => c.text);

    const allowedFormats = formData.submissionType === 'file'
      ? normalizeAllowedFormats(formData.allowedFormats)
      : [];

    const submissionData = modalMode === 'bankTemplate'
      ? {
          ...trimmedFormData,
          subjectId: Number(formData.subjectId),
          maxScore: 100,
          criteria: criteriaArray,
          allowedFormats,
          materialFiles: formData.materialFiles || [],
          removedMaterialIds: formData.removedMaterialIds || [],
        }
      : {
      ...trimmedFormData,
      subjectId: Number(formData.subjectId),
      deadline: `${trimmedFormData.deadline}T23:59:00`,
      maxScore: 100,
      studentGroups: studentGroups,
      criteria: criteriaArray,
      allowedFormats,
      materialFiles: formData.materialFiles || [],
      removedMaterialIds: formData.removedMaterialIds || []
    };

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        const maybePromise = onSubmit(submissionData);
        if (maybePromise && typeof maybePromise.then === 'function') {
          await maybePromise;
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      onClose();
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleToggleGroup = (groupName) => {
    setFormData((prev) => {
      const currentGroups = normalizeGroupSelection(prev.studentGroups);
      const isSelected = currentGroups.includes(groupName);
      const nextGroups = isSelected
        ? currentGroups.filter((group) => group !== groupName)
        : [...currentGroups, groupName];

      return {
        ...prev,
        studentGroups: nextGroups,
      };
    });
  };

  const handleSelectAllGroups = () => {
    handleInputChange('studentGroups', [...groupOptions]);
  };

  const handleClearGroups = () => {
    handleInputChange('studentGroups', []);
  };

  const addCriterion = () => {
    setFormData(prev => ({
      ...prev,
      criteria: [...prev.criteria, { text: '', maxPoints: 1 }]
    }));
  };

  const updateCriterion = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.map((criterion, i) => 
        i === index
          ? { ...criterion, [field]: field === 'maxPoints' ? normalizeCriterionPointsInput(value) : value }
          : criterion
      )
    }));
  };

  const removeCriterion = (index) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index)
    }));
  };

  const toggleAllowedFormat = (format) => {
    setFormData((prev) => {
      const current = normalizeAllowedFormats(prev.allowedFormats);
      const isSelected = current.includes(format);
      const next = isSelected
        ? current.filter((item) => item !== format)
        : [...current, format];

      return {
        ...prev,
        allowedFormats: next.length > 0 ? next : [...DEFAULT_ALLOWED_FORMATS]
      };
    });
  };

  const handleAcceptAllFormatsToggle = (enabled) => {
    setAcceptAllFormats(enabled);
    setFormData((prev) => ({
      ...prev,
      allowedFormats: enabled ? [...DEFAULT_ALLOWED_FORMATS] : prev.allowedFormats
    }));
  };

  const handleMaterialFileSelect = (selected = []) => {
    if (selected.length === 0) {
      return;
    }

    setFormData((prev) => {
      const alreadySelected = Array.isArray(prev.materialFiles) ? prev.materialFiles : [];
      const existingSignatures = new Set(
        alreadySelected.map((file) => `${file.name}::${file.size}::${file.lastModified || 0}`)
      );

      const deduplicatedSelected = selected.filter((file) => {
        const signature = `${file.name}::${file.size}::${file.lastModified || 0}`;
        if (existingSignatures.has(signature)) {
          return false;
        }
        existingSignatures.add(signature);
        return true;
      });

      const remainingSlots = Math.max(0, MAX_MATERIAL_FILES - prev.existingMaterials.length - alreadySelected.length);
      const filesToAdd = deduplicatedSelected.slice(0, remainingSlots);

      if (filesToAdd.length < deduplicatedSelected.length) {
        showError(`Можно прикрепить максимум ${MAX_MATERIAL_FILES} материалов к заданию.`);
      }

      return {
        ...prev,
        materialFiles: [...alreadySelected, ...filesToAdd]
      };
    });

  };

  const removeNewMaterial = (fileIndex) => {
    setFormData((prev) => ({
      ...prev,
      materialFiles: prev.materialFiles.filter((_, index) => index !== fileIndex)
    }));
  };

  const removeExistingMaterial = (materialId) => {
    setFormData((prev) => ({
      ...prev,
      existingMaterials: prev.existingMaterials.filter((material) => material.id !== materialId),
      removedMaterialIds: prev.removedMaterialIds.includes(materialId)
        ? prev.removedMaterialIds
        : [...prev.removedMaterialIds, materialId]
    }));
  };

  const modalTitle = isBankTemplateEdit
    ? 'Заготовка в банке заданий'
    : isEdit
      ? 'Редактирование задания'
      : 'Создание нового задания';
  const modalSubtitle = isBankTemplateEdit
    ? 'Изменения сохраняются только для банка и не затрагивают уже выданные задания.'
    : isEdit
      ? 'Обновите параметры, материалы и критерии оценки'
      : 'Заполните основные поля и настройте формат сдачи';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      size="large"
      className="teacher-assignment-modal"
      contentClassName="teacher-assignment-modal__body"
      footer={(
        <div className="teacher-assignment-modal__actions">
          {isEdit && typeof onBack === 'function' && (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onBack(formData)}
            >
              <span className="back-btn-label">
                <span className="back-btn-arrow" aria-hidden="true">←</span>
                Назад
              </span>
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button
            type="submit"
            form="teacher-assignment-form"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting || hasNoAssignableGroups || hasNoAssignableSubjects}
          >
            {isSubmitting
              ? (isBankTemplateEdit || isEdit ? 'Сохранение…' : 'Создание…')
              : (isBankTemplateEdit
                  ? 'Сохранить заготовку'
                  : isEdit
                    ? 'Сохранить изменения'
                    : 'Создать задание')}
          </Button>
        </div>
      )}
    >
        <form id="teacher-assignment-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
            <div className="assignment-quick-stats">
              <span className="assignment-quick-stats__item">
                Критериев: <strong>{criteriaCount}</strong>
              </span>
              <span className="assignment-quick-stats__item">
                Материалов: <strong>{totalMaterialsCount}/{MAX_MATERIAL_FILES}</strong>
              </span>
              <span className="assignment-quick-stats__item">
                Формат сдачи: <strong>{formData.submissionType === 'demo' ? 'Демонстрация' : 'Файл'}</strong>
              </span>
            </div>

            {hasNoAssignableGroups && modalMode !== 'bankTemplate' && (
              <div className="assignment-modal-warning">
                Для вашего аккаунта пока не назначены учебные группы. Обратитесь к администратору, чтобы он
                назначил группу во вкладке "Группы".
              </div>
            )}
            {hasNoAssignableSubjects && (
              <div className="assignment-modal-warning">
                Для вашего аккаунта пока не назначены предметы. Обратитесь к администратору, чтобы он назначил
                вам предмет в управлении предметами.
              </div>
            )}

            <div className="create-assignment-form">
              <div className="form-section">
                <h4>Основная информация</h4>
                <div className="form-row">
                  <FormGroup 
                    label="Название задания:" 
                    required
                  >
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      placeholder="Введите название задания..."
                      className="teacher-assignment-modal__input"
                      required
                    />
                  </FormGroup>
                  
                  <FormGroup label="Предмет:" required>
                    <select
                      value={formData.subjectId || ''}
                      onChange={(e) => {
                        const selectedId = Number(e.target.value) || null;
                        const selectedSubject = subjectOptions.find((subject) => subject.id === selectedId);
                        setFormData((prev) => ({
                          ...prev,
                          subjectId: selectedId,
                          subject: selectedSubject?.name || '',
                        }));
                      }}
                      className="teacher-assignment-modal__select"
                      required
                    >
                      <option value="">Выберите предмет</option>
                      {subjectOptions.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </FormGroup>
                </div>
                
                {modalMode !== 'bankTemplate' && (
                <div className="form-row">
                  <FormGroup label="Учебная группа:" required>
                    {groupOptions.length > 0 ? (
                      <div className="group-dropdown" ref={groupsDropdownRef}>
                        <button
                          type="button"
                          className={`group-dropdown__trigger ${isGroupsDropdownOpen ? 'is-open' : ''}`}
                          onClick={() => setIsGroupsDropdownOpen((prev) => !prev)}
                        >
                          <span className="group-dropdown__trigger-label">{selectedGroupsSummary}</span>
                          <span className="group-dropdown__trigger-arrow" aria-hidden="true">▾</span>
                        </button>
                        {isGroupsDropdownOpen && (
                          <div className="group-dropdown__menu">
                            <div className="group-dropdown__actions">
                              <button type="button" onClick={handleSelectAllGroups}>Выбрать все</button>
                              <button type="button" onClick={handleClearGroups}>Очистить</button>
                            </div>
                            <div className="group-dropdown__list">
                              {groupOptions.map((group) => {
                                const checked = selectedGroups.includes(group);
                                return (
                                  <label key={group} className={`group-checkbox-item ${checked ? 'group-checkbox-item--checked' : ''}`}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => handleToggleGroup(group)}
                                    />
                                    <span>{group}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="group-checkbox-empty">Нет назначенных групп</div>
                    )}
                    <small className="teacher-assignment-modal__hint">Откройте список и отметьте нужные группы.</small>
                  </FormGroup>
                  
                  <FormGroup label="Срок сдачи:" required>
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => handleInputChange('deadline', e.target.value)}
                      className="teacher-assignment-modal__input"
                      required
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </FormGroup>
                </div>
                )}
              </div>

              <div className="form-section">
                <h4>Описание задания</h4>
                <FormGroup label="Подробное описание:" required>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Опишите задание, требования, ожидаемый результат..."
                    className="teacher-assignment-modal__textarea"
                    rows="4"
                    required
                  />
                </FormGroup>
              </div>

              <div className="form-section">
                <h4>Материалы к заданию</h4>
                <FormGroup label="Дополнительные материалы (методички, шаблоны, примеры):">
                  <div className="assignment-materials">
                    <p className="assignment-materials__hint">
                      Прикрепите файлы, чтобы студентам было проще понять требования и формат выполнения.
                      Можно добавить еще {materialSlotsLeft}.
                    </p>
                    <FileDropzone
                      multiple
                      buttonText="Добавить файлы"
                      hint="Можно выбрать несколько файлов или перетащить их в область загрузки."
                      selectedFiles={formData.materialFiles}
                      onFilesSelected={handleMaterialFileSelect}
                    />

                    {formData.existingMaterials.length > 0 && (
                      <div className="assignment-materials__list">
                        {formData.existingMaterials.map((material) => (
                          <div className="assignment-materials__item" key={`existing-${material.id}`}>
                            <div className="assignment-materials__info">
                              <span className="assignment-materials__name">{material.fileName}</span>
                              {material.fileSize && (
                                <span className="assignment-materials__size">{material.fileSize}</span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="small"
                              onClick={() => removeExistingMaterial(material.id)}
                            >
                              Убрать
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {formData.materialFiles.length > 0 && (
                      <div className="assignment-materials__list">
                        {formData.materialFiles.map((file, index) => (
                          <div className="assignment-materials__item" key={`new-${file.name}-${index}`}>
                            <div className="assignment-materials__info">
                              <span className="assignment-materials__name">{file.name}</span>
                              <span className="assignment-materials__size">
                                {Math.round((file.size / 1024) * 10) / 10} KB
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="small"
                              onClick={() => removeNewMaterial(index)}
                            >
                              Убрать
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </FormGroup>
              </div>

              <div className="form-section">
                <h4>Параметры оценки</h4>
                <p className="form-section__hint">
                  Максимальный балл за каждое задание фиксированный: 100. Перевод в пятибалльную оценку настраивается в профиле преподавателя.
                </p>

                <div className="form-row">
                  <FormGroup label="Формат сдачи:" required>
                    <select
                      value={formData.submissionType}
                      onChange={(e) => handleInputChange('submissionType', e.target.value)}
                      className="teacher-assignment-modal__select"
                    >
                      <option value="file">Файл</option>
                      <option value="demo">Демонстрация</option>
                    </select>
                  </FormGroup>
                </div>

                {formData.submissionType === 'file' && (
                  <FormGroup label="Допустимые форматы файлов:">
                    <label className="allowed-formats__toggle">
                      <input
                        type="checkbox"
                        checked={acceptAllFormats}
                        onChange={(e) => handleAcceptAllFormatsToggle(e.target.checked)}
                      />
                      <span className="allowed-formats__toggle-text">
                        Принимать любые форматы
                      </span>
                    </label>
                    <div className="allowed-formats">
                      {DEFAULT_ALLOWED_FORMATS.map((format) => (
                        <label key={format} className="allowed-formats__item">
                          <input
                            type="checkbox"
                            checked={normalizeAllowedFormats(formData.allowedFormats).includes(format)}
                            onChange={() => toggleAllowedFormat(format)}
                            disabled={acceptAllFormats}
                          />
                          <span>{format}</span>
                        </label>
                      ))}
                    </div>
                    <small className="allowed-formats__hint">
                      По умолчанию выбраны все форматы. Оставьте как есть, если требуется принимать все.
                    </small>
                  </FormGroup>
                )}
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h4>
                    Критерии оценки
                    <span className="section-counter">{criteriaCount}</span>
                  </h4>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="small"
                    onClick={addCriterion}
                  >
                    + Добавить критерий
                  </Button>
                </div>
                {criteriaCount > 0 && (
                  <p className={`criteria-total ${criteriaPointsTotal === 100 ? 'criteria-total--valid' : 'criteria-total--invalid'}`}>
                    Сумма критериев: {criteriaPointsTotal}/100
                  </p>
                )}
                
                <div className="criteria-list">
                  {formData.criteria.map((criterion, index) => (
                    <CriterionItem
                      key={index}
                      criterion={criterion}
                      index={index}
                      onUpdate={updateCriterion}
                      onRemove={removeCriterion}
                    />
                  ))}
                  
                  {formData.criteria.length === 0 && (
                    <div className="no-criteria">
                      <p>Критерии оценки не добавлены</p>
                      <small>Добавьте критерии для более объективной оценки работ</small>
                    </div>
                  )}
                </div>
              </div>
            </div>
        </form>
    </Modal>
  );
};

const FormGroup = ({ label, children, required = false }) => (
  <div className="teacher-assignment-modal__field">
    <label>
      {label}
      {required && <span className="required">*</span>}
    </label>
    {children}
  </div>
);

const CriterionItem = ({ criterion, index, onUpdate, onRemove }) => (
  <div className="criterion-item">
    <div className="criterion-content">
      <input
        type="text"
        value={criterion.text}
        onChange={(e) => onUpdate(index, 'text', e.target.value)}
        placeholder="Описание критерия..."
        className="criterion-text"
      />
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={criterion.maxPoints}
        onChange={(e) => onUpdate(index, 'maxPoints', parseInt(e.target.value) || 0)}
        onBlur={(e) => {
          if (!String(e.target.value || '').trim()) {
            onUpdate(index, 'maxPoints', 1);
          }
        }}
        placeholder="1"
        className="criterion-points"
      />
      <span className="points-label">баллов</span>
    </div>
    <Button
      type="button"
      variant="outline"
      size="small"
      onClick={() => onRemove(index)}
    >
      Удалить
    </Button>
  </div>
);

export default AssignmentModal;