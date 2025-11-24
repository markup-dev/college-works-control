import React, { useState } from 'react';
import Table from '../../UI/Table/Table';
import Button from '../../UI/Button/Button';
import Badge from '../../UI/Badge/Badge';
import Card from '../../UI/Card/Card';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import './CourseManagement.scss';

const CourseManagement = ({ 
  courses = [], 
  teachers = [], 
  onCreateCourse, 
  onUpdateCourse,
  onDeleteCourse,
  loading = false,
  className = ""
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    teacherId: '',
    description: '',
    credits: 3,
    semester: 1,
    status: 'active'
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const handleCreate = () => {
    setFormData({
      name: '',
      code: '',
      teacherId: '',
      description: '',
      credits: 3,
      semester: 1,
      status: 'active'
    });
    setEditingCourse(null);
    setFormErrors({});
    setShowForm(true);
  };

  const handleEdit = (course) => {
    setFormData({
      name: course.name,
      code: course.code || '',
      teacherId: course.teacherId || course.teacher?.id || '',
      description: course.description || '',
      credits: course.credits || 3,
      semester: course.semester || 1,
      status: course.status
    });
    setEditingCourse(course);
    setFormErrors({});
    setShowForm(true);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Название курса обязательно';
    }

    if (!formData.code.trim()) {
      errors.code = 'Код курса обязателен';
    }

    if (!formData.teacherId) {
      errors.teacherId = 'Выберите преподавателя';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (editingCourse) {
        await onUpdateCourse(editingCourse.id, formData);
      } else {
        await onCreateCourse(formData);
      }
      setShowForm(false);
      setEditingCourse(null);
    } catch (error) {
      console.error('Ошибка сохранения курса:', error);
    }
  };

  const handleToggleStatus = async (course) => {
    const newStatus = course.status === 'active' ? 'inactive' : 'active';
    await onUpdateCourse(course.id, { status: newStatus });
  };

  const handleDelete = (course) => {
    setCourseToDelete(course);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (courseToDelete) {
      try {
        await onDeleteCourse(courseToDelete.id);
        setShowDeleteConfirm(false);
        setCourseToDelete(null);
      } catch (error) {
        console.error('Ошибка удаления курса:', error);
      }
    }
  };

  const columns = [
    {
      key: 'name',
      title: 'Название курса',
      width: '20%',
      render: (value, course) => (
        <div className="course-name-cell">
          <div className="course-name">{value}</div>
          {course.code && (
            <div className="course-code">{course.code}</div>
          )}
        </div>
      )
    },
    {
      key: 'teacher',
      title: 'Преподаватель',
      width: '20%',
      render: (value, course) => (
        <div className="teacher-cell">
          <div className="teacher-name">{course.teacher?.name || value}</div>
        </div>
      )
    },
    {
      key: 'studentsCount',
      title: 'Студентов',
      width: '10%',
      render: (value) => (
        <div className="count-cell">
          <span className="count-value">{value || 0}</span>
        </div>
      )
    },
    {
      key: 'credits',
      title: 'Кредиты',
      width: '8%',
      render: (value) => (
        <div className="count-cell">
          <span className="count-value">{value || 3}</span>
        </div>
      )
    },
    {
      key: 'semester',
      title: 'Семестр',
      width: '8%',
      render: (value) => (
        <div className="count-cell">
          <span className="count-value">{value || 1}</span>
        </div>
      )
    },
    {
      key: 'status',
      title: 'Статус',
      width: '8%',
      render: (value) => (
        <Badge
          variant={value === 'active' ? 'success' : 'secondary'}
        >
          {value === 'active' ? 'Активен' : 'Неактивен'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: 'Действия',
      width: '18%',
      render: (value, course) => (
        <div className="course-actions">
          <Button 
            size="small" 
            variant="outline"
            onClick={() => handleEdit(course)}
            icon="✏️"
          />
          <Button 
            size="small" 
            variant={course.status === 'active' ? 'warning' : 'success'}
            onClick={() => handleToggleStatus(course)}
            icon={course.status === 'active' ? '⏸️' : '▶️'}
          />
          <Button 
            size="small" 
            variant="danger"
            onClick={() => handleDelete(course)}
            icon="🗑️"
          />
        </div>
      )
    }
  ];

  return (
    <div className={`course-management ${className}`}>
      <div className="course-management__header">
        <div className="header-info">
          <h1>Управление курсами</h1>
          <p>Создание и редактирование учебных курсов системы</p>
        </div>
        <Button 
          variant="primary" 
          onClick={handleCreate}
          icon="➕"
        >
          Создать курс
        </Button>
      </div>

      {showForm && (
        <Card className="course-form-card">
          <h3>{editingCourse ? 'Редактировать курс' : 'Создать курс'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Название курса *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={formErrors.name ? 'error' : ''}
                  placeholder="Введите название курса"
                />
                {formErrors.name && <div className="error-text">{formErrors.name}</div>}
              </div>
              
              <div className="form-group">
                <label>Код курса *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className={formErrors.code ? 'error' : ''}
                  placeholder="Например: CS101"
                />
                {formErrors.code && <div className="error-text">{formErrors.code}</div>}
              </div>
              
              <div className="form-group">
                <label>Преподаватель *</label>
                <select
                  value={formData.teacherId}
                  onChange={(e) => setFormData(prev => ({ ...prev, teacherId: e.target.value }))}
                  className={formErrors.teacherId ? 'error' : ''}
                >
                  <option value="">Выберите преподавателя</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                {formErrors.teacherId && <div className="error-text">{formErrors.teacherId}</div>}
              </div>

              <div className="form-group">
                <label>Кредиты</label>
                <input
                  type="number"
                  value={formData.credits}
                  onChange={(e) => setFormData(prev => ({ ...prev, credits: parseInt(e.target.value) || 3 }))}
                  min="1"
                  max="10"
                />
              </div>

              <div className="form-group">
                <label>Семестр</label>
                <input
                  type="number"
                  value={formData.semester}
                  onChange={(e) => setFormData(prev => ({ ...prev, semester: parseInt(e.target.value) || 1 }))}
                  min="1"
                  max="8"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Описание курса</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows="3"
                placeholder="Опишите содержание и цели курса..."
              />
            </div>

            <div className="form-actions">
              <Button type="submit" variant="primary">
                {editingCourse ? 'Сохранить изменения' : 'Создать курс'}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="courses-table-container">
        <Table
          columns={columns}
          data={courses}
          emptyState={{
            icon: '📚',
            title: 'Курсы не найдены',
            description: 'Создайте первый курс для начала работы'
          }}
          striped
          hoverable
        />
      </Card>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setCourseToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Удаление курса"
        message={courseToDelete ? `Вы уверены, что хотите удалить курс "${courseToDelete.name}"?` : ''}
        confirmText="Удалить"
        cancelText="Отмена"
        danger={true}
      />
    </div>
  );
};

export default CourseManagement;