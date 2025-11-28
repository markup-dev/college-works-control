import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RootProvider } from './context/RootProvider';
import { useAuth } from './context/AuthContext';
import { useStudent } from './context/StudentContext';
import { useTeacher } from './context/TeacherContext';
import { useAdmin } from './context/AdminContext';
import Welcome from './pages/Welcome/Welcome';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import StudentDashboard from './pages/StudentDashboard/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import Profile from './pages/Profile/Profile';
import NotFound from './pages/NotFound/NotFound';
import Header from './components/Layout/Header/Header';
import Footer from './components/Layout/Footer/Footer';
import ConfirmModal from './components/UI/Modal/ConfirmModal';
import './styles/main.scss';

function StudentDataLoader() {
  const { loadStudentAssignments } = useStudent();
  useEffect(() => {
    loadStudentAssignments();
  }, [loadStudentAssignments]);
  return null;
}

function TeacherDataLoader() {
  const { loadTeacherAssignments, loadTeacherSubmissions } = useTeacher();
  useEffect(() => {
    loadTeacherAssignments();
    loadTeacherSubmissions();
  }, [loadTeacherAssignments, loadTeacherSubmissions]);
  return null;
}

function AdminDataLoader() {
  const { loadAdminData } = useAdmin();
  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);
  return null;
}

function DataLoader() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  if (user.role === 'student') {
    return <StudentDataLoader />;
  } else if (user.role === 'teacher') {
    return <TeacherDataLoader />;
  } else if (user.role === 'admin') {
    return <AdminDataLoader />;
  }
  
  return null;
}

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  if (loading && !user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Загрузка...
      </div>
    );
  }

  return (
    <Router basename="/college-works-control">
      <div className="App">
        {user && <DataLoader />}
        {user && <Header user={user} onLogout={handleLogout} />}
        <main className="main-content">
          <Routes>
            <Route 
              path="/welcome" 
              element={
                user ? (
                  <Navigate to={`/${user.role}`} replace />
                ) : (
                  <Welcome />
                )
              } 
            />
            <Route 
              path="/login" 
              element={
                user ? (
                  <Navigate to={`/${user.role}`} replace />
                ) : (
                  <Login />
                )
              } 
            />
            <Route 
              path="/register" 
              element={
                user ? (
                  <Navigate to={`/${user.role}`} replace />
                ) : (
                  <Register />
                )
              } 
            />
            <Route 
              path="/student" 
              element={
                user && user.role === 'student' ? (
                  <StudentDashboard />
                ) : (
                  <Navigate to="/welcome" replace />
                )
              } 
            />
            <Route 
              path="/teacher" 
              element={
                user && user.role === 'teacher' ? (
                  <TeacherDashboard />
                ) : (
                  <Navigate to="/welcome" replace />
                )
              } 
            />
            <Route 
              path="/admin" 
              element={
                user && user.role === 'admin' ? (
                  <AdminDashboard />
                ) : (
                  <Navigate to="/welcome" replace />
                )
              } 
            />
            <Route
              path="/profile"
              element={
                user ? (
                  <Profile />
                ) : (
                  <Navigate to="/welcome" replace />
                )
              }
            />
            <Route 
              path="/" 
              element={
                <Navigate to={user ? `/${user.role}` : '/welcome'} replace />
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
      
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Выход из системы"
        message="Вы уверены, что хотите выйти?"
        confirmText="Выйти"
        cancelText="Отмена"
      />
    </Router>
  );
}

function App() {
  return (
    <RootProvider>
      <AppContent />
    </RootProvider>
  );
}

export default App;