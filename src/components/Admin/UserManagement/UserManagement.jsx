// src/components/Admin/UserManagement/UserManagement.jsx
import React, { useState } from 'react';
import Table from '../../UI/Table/Table';
import Button from '../../UI/Button/Button';
import Badge from '../../UI/Badge/Badge';
import Card from '../../UI/Card/Card';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import { useNotification } from '../../../context/NotificationContext';
import './UserManagement.scss';

const UserManagement = ({ users, onCreateUser, onUpdateUser, onDeleteUser }) => {
  const { showError } = useNotification();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState({
    login: '',
    name: '',
    role: 'student',
    group: '',
    department: ''
  });

  const handleCreate = () => {
    setFormData({ login: '', name: '', role: 'student', group: '', department: '' });
    setEditingUser(null);
    setShowCreateForm(true);
  };

  const handleEdit = (user) => {
    setFormData({
      login: user.login,
      name: user.name,
      role: user.role,
      group: user.group || '',
      department: user.department || ''
    });
    setEditingUser(user);
    setShowCreateForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await onUpdateUser(editingUser.id, formData);
      } else {
        await onCreateUser(formData);
      }
      setShowCreateForm(false);
      setEditingUser(null);
    } catch (error) {
      showError(error.message);
    }
  };

  const handleDelete = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      await onDeleteUser(userToDelete.id);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const columns = [
    {
      key: 'login',
      title: 'Логин',
      width: '15%'
    },
    {
      key: 'name',
      title: 'ФИО',
      width: '25%'
    },
    {
      key: 'role',
      title: 'Роль',
      width: '15%',
      render: (value) => {
        const roleLabels = {
          student: '👨‍🎓 Студент',
          teacher: '👩‍🏫 Преподаватель',
          admin: '⚙️ Администратор'
        };
        return roleLabels[value] || value;
      }
    },
    {
      key: 'group',
      title: 'Группа/Кафедра',
      width: '20%',
      render: (value, user) => user.role === 'student' ? value : user.department
    },
    {
      key: 'status',
      title: 'Статус',
      width: '10%',
      render: (value) => (
        <Badge variant={value === 'active' ? 'success' : 'danger'}>
          {value === 'active' ? 'Активен' : 'Неактивен'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: 'Действия',
      width: '15%',
      render: (value, user) => (
        <div className="user-actions">
          <Button 
            size="small" 
            variant="secondary"
            onClick={() => handleEdit(user)}
          >
            ✏️
          </Button>
          <Button 
            size="small" 
            variant="danger"
            onClick={() => handleDelete(user)}
            disabled={user.role === 'admin'}
          >
            🗑️
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="user-management">
      <div className="section-header">
        <h2>Управление пользователями</h2>
        <Button variant="primary" onClick={handleCreate}>
          + Добавить пользователя
        </Button>
      </div>

      {showCreateForm && (
        <Card className="user-form">
          <h3>{editingUser ? 'Редактировать пользователя' : 'Создать пользователя'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Логин *</label>
                <input
                  type="text"
                  value={formData.login}
                  onChange={(e) => setFormData(prev => ({ ...prev, login: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>ФИО *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Роль *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="student">Студент</option>
                  <option value="teacher">Преподаватель</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  {formData.role === 'student' ? 'Группа' : 'Кафедра'}
                </label>
                <input
                  type="text"
                  value={formData.role === 'student' ? formData.group : formData.department}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    [formData.role === 'student' ? 'group' : 'department']: e.target.value 
                  }))}
                />
              </div>
            </div>
            <div className="form-actions">
              <Button type="submit" variant="primary">
                {editingUser ? 'Сохранить' : 'Создать'}
              </Button>
              <Button 
                type="button" 
                variant="secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Table
        columns={columns}
        data={users}
        striped
        hoverable
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Удаление пользователя"
        message={userToDelete ? `Удалить пользователя ${userToDelete.name}?` : ''}
        confirmText="Удалить"
        cancelText="Отмена"
        danger={true}
      />
    </div>
  );
};

export default UserManagement;