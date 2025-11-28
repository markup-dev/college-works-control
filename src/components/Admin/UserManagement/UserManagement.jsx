import React, { useState, useMemo } from 'react';
import Table from '../../UI/Table/Table';
import Button from '../../UI/Button/Button';
import Badge from '../../UI/Badge/Badge';
import Card from '../../UI/Card/Card';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import { useNotification } from '../../../context/NotificationContext';
import './UserManagement.scss';

const UserManagement = ({ users, assignments = [], onCreateUser, onUpdateUser, onDeleteUser }) => {
  const { showError } = useNotification();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState({
    login: '',
    name: '',
    email: '',
    password: '',
    role: 'student',
    group: '',
    department: '',
    teacherLogin: ''
  });
  const [newGroupName, setNewGroupName] = useState('');

  const availableGroups = useMemo(() => {
    const groupSet = new Set();
    
    users.forEach(user => {
      if (user.role === 'student' && user.group) {
        groupSet.add(user.group);
      }
    });
    
    assignments.forEach(assignment => {
      if (Array.isArray(assignment.studentGroups)) {
        assignment.studentGroups.forEach(group => {
          if (group) groupSet.add(group);
        });
      }
    });
    
    return Array.from(groupSet).sort();
  }, [users, assignments]);

  const teachers = useMemo(() => {
    return users.filter(user => user.role === 'teacher');
  }, [users]);

  const handleCreate = () => {
    setFormData({ login: '', name: '', email: '', password: '', role: 'student', group: '', department: '', teacherLogin: '' });
    setNewGroupName('');
    setEditingUser(null);
    setShowCreateForm(true);
  };

  const handleEdit = (user) => {
    setFormData({
      login: user.login,
      name: user.name,
      email: user.email || '',
      password: '',
      role: user.role,
      group: user.group || '',
      department: user.department || '',
      teacherLogin: user.teacherLogin || ''
    });
    setEditingUser(user);
    setShowCreateForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = { 
        ...formData,
        name: formData.name?.trim() || '',
        login: formData.login?.trim() || '',
        email: formData.email?.trim() || '',
        department: formData.department?.trim() || '',
        teacherLogin: formData.teacherLogin?.trim() || ''
      };
      
      if (submitData.group === '__new__') {
        const trimmedGroupName = newGroupName.trim();
        if (!trimmedGroupName) {
          showError('Введите название новой группы');
          return;
        }
        if (!/^[А-ЯЁA-Z\-\d]+$/i.test(trimmedGroupName)) {
          showError('Группа должна содержать только буквы, цифры и дефис (например, ИСП-401)');
          return;
        }
        submitData.group = trimmedGroupName;
      } else if (submitData.group) {
        submitData.group = submitData.group.trim();
      }
      
      const { validateUserData } = await import('../../../utils/adminHelpers');
      const validation = validateUserData(submitData, !!editingUser);
      
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        showError(firstError);
        return;
      }
      
      if (editingUser) {
        await onUpdateUser(editingUser.id, submitData);
      } else {
        await onCreateUser(submitData);
      }
      setShowCreateForm(false);
      setEditingUser(null);
      setNewGroupName('');
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
      width: '12%'
    },
    {
      key: 'name',
      title: 'ФИО',
      width: '20%'
    },
    {
      key: 'email',
      title: 'Email',
      width: '18%'
    },
    {
      key: 'role',
      title: 'Роль',
      width: '12%',
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
      width: '15%',
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
      width: '13%',
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
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Пароль {editingUser ? '(оставьте пустым, чтобы не менять)' : '*'}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required={!editingUser}
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
              {formData.role === 'student' ? (
                <div className="form-group">
                  <label>Группа *</label>
                  <select
                    value={formData.group === '__new__' ? '__new__' : formData.group}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '__new__') {
                        setFormData(prev => ({ ...prev, group: '__new__' }));
                        setNewGroupName('');
                      } else {
                        setFormData(prev => ({ ...prev, group: value }));
                        setNewGroupName('');
                      }
                    }}
                    required
                  >
                    <option value="">Выберите группу</option>
                    {availableGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                    <option value="__new__">+ Добавить новую группу</option>
                  </select>
                  {formData.group === '__new__' && (
                    <input
                      type="text"
                      placeholder="Введите название новой группы (например, ИСП-401)"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem' }}
                      autoFocus
                      required
                    />
                  )}
                </div>
              ) : (
                <div className="form-group">
                  <label>Кафедра</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  />
                </div>
              )}
            </div>
            {formData.role === 'student' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Преподаватель</label>
                  <select
                    value={formData.teacherLogin}
                    onChange={(e) => setFormData(prev => ({ ...prev, teacherLogin: e.target.value }))}
                  >
                    <option value="">Не назначен</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.login}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
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