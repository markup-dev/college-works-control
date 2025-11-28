import React, { useState, useMemo } from 'react';
import Table from '../../UI/Table/Table';
import Button from '../../UI/Button/Button';
import Badge from '../../UI/Badge/Badge';
import Card from '../../UI/Card/Card';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import AssignmentDetailsModal from '../../Shared/AssignmentDetailsModal/AssignmentDetailsModal';
import { useNotification } from '../../../context/NotificationContext';
import { getAssignmentStatusInfo, getPriorityInfo, formatDate, getDaysUntilDeadline } from '../../../utils';
import './AssignmentManagement.scss';

const AssignmentManagement = ({ assignments = [], submissions = [], teachers = [], onDeleteAssignment }) => {
  const { showSuccess, showError } = useNotification();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('deadline');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const filteredAssignments = useMemo(() => {
    let filtered = [...assignments];

    if (filter !== 'all') {
      if (filter === 'active') {
        filtered = filtered.filter(a => a.status === 'active');
      } else if (filter === 'draft') {
        filtered = filtered.filter(a => a.status === 'draft');
      } else if (filter === 'urgent') {
        filtered = filtered.filter(a => {
          const days = getDaysUntilDeadline(a.deadline);
          return days !== null && days <= 3 && days >= 0;
        });
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.title?.toLowerCase().includes(term) ||
        a.course?.toLowerCase().includes(term) ||
        a.teacherLogin?.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'deadline':
          return new Date(a.deadline || 0) - new Date(b.deadline || 0);
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'course':
          return (a.course || '').localeCompare(b.course || '');
        case 'submissions':
          const aCount = submissions.filter(s => s.assignmentId === a.id).length;
          const bCount = submissions.filter(s => s.assignmentId === b.id).length;
          return bCount - aCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [assignments, submissions, filter, searchTerm, sortBy]);

  const handleDelete = (assignment) => {
    setAssignmentToDelete(assignment);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (assignmentToDelete) {
      try {
        const result = await onDeleteAssignment(assignmentToDelete.id);
        if (result?.success !== false) {
          showSuccess('Задание успешно удалено');
        } else {
          showError(result?.error || 'Ошибка при удалении задания');
        }
        setShowDeleteConfirm(false);
        setAssignmentToDelete(null);
      } catch (error) {
        showError('Ошибка при удалении задания');
      }
    }
  };

  const handleViewDetails = (assignment) => {
    const assignmentSubmissions = submissions.filter(s => s.assignmentId === assignment.id);
    setSelectedAssignment({ ...assignment, submissions: assignmentSubmissions });
    setShowDetails(true);
  };

  const getTeacherName = (teacherLogin) => {
    const teacher = teachers.find(t => t.login === teacherLogin);
    return teacher?.name || teacherLogin || 'Не указан';
  };

  const columns = [
    {
      key: 'title',
      title: 'Название задания',
      width: '25%',
      render: (value, assignment) => (
        <div className="assignment-title-cell">
          <div className="assignment-title-link" onClick={() => handleViewDetails(assignment)}>
            {value}
          </div>
          {assignment.course && (
            <div className="assignment-course">{assignment.course}</div>
          )}
        </div>
      )
    },
    {
      key: 'teacherLogin',
      title: 'Преподаватель',
      width: '15%',
      render: (value) => (
        <div className="teacher-cell">{getTeacherName(value)}</div>
      )
    },
    {
      key: 'priority',
      title: 'Приоритет',
      width: '10%',
      render: (value) => {
        const priorityInfo = getPriorityInfo(value);
        return (
          <Badge variant={priorityInfo.variant}>
            <span>{priorityInfo.icon}</span> {priorityInfo.label}
          </Badge>
        );
      }
    },
    {
      key: 'deadline',
      title: 'Срок сдачи',
      width: '12%',
      render: (value, assignment) => {
        const days = getDaysUntilDeadline(value);
        const isUrgent = days !== null && days <= 3 && days >= 0;
        const isOverdue = days !== null && days < 0;
        return (
          <div className={`deadline-cell ${isUrgent ? 'urgent' : ''} ${isOverdue ? 'overdue' : ''}`}>
            {formatDate(value)}
            {days !== null && (
              <div className="days-left">
                {isOverdue ? `Просрочено на ${Math.abs(days)} дн.` : `Осталось ${days} дн.`}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'submissions',
      title: 'Работ',
      width: '8%',
      render: (value, assignment) => {
        const count = submissions.filter(s => s.assignmentId === assignment.id).length;
        const pending = submissions.filter(s => s.assignmentId === assignment.id && s.status === 'submitted').length;
        return (
          <div className="submissions-cell">
            <div className="total-count">{count}</div>
            {pending > 0 && (
              <div className="pending-count">({pending} на проверке)</div>
            )}
          </div>
        );
      }
    },
    {
      key: 'status',
      title: 'Статус',
      width: '10%',
      render: (value) => {
        const statusInfo = getAssignmentStatusInfo(value);
        return (
          <Badge variant={statusInfo.variant}>
            <span>{statusInfo.icon}</span> {statusInfo.label}
          </Badge>
        );
      }
    },
    {
      key: 'actions',
      title: 'Действия',
      width: '15%',
      render: (value, assignment) => (
        <div className="assignment-actions">
          <Button
            size="small"
            variant="outline"
            onClick={() => handleViewDetails(assignment)}
            icon="👁️"
          >
            Просмотр
          </Button>
          <Button
            size="small"
            variant="danger"
            onClick={() => handleDelete(assignment)}
            icon="🗑️"
          >
            Удалить
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="assignment-management">
      <div className="management-header">
        <div className="header-content">
          <h2>📝 Управление заданиями</h2>
          <p>Просмотр и управление всеми заданиями в системе</p>
        </div>
      </div>

      <Card className="filters-card">
        <div className="filters-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Поиск по названию, курсу, преподавателю..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Все задания</option>
            <option value="active">Активные</option>
            <option value="draft">Черновики</option>
            <option value="urgent">Срочные</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="deadline">По сроку сдачи</option>
            <option value="priority">По приоритету</option>
            <option value="title">По названию</option>
            <option value="course">По курсу</option>
            <option value="submissions">По количеству работ</option>
          </select>
        </div>
      </Card>

      <Card className="assignments-table-card">
        <div className="table-info">
          <span className="assignments-count">
            Всего заданий: <strong>{filteredAssignments.length}</strong>
          </span>
        </div>
        {filteredAssignments.length > 0 ? (
          <Table
            data={filteredAssignments}
            columns={columns}
            className="assignments-table"
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>Заданий не найдено</p>
            {searchTerm || filter !== 'all' ? (
              <Button variant="outline" onClick={() => {
                setSearchTerm('');
                setFilter('all');
              }}>
                Сбросить фильтры
              </Button>
            ) : null}
          </div>
        )}
      </Card>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setAssignmentToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Удалить задание?"
        message={
          assignmentToDelete
            ? `Вы уверены, что хотите удалить задание "${assignmentToDelete.title}"? Все связанные сдачи также будут удалены.`
            : 'Вы уверены, что хотите удалить задание?'
        }
        confirmText="Удалить"
        danger
      />

      {selectedAssignment && (
        <AssignmentDetailsModal
          assignment={selectedAssignment}
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedAssignment(null);
          }}
          mode="admin"
        />
      )}
    </div>
  );
};

export default AssignmentManagement;

