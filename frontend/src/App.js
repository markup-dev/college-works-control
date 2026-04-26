import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { RootProvider } from './context/RootProvider';
import { useAuth } from './context/AuthContext';
import Welcome from './pages/Welcome/Welcome';
import Login from './pages/Login/Login';
import StudentDashboard from './pages/StudentDashboard/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import Profile from './pages/Profile/Profile';
import Messages from './pages/Messages/Messages';
import Notifications from './pages/Notifications/Notifications';
import NotFound from './pages/NotFound/NotFound';
import Header from './components/Layout/Header/Header';
import Footer from './components/Layout/Footer/Footer';
import ConfirmModal from './components/UI/Modal/ConfirmModal';
import './styles/main.scss';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const mustChangePassword = !!user?.mustChangePassword;


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
    <Router>
      <ScrollToTop />
      <div className="App">
        {user && <Header user={user} onLogout={handleLogout} />}
        <main className="main-content">
          <Routes>
            <Route 
              path="/welcome" 
              element={
                user ? (
                  <Navigate to={mustChangePassword ? '/profile' : `/${user.role}`} replace />
                ) : (
                  <Welcome />
                )
              } 
            />
            <Route 
              path="/login" 
              element={
                user ? (
                  <Navigate to={mustChangePassword ? '/profile' : `/${user.role}`} replace />
                ) : (
                  <Login />
                )
              } 
            />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route 
              path="/student" 
              element={
                user && user.role === 'student' ? (
                  mustChangePassword ? <Navigate to="/profile" replace /> : <StudentDashboard />
                ) : (
                  <Navigate to="/welcome" replace />
                )
              } 
            />
            <Route 
              path="/teacher" 
              element={
                user && user.role === 'teacher' ? (
                  mustChangePassword ? <Navigate to="/profile" replace /> : <TeacherDashboard />
                ) : (
                  <Navigate to="/welcome" replace />
                )
              } 
            />
            <Route 
              path="/admin" 
              element={
                user && user.role === 'admin' ? (
                  mustChangePassword ? <Navigate to="/profile" replace /> : <AdminDashboard />
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
              path="/notifications"
              element={
                !user ? (
                  <Navigate to="/welcome" replace />
                ) : user.role === 'admin' ? (
                  <Navigate to="/admin" replace />
                ) : mustChangePassword ? (
                  <Navigate to="/profile" replace />
                ) : user.role === 'student' || user.role === 'teacher' ? (
                  <Notifications />
                ) : (
                  <Navigate to="/welcome" replace />
                )
              }
            />
            <Route
              path="/messages"
              element={
                !user ? (
                  <Navigate to="/welcome" replace />
                ) : user.role === 'admin' ? (
                  <Navigate to="/admin" replace />
                ) : mustChangePassword ? (
                  <Navigate to="/profile" replace />
                ) : user.role === 'student' || user.role === 'teacher' ? (
                  <Messages />
                ) : (
                  <Navigate to="/welcome" replace />
                )
              }
            />
            <Route 
              path="/" 
              element={
                <Navigate to={user ? (mustChangePassword ? '/profile' : `/${user.role}`) : '/welcome'} replace />
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