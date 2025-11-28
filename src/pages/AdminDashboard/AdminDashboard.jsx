import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../../components/Admin/DashboardHeader/DashboardHeader';
import UserManagement from '../../components/Admin/UserManagement/UserManagement';
import CourseManagement from '../../components/Admin/CourseManagement/CourseManagement';
import StatisticsSection from '../../components/Admin/StatisticsSection/StatisticsSection';
import SystemLogs from '../../components/Admin/SystemLogs/SystemLogs';
import AssignmentManagement from '../../components/Admin/AssignmentManagement/AssignmentManagement';
import SettingsSection from '../../components/Admin/SettingsSection/SettingsSection';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useNotification } from '../../context/NotificationContext';
import './AdminDashboard.scss';

const AdminDashboard = () => {
  const { user } = useAuth();
  const {
    users = [],
    courses = [],
    assignments = [],
    submissions = [],
    systemLogs = [],
    adminStats = {},
    loading,
    loadAdminData,
    createUser,
    updateUser,
    deleteUser,
    createCourse,
    updateCourse,
    deleteCourse,
    deleteAssignment
  } = useAdmin();
  const { showSuccess, showError } = useNotification();
  
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (user.role !== 'admin') {
      navigate(`/${user.role}`);
      return;
    }

    loadAdminData();
  }, [user, navigate, loadAdminData]);

  const safeStats = {
    totalUsers: adminStats.totalUsers || users.length,
    activeUsers: adminStats.activeUsers || users.filter(u => u.isActive === true).length,
    totalCourses: adminStats.totalCourses || courses.length,
    activeCourses: adminStats.activeCourses || courses.filter(c => c.status === 'active').length,
    totalAssignments: adminStats.totalAssignments || assignments.length,
    pendingSubmissions: adminStats.pendingSubmissions || submissions.filter(s => s.status === 'submitted').length,
    systemUptime: adminStats.systemUptime || '100%'
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <StatisticsSection
            stats={safeStats}
            users={users}
            courses={courses}
            submissions={submissions}
          />
        );
      
      case 'users':
        return (
          <UserManagement
            users={users}
            assignments={assignments}
            onCreateUser={createUser}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
          />
        );
      
      case 'courses':
        return (
          <CourseManagement
            courses={courses}
            teachers={users.filter(u => u.role === 'teacher')}
            onCreateCourse={createCourse}
            onUpdateCourse={updateCourse}
            onDeleteCourse={deleteCourse}
          />
        );
      
      case 'logs':
        return <SystemLogs logs={systemLogs} />;
      
      case 'assignments':
        return (
          <AssignmentManagement
            assignments={assignments}
            submissions={submissions}
            teachers={users.filter(u => u.role === 'teacher')}
            onDeleteAssignment={async (assignmentId) => {
              const result = await deleteAssignment(assignmentId);
              if (result.success) {
                showSuccess('Задание успешно удалено');
                loadAdminData();
              } else {
                showError(result.error || 'Ошибка при удалении задания');
              }
            }}
          />
        );
      
      case 'settings':
        return <SettingsSection />;
      
      default:
        return null;
    }
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  if (loading && users.length === 0) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Загрузка панели администратора...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <main className="dashboard-main">
        <div className="dashboard-container">
          <DashboardHeader
            user={user}
            stats={safeStats}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <div className="dashboard-content">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;