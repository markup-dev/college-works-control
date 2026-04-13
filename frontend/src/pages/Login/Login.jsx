import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateLoginForm } from '../../utils';
import './Login.scss';
import logo from '../../assets/logo-black.svg';
import fallbackLogo from '../../assets/logo.svg';

const DEMO_ACCOUNTS = [
  {
    role: 'student',
    roleLabel: 'Студент',
    login: 'zabiriucenko_ka',
    password: 'Password123',
  },
  {
    role: 'teacher',
    roleLabel: 'Преподаватель (JS)',
    login: 'teacher_kartseva',
    password: 'Password123',
  },
  {
    role: 'teacher',
    roleLabel: 'Преподаватель (PHP)',
    login: 'teacher_karevskiy',
    password: 'Password123',
  },
  {
    role: 'admin',
    roleLabel: 'Администратор',
    login: 'Administrator',
    password: 'Password123',
  },
];

const Login = () => {
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    role: 'student',
  });
  const [logoSrc, setLogoSrc] = useState(logo);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      navigate(`/${user.role}`);
    }
  }, [user, navigate]);

  useEffect(() => {
    if (location.state?.preselectedRole) {
      setFormData((prev) => ({
        ...prev,
        role: location.state.preselectedRole,
      }));
    }
  }, [location.state]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    setErrors((prev) => ({ ...prev, submit: '' }));
    const validation = validateLoginForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(formData.login, formData.password, formData.role);
      
      if (result.success) {
      } else {
        setErrors((prev) => ({ 
          ...prev,
          submit: result.error || 'Ошибка входа. Проверьте логин и пароль.' 
        }));
      }
    } catch (error) {
      setErrors((prev) => ({ 
        ...prev,
        submit: 'Произошла ошибка при входе в систему. Попробуйте еще раз.' 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToWelcome = () => {
    navigate('/welcome');
  };

  const handleDemoFill = (account) => {
    setFormData({
      role: account.role,
      login: account.login,
      password: account.password,
    });
    setErrors({});
  };

  return (
    <div className='login-page'>
      <div className='login-layout'>
        <div className='login-container'>
          <button className='back-button' onClick={handleBackToWelcome}>
            ← Назад к обзору
          </button>

          <div className='login-header'>
             <Link to='/welcome' className='login-logo'>
              <img src={logoSrc} alt='Логотип' onError={() => setLogoSrc(fallbackLogo)} />
            </Link>
             <h1 className='login-title'>Вход в систему</h1>
             <p className='login-subtitle'>
               Выберите роль и введите данные для входа
             </p>
           </div>

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
                <option value='student'>Студент</option>
                <option value='teacher'>Преподаватель</option>
                <option value='admin'>Администратор</option>
              </select>
              {errors.role && (
                <span className='login-error-message'>{errors.role}</span>
              )}
            </div>

            <div className='form-group'>
              <label htmlFor='login' className='form-label'>
                Логин:
              </label>
              <input
                id='login'
                type='text'
                className={`form-input ${errors.login ? 'error' : ''}`}
                value={formData.login}
                onChange={(e) => handleInputChange('login', e.target.value)}
                placeholder='Введите ваш логин'
                disabled={isLoading}
              />
              {errors.login && (
                <span className='login-error-message'>{errors.login}</span>
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
                <span className='login-error-message'>{errors.password}</span>
              )}
            </div>

            {(errors.submit || authError) && (
              <div className='form-error'>
                <span className='login-error-message'>{errors.submit || authError}</span>
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
        </div>

        <div className='login-demo'>
          <h3>Демо-доступ:</h3>
          <div className='demo-accounts'>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={`${account.role}-${account.login}`}
                type='button'
                className='demo-account'
                onClick={() => handleDemoFill(account)}
                disabled={isLoading}
              >
                <strong>{account.roleLabel}:</strong> {account.login} / {account.password}
              </button>
            ))}
          </div>
          <p className='demo-note'>
            * Нажмите на аккаунт, чтобы автоматически заполнить поля
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;