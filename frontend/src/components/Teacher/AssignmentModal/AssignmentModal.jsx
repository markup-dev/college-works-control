import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Button from '../../UI/Button/Button';
import { useNotification } from '../../../context/NotificationContext';
import './AssignmentModal.scss';

const AssignmentModal = ({ 
  assignment, 
  isOpen, 
  onClose,
  onSubmit,
  availableGroups = []
}) => {
  const { showError } = useNotification();
  const [formData, setFormData] = useState(() => ({
    title: '',
    course: 'Базы данных',
    group: availableGroups[0] || 'ИСП-029',
    deadline: '',
    description: '',
    maxScore: 100,
    submissionType: 'file',
    criteria: []
  }));

  const getDefaultGroup = useCallback(() => {
    if (assignment?.studentGroups?.length) {
      return assignment.studentGroups[0];
    }
    if (assignment?.group) {
      return assignment.group;
    }
    return availableGroups[0] || 'ИСП-029';
  }, [assignment, availableGroups]);

  const groupOptions = useMemo(() => {
    const uniqueGroups = new Set(availableGroups.filter(Boolean));
    if (formData.group && formData.group !== 'Все группы') {
      uniqueGroups.add(formData.group);
    }
    return Array.from(uniqueGroups);
  }, [availableGroups, formData.group]);

  useEffect(() => {
    if (assignment) {
      const criteria = (assignment.criteria || []).map(criterion => {
        if (typeof criterion === 'string') {
          return { text: criterion, maxPoints: 0 };
        }
        return criterion;
      });
      
      const group = getDefaultGroup();

      setFormData({
        title: assignment.title || '',
        course: assignment.course || 'Базы данных',
        group: group,
        deadline: assignment.deadline ? assignment.deadline.split('T')[0] : '',
        description: assignment.description || '',
        maxScore: assignment.maxScore || 100,
        submissionType: assignment.submissionType || 'file',
        criteria: criteria,
        priority: assignment.priority || 'medium'
      });
    } else {
      setFormData({
        title: '',
        course: 'Базы данных',
        group: availableGroups[0] || 'ИСП-029',
        deadline: '',
        description: '',
        maxScore: 100,
        submissionType: 'file',
        criteria: [],
        priority: 'medium'
      });
    }
  }, [assignment, isOpen, availableGroups, getDefaultGroup]);

  if (!isOpen) return null;

  const isEdit = !!assignment;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const trimmedFormData = {
      ...formData,
      title: formData.title?.trim() || '',
      course: formData.course?.trim() || '',
      description: formData.description?.trim() || ''
    };

    const { validateAssignmentForm } = require('../../../utils/validation');
    const validation = validateAssignmentForm({
      ...trimmedFormData,
      studentGroups: formData.group && formData.group !== 'Все группы' 
        ? [formData.group.trim()] 
        : []
    });
    
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      showError(firstError);
      return;
    }

    const studentGroups = formData.group && formData.group !== 'Все группы' 
      ? [formData.group.trim()] 
      : [];
    
    const criteriaArray = formData.criteria
      .map(criterion => {
        if (typeof criterion === 'string') {
          return { text: criterion.trim(), maxPoints: 0 };
        }
        return {
          text: (criterion.text || '').trim(),
          maxPoints: parseInt(criterion.maxPoints) || 0,
        };
      })
      .filter(c => c.text);

    const submissionData = {
      ...trimmedFormData,
      deadline: `${trimmedFormData.deadline}T23:59:00`,
      maxScore: parseInt(trimmedFormData.maxScore),
      studentGroups: studentGroups,
      criteria: criteriaArray,
      priority: trimmedFormData.priority || 'medium'
    };

    if (onSubmit) {
      onSubmit(submissionData);
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

  const addCriterion = () => {
    setFormData(prev => ({
      ...prev,
      criteria: [...prev.criteria, { text: '', maxPoints: 0 }]
    }));
  };

  const updateCriterion = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.map((criterion, i) => 
        i === index ? { ...criterion, [field]: value } : criterion
      )
    }));
  };

  const removeCriterion = (index) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <h3>{isEdit ? 'Редактирование задания' : 'Создание нового задания'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
                      className="form-input"
                      required
                    />
                  </FormGroup>
                  
                  <FormGroup label="Дисциплина:" required>
                    <select
                      value={formData.course}
                      onChange={(e) => handleInputChange('course', e.target.value)}
                      className="form-select"
                    >
                      <option value="Базы данных">Базы данных</option>
                      <option value="Веб-программирование">Веб-программирование</option>
                      <option value="Проектирование ИС">Проектирование ИС</option>
                      <option value="UI/UX дизайн">UI/UX дизайн</option>
                      <option value="Мобильная разработка">Мобильная разработка</option>
                    </select>
                  </FormGroup>
                </div>
                
                <div className="form-row">
                  <FormGroup label="Учебная группа:" required>
                    <select
                      value={formData.group}
                      onChange={(e) => handleInputChange('group', e.target.value)}
                      className="form-select"
                    >
                      {groupOptions.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                      <option value="Все группы">Все группы</option>
                    </select>
                  </FormGroup>
                  
                  <FormGroup label="Срок сдачи:" required>
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => handleInputChange('deadline', e.target.value)}
                      className="form-input"
                      required
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </FormGroup>
                </div>
              </div>

              <div className="form-section">
                <h4>Описание задания</h4>
                <FormGroup label="Подробное описание:" required>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Опишите задание, требования, ожидаемый результат..."
                    className="form-textarea"
                    rows="4"
                    required
                  />
                </FormGroup>
              </div>

              <div className="form-section">
                <h4>Параметры оценки</h4>
                <div className="form-row">
                  <FormGroup label="Максимальный балл:" required>
                    <input
                      type="number"
                      value={formData.maxScore}
                      onChange={(e) => handleInputChange('maxScore', parseInt(e.target.value) || 0)}
                      min="1"
                      max="100"
                      className="form-input"
                      required
                    />
                  </FormGroup>
                  
                  <FormGroup label="Формат сдачи:" required>
                    <select
                      value={formData.submissionType}
                      onChange={(e) => handleInputChange('submissionType', e.target.value)}
                      className="form-select"
                    >
                      <option value="file">📎 Файл</option>
                      <option value="demo">🎤 Демонстрация</option>
                    </select>
                  </FormGroup>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <h4>Критерии оценки</h4>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="small"
                    onClick={addCriterion}
                  >
                    + Добавить критерий
                  </Button>
                </div>
                
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
          </div>
          
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" variant="primary">
              💾 {isEdit ? 'Сохранить изменения' : 'Создать задание'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FormGroup = ({ label, children, required = false }) => (
  <div className="form-group">
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
        type="number"
        value={criterion.maxPoints}
        onChange={(e) => onUpdate(index, 'maxPoints', parseInt(e.target.value) || 0)}
        placeholder="0"
        min="0"
        max="100"
        className="criterion-points"
      />
      <span className="points-label">баллов</span>
    </div>
    <Button
      type="button"
      variant="danger"
      size="small"
      onClick={() => onRemove(index)}
    >
      🗑️
    </Button>
  </div>
);

export default AssignmentModal;