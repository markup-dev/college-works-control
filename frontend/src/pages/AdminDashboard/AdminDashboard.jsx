import React, { useState } from 'react';
import DashboardHeader from '../../components/Admin/DashboardHeader/DashboardHeader';
import UserManagement from '../../components/Admin/UserManagement/UserManagement';
import GroupManagement from '../../components/Admin/GroupManagement/GroupManagement';
import SubjectManagement from '../../components/Admin/SubjectManagement/SubjectManagement';
import TeachingLoadManagement from '../../components/Admin/TeachingLoadManagement/TeachingLoadManagement';
import StatisticsSection from '../../components/Admin/StatisticsSection/StatisticsSection';
import SystemLogs from '../../components/Admin/SystemLogs/SystemLogs';
import SettingsSection from '../../components/Admin/SettingsSection/SettingsSection';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import './AdminDashboard.scss';

const AdminDashboard = () => {
  const { user } = useAuth();
  const {
    users = [],
    teacherOptions = [],
    groups = [],
    subjects = [],
    teachingLoads = [],
    systemLogs = [],
    usersMeta = {},
    groupsMeta = {},
    subjectsMeta = {},
    teachingLoadsMeta = {},
    logsMeta = {},
    usersQuery = {},
    groupsQuery = {},
    subjectsQuery = {},
    teachingLoadsQuery = {},
    logsQuery = {},
    adminStats = {},
    loading,
    error,
    fetchUsers,
    fetchGroups,
    fetchSubjects,
    fetchTeachingLoads,
    fetchLogs,
    searchStudentsForTransfer,
    createUser,
    updateUser,
    deleteUser,
    previewUsersImport,
    importUsers,
    updateGroup,
    deleteGroup,
    createSubject,
    updateSubject,
    deleteSubject,
    createGroupWithStudents,
    bulkAttachStudentsToGroup,
    previewSubjectsImport,
    importSubjects,
    createTeachingLoad,
    updateTeachingLoad,
    deleteTeachingLoad,
  } = useAdmin();
  
  const [activeTab, setActiveTab] = useState('overview');

  const safeStats = {
    totalUsers: adminStats.totalUsers || usersMeta.total || users.length,
    studentUsers: adminStats.studentUsers ?? users.filter((u) => u.role === 'student').length,
    teacherUsers: adminStats.teacherUsers ?? users.filter((u) => u.role === 'teacher').length,
    adminUsers: adminStats.adminUsers ?? users.filter((u) => u.role === 'admin').length,
    totalSubjects: adminStats.totalSubjects || subjectsMeta.total || subjects.length,
    totalGroups: adminStats.totalGroups || groupsMeta.total || groups.length,
    activeSubjects: adminStats.activeSubjects || subjects.filter((s) => s.status === 'active').length,
    pendingSubmissions: adminStats.pendingSubmissions || 0,
    returnedSubmissions: adminStats.returnedSubmissions || 0,
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <StatisticsSection
            stats={safeStats}
            users={users}
            groups={groups}
            subjects={subjects}
            logs={systemLogs}
          />
        );
      
      case 'users':
        return (
          <UserManagement
            users={users}
            groups={groups}
            paginationMeta={usersMeta}
            query={usersQuery}
            onFetchUsers={fetchUsers}
            onCreateUser={createUser}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
            onPreviewUsersImport={previewUsersImport}
            onImportUsers={importUsers}
          />
        );
      
      case 'subjects':
        return (
          <SubjectManagement
            subjects={subjects}
            paginationMeta={subjectsMeta}
            query={subjectsQuery}
            onFetchSubjects={fetchSubjects}
            onCreateSubject={createSubject}
            onUpdateSubject={updateSubject}
            onDeleteSubject={deleteSubject}
            onPreviewSubjectsImport={previewSubjectsImport}
            onImportSubjects={importSubjects}
          />
        );

      case 'teaching-loads':
        return (
          <TeachingLoadManagement
            teachingLoads={teachingLoads}
            teachers={teacherOptions}
            subjects={subjects}
            groups={groups}
            paginationMeta={teachingLoadsMeta}
            query={teachingLoadsQuery}
            onFetchTeachingLoads={fetchTeachingLoads}
            onCreateTeachingLoad={createTeachingLoad}
            onUpdateTeachingLoad={updateTeachingLoad}
            onDeleteTeachingLoad={deleteTeachingLoad}
          />
        );

      case 'groups':
        return (
          <GroupManagement
            groups={groups}
            paginationMeta={groupsMeta}
            query={groupsQuery}
            onFetchGroups={fetchGroups}
            onUpdateGroup={updateGroup}
            onDeleteGroup={deleteGroup}
            onCreateGroupWithStudents={createGroupWithStudents}
            onBulkAttachStudents={bulkAttachStudentsToGroup}
            onSearchStudentsForTransfer={searchStudentsForTransfer}
          />
        );
      
      case 'logs':
        return <SystemLogs logs={systemLogs} paginationMeta={logsMeta} query={logsQuery} onFetchLogs={fetchLogs} />;
      
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

  if (error) {
    return (
      <div className="error-state">
        <div className="error-icon">⚠️</div>
        <h3>Ошибка загрузки</h3>
        <p>{error}</p>
        <button onClick={fetchUsers}>Повторить попытку</button>
      </div>
    );
  }

  return (
    <div className="admin-dashboard app-page">
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