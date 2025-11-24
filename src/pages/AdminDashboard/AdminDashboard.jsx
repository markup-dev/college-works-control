import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../../components/Admin/DashboardHeader/DashboardHeader';
import UserManagement from '../../components/Admin/UserManagement/UserManagement';
import CourseManagement from '../../components/Admin/CourseManagement/CourseManagement';
import StatisticsSection from '../../components/Admin/StatisticsSection/StatisticsSection';
import SystemLogs from '../../components/Admin/SystemLogs/SystemLogs';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import './AdminDashboard.scss';

const AdminDashboard = () => {
  const { user } = useAuth();
  const {
    users = [],
    courses = [],
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
    deleteCourse
  } = useAdmin();
  
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

  // Обеспечиваем значения по умолчанию для статистики
  const safeStats = {
    totalUsers: adminStats.totalUsers || users.length,
    activeUsers: adminStats.activeUsers || users.filter(u => u.status === 'active').length,
    totalCourses: adminStats.totalCourses || courses.length,
    activeCourses: adminStats.activeCourses || courses.filter(c => c.status === 'active').length,
    totalAssignments: adminStats.totalAssignments || 0,
    pendingSubmissions: adminStats.pendingSubmissions || 0,
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