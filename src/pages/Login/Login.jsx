// src/pages/Login/Login.jsx (исправленная версия)
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateLoginForm } from '../../utils/validation';
import './Login.scss';

const Login = () => {
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    role: 'student',
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Если пользователь уже авторизован - редирект на его дашборд
  useEffect(() => {
    if (user) {
      navigate(`/${user.role}`);
    }
  }, [user, navigate]);

  // Обработка предварительного выбора роли из welcome-страницы
  useEffect(() => {
    if (location.state?.preselectedRole) {
      setFormData((prev) => ({
        ...prev,
        role: location.state.preselectedRole,
      }));
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.registered) {
      setSuccessMessage('Регистрация прошла успешно! Введите данные для входа.');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Обработчик изменения полей
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Очищаем ошибку при вводе
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  // Обработчик входа
  const handleLogin = async (e) => {
    e.preventDefault();

    // Валидация формы
    const validation = validateLoginForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);

    try {
      // Правильный вызов login - передаем два аргумента, а не объект
      const result = await login(formData.login, formData.password);
      
      if (result.success) {
        // Успешный вход - навигация произойдет автоматически через useEffect выше
        console.log('Вход выполнен успешно');
      } else {
        // Показываем ошибку от сервера
        setErrors({ 
          submit: result.error || 'Ошибка входа. Проверьте логин и пароль.' 
        });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ 
        submit: 'Произошла ошибка при входе в систему. Попробуйте еще раз.' 
      });
      setIsLoading(false);
    }
  };

  const handleBackToWelcome = () => {
    navigate('/welcome');
  };

  const handleGoToRegister = () => {
    navigate('/register');
  };

  return (
    <div className='login-page'>
      <div className='login-container'>
        <button className='back-button' onClick={handleBackToWelcome}>
          ← Назад к обзору
        </button>

        <div className='login-header'>
          <div className='login-logo'>🎓</div>
          <h1 className='login-title'>Вход в систему</h1>
          <p className='login-subtitle'>
            Выберите роль и введите данные для входа
          </p>
        </div>

        {successMessage && (
          <div className='form-success'>
            <span className='success-message'>{successMessage}</span>
          </div>
        )}

        <form className='login-form' onSubmit={handleLogin} noValidate>
          <div className='form-group'>
            <label htmlFor='role' className='form-label'>
              Роль в системе:
            </label>
            <select
              id='role'
              className={`form-select ${errors.role ? 'error' : ''}`}
              value={formData.role}
              onChange={(e) => handleInputChange('role', e.target.value)}
              disabled={isLoading}
            >
              <option value='student'>👨‍🎓 Студент</option>
              <option value='teacher'>👩‍🏫 Преподаватель</option>
              <option value='admin'>⚙️ Администратор</option>
            </select>
            {errors.role && (
              <span className='error-message'>{errors.role}</span>
            )}
          </div>

          <div className='form-group'>
            <label htmlFor='login' className='form-label'>
              Логин или Email:
            </label>
            <input
              id='login'
              type='text'
              className={`form-input ${errors.login ? 'error' : ''}`}
              value={formData.login}
              onChange={(e) => handleInputChange('login', e.target.value)}
              placeholder='Введите ваш логин или email'
              disabled={isLoading}
            />
            {errors.login && (
              <span className='error-message'>{errors.login}</span>
            )}
          </div>

          <div className='form-group'>
            <label htmlFor='password' className='form-label'>
              Пароль:
            </label>
            <input
              id='password'
              type='password'
              className={`form-input ${errors.password ? 'error' : ''}`}
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder='Введите ваш пароль'
              disabled={isLoading}
            />
            {errors.password && (
              <span className='error-message'>{errors.password}</span>
            )}
          </div>

          {/* Общая ошибка формы */}
          {errors.submit && (
            <div className='form-error'>
              <span className='error-message'>{errors.submit}</span>
            </div>
          )}

          <button
            type='submit'
            className={`login-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className='spinner'></div>
                Вход в систему...
              </>
            ) : (
              'Войти в систему'
            )}
          </button>
        </form>

        <div className='login-links'>
          <p>
            Нет аккаунта?{' '}
            <button 
              className='link-button' 
              onClick={handleGoToRegister}
              disabled={isLoading}
            >
              Зарегистрироваться
            </button>
          </p>
        </div>

        <div className='login-demo'>
          <h3>Демо-доступ:</h3>
          <div className='demo-accounts'>
            <div className='demo-account'>
              <strong>Студент:</strong> student_ivanov / Password123
            </div>
            <div className='demo-account'>
              <strong>Преподаватель:</strong> teacher_petrova / Password123
            </div>
            <div className='demo-account'>
              <strong>Администратор:</strong> admin_sidorov / Password123
            </div>
          </div>
          <p className='demo-note'>
            * Роль выбирается в выпадающем списке выше
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;