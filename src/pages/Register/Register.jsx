import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateRegisterForm } from '../../utils/validation';
import './Register.scss';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    login: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    group: '',
    department: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(`/${user.role}`);
    }
  }, [user, navigate]);

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

  const handleRegister = async (e) => {
    e.preventDefault();

    const validation = validateRegisterForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors({ 
        confirmPassword: 'Пароли не совпадают' 
      });
      return;
    }

    setIsLoading(true);

    try {
      const userData = {
        name: formData.name.trim(),
        login: formData.login.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        ...(formData.role === 'student' && formData.group ? { group: formData.group.trim() } : {}),
        ...(formData.role !== 'student' && formData.department ? { department: formData.department.trim() } : {})
      };

      const result = await register(userData);
      
      if (result.success) {
        setIsLoading(false);
        navigate('/login', { replace: true, state: { registered: true } });
      } else {
        setErrors({ 
          submit: result.error || 'Ошибка регистрации. Попробуйте еще раз.' 
        });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Register error:', error);
      setErrors({ 
        submit: 'Произошла ошибка при регистрации. Попробуйте еще раз.' 
      });
      setIsLoading(false);
    }
  };

  const handleBackToWelcome = () => {
    navigate('/welcome');
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  return (
    <div className='register-page'>
      <div className='register-container'>
        <button className='back-button' onClick={handleBackToWelcome}>
          ← Назад к обзору
        </button>

        <div className='register-header'>
          <div className='register-logo'>🎓</div>
          <h1 className='register-title'>Регистрация</h1>
          <p className='register-subtitle'>
            Создайте новый аккаунт для доступа к системе
          </p>
        </div>

        <form className='register-form' onSubmit={handleRegister} noValidate>
          <div className='form-group'>
            <label htmlFor='name' className='form-label'>
              ФИО: *
            </label>
            <input
              id='name'
              type='text'
              className={`form-input ${errors.name ? 'error' : ''}`}
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder='Введите ваше полное имя'
              disabled={isLoading}
            />
            {errors.name && (
              <span className='error-message'>{errors.name}</span>
            )}
          </div>

          <div className='form-group'>
            <label htmlFor='login' className='form-label'>
              Логин: *
            </label>
            <input
              id='login'
              type='text'
              className={`form-input ${errors.login ? 'error' : ''}`}
              value={formData.login}
              onChange={(e) => handleInputChange('login', e.target.value)}
              placeholder='Введите логин (латинские буквы, цифры, подчеркивание)'
              disabled={isLoading}
            />
            {errors.login && (
              <span className='error-message'>{errors.login}</span>
            )}
          </div>

          <div className='form-group'>
            <label htmlFor='email' className='form-label'>
              Email: *
            </label>
            <input
              id='email'
              type='email'
              className={`form-input ${errors.email ? 'error' : ''}`}
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder='Введите ваш email'
              disabled={isLoading}
            />
            {errors.email && (
              <span className='error-message'>{errors.email}</span>
            )}
          </div>


          {formData.role === 'student' ? (
            <div className='form-group'>
              <label htmlFor='group' className='form-label'>
                Группа: *
              </label>
              <input
                id='group'
                type='text'
                className={`form-input ${errors.group ? 'error' : ''}`}
                value={formData.group}
                onChange={(e) => handleInputChange('group', e.target.value)}
                placeholder='Введите номер группы (например, ИСП-401)'
                disabled={isLoading}
                required
              />
              {errors.group && (
                <span className='error-message'>{errors.group}</span>
              )}
            </div>
          ) : (
            <div className='form-group'>
              <label htmlFor='department' className='form-label'>
                Кафедра: *
              </label>
              <input
                id='department'
                type='text'
                className={`form-input ${errors.department ? 'error' : ''}`}
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                placeholder='Введите название кафедры'
                disabled={isLoading}
                required
              />
              {errors.department && (
                <span className='error-message'>{errors.department}</span>
              )}
            </div>
          )}

          <div className='form-group'>
            <label htmlFor='password' className='form-label'>
              Пароль: *
            </label>
            <input
              id='password'
              type='password'
              className={`form-input ${errors.password ? 'error' : ''}`}
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder='Минимум 8 символов'
              disabled={isLoading}
            />
            {errors.password && (
              <span className='error-message'>{errors.password}</span>
            )}
          </div>

          <div className='form-group'>
            <label htmlFor='confirmPassword' className='form-label'>
              Подтверждение пароля: *
            </label>
            <input
              id='confirmPassword'
              type='password'
              className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              placeholder='Повторите пароль'
              disabled={isLoading}
            />
            {errors.confirmPassword && (
              <span className='error-message'>{errors.confirmPassword}</span>
            )}
          </div>

          {errors.submit && (
            <div className='form-error'>
              <span className='error-message'>{errors.submit}</span>
            </div>
          )}

          <button
            type='submit'
            className={`register-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className='spinner'></div>
                Регистрация...
              </>
            ) : (
              'Зарегистрироваться'
            )}
          </button>
        </form>

        <div className='register-links'>
          <p>
            Уже есть аккаунт?{' '}
            <button 
              className='link-button' 
              onClick={handleGoToLogin}
              disabled={isLoading}
            >
              Войти в систему
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

