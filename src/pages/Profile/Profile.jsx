import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card/Card';
import Button from '../../components/UI/Button/Button';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import './Profile.scss';

const roleConfig = {
  student: {
    title: 'Личный кабинет студента',
    icon: '🎒',
    accent: '#2c5aa0',
    badge: '👨‍🎓 Студент',
    field: {
      key: 'group',
      label: 'Учебная группа',
      placeholder: 'Например, ИСП-401'
    },
    tips: [
      'Следите за актуальностью группы — она используется в фильтрах заданий',
      'Заполните контактный номер, чтобы преподаватели могли связаться с вами'
    ]
  },
  teacher: {
    title: 'Личный кабинет преподавателя',
    icon: '📚',
    accent: '#5c2cbf',
    badge: '👩‍🏫 Преподаватель',
    field: {
      key: 'department',
      label: 'Кафедра / отделение',
      placeholder: 'Например, Информатика'
    },
    tips: [
      'Актуализируйте кафедру и контакты — студенты видят их в карточках заданий',
      'Добавьте краткое описание опыта в блоке «О себе»'
    ]
  },
  admin: {
    title: 'Личный кабинет администратора',
    icon: '⚙️',
    accent: '#0f7b6c',
    badge: '🛡 Администратор',
    field: {
      key: 'department',
      label: 'Отдел / направление',
      placeholder: 'Например, Учебно-методический отдел'
    },
    tips: [
      'Рекомендуем включить все уведомления для критичных событий системы',
      'Добавляйте заметки в поле «О себе», чтобы команда знала вашу зону ответственности'
    ]
  }
};

const getInitialProfileState = (user) => ({
  name: user?.name || '',
  login: user?.login || '',
  email: user?.email || '',
  group: user?.group || '',
  department: user?.department || '',
  phone: user?.phone || '',
  timezone: user?.timezone || 'UTC+3',
  bio: user?.bio || '',
  notifications: {
    email: user?.notifications?.email ?? true,
    push: user?.notifications?.push ?? true,
    sms: user?.notifications?.sms ?? false
  }
});

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(getInitialProfileState(user));
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    } else {
      setProfileData(getInitialProfileState(user));
    }
  }, [user, navigate]);

  const currentRoleConfig = useMemo(() => roleConfig[user?.role] || roleConfig.student, [user]);

  const handleProfileChange = (field, value) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value
    }));

    if (profileErrors[field]) {
      setProfileErrors((prev) => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value
    }));

    if (passwordErrors[field]) {
      setPasswordErrors((prev) => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateProfile = () => {
    const { validateProfileForm } = require('../../utils/validation');
    const trimmedProfileData = {
      ...profileData,
      name: profileData.name?.trim() || '',
      email: profileData.email?.trim() || '',
      phone: profileData.phone?.trim() || '',
      group: profileData.group?.trim() || '',
      department: profileData.department?.trim() || '',
      bio: profileData.bio?.trim() || ''
    };
    
    const validation = validateProfileForm(trimmedProfileData);
    
    const errors = { ...validation.errors };
    
    if (!trimmedProfileData.login.trim()) {
      errors.login = 'Логин обязателен';
    }

    const extraFieldKey = currentRoleConfig.field.key;
    const extraValue = trimmedProfileData[extraFieldKey];
    if (extraFieldKey === 'group' && extraValue && !/^[А-ЯЁA-Z\-\d]+$/i.test(extraValue)) {
      errors[extraFieldKey] = 'Группа должна содержать только буквы, цифры и дефис (например, ИСП-401)';
    } else if (extraValue && extraValue.length > 100) {
      errors[extraFieldKey] = `Поле «${currentRoleConfig.field.label}» не должно превышать 100 символов`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  const validatePassword = () => {
    const errors = {};
    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Укажите текущий пароль';
    }

    if (!passwordData.newPassword) {
      errors.newPassword = 'Введите новый пароль';
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = 'Минимум 8 символов';
    } else if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/.test(passwordData.newPassword)) {
      errors.newPassword = 'Добавьте заглавные, строчные буквы и цифры';
    } else if (passwordData.newPassword === passwordData.currentPassword) {
      errors.newPassword = 'Новый пароль не должен совпадать с текущим';
    }

    if (!passwordData.confirmPassword) {
      errors.confirmPassword = 'Повторите новый пароль';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  const buildProfilePayload = () => {
    const payload = {
      name: (profileData.name || '').trim(),
      login: (profileData.login || '').trim(),
      email: (profileData.email || '').trim(),
      phone: (profileData.phone || '').trim(),
      timezone: profileData.timezone,
      bio: (profileData.bio || '').trim(),
      notifications: profileData.notifications
    };

    if (user?.role === 'student') {
      payload.group = (profileData.group || '').trim();
    } else {
      payload.department = (profileData.department || '').trim();
    }

    return payload;
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    const validation = validateProfile();
    if (!validation.isValid) {
      setProfileErrors(validation.errors);
      return;
    }

    setSavingProfile(true);
    const result = await updateProfile(buildProfilePayload());
    setSavingProfile(false);

    if (result?.success) {
      showSuccess('Профиль успешно обновлён');
      setProfileErrors({});
    } else {
      showError(result?.error || 'Не удалось сохранить профиль');
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    const validation = validatePassword();
    if (!validation.isValid) {
      setPasswordErrors(validation.errors);
      return;
    }

    setSavingPassword(true);
    const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);
    setSavingPassword(false);

    if (result?.success) {
      showSuccess('Пароль успешно изменён');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordErrors({});
    } else {
      showError(result?.error || 'Не удалось сменить пароль');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return '—';
    }
    try {
      return new Date(dateString).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const initials = useMemo(() => {
    if (!profileData.name) {
      return '👤';
    }
    return profileData.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profileData.name]);

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page">
      <div className="profile-page__container">
        <section className="profile-hero" style={{ borderColor: currentRoleConfig.accent }}>
          <div className="profile-hero__info">
            <div className="profile-avatar" style={{ color: currentRoleConfig.accent }}>
              {initials}
            </div>
            <div>
              <p className="profile-hero__badge">{currentRoleConfig.badge}</p>
              <h1>{currentRoleConfig.title}</h1>
              <p className="profile-hero__subtitle">
                {currentRoleConfig.icon} Управляйте личными данными, контактами и настройками безопасности
              </p>
              <div className="profile-hero__meta">
                <span>Логин: {profileData.login}</span>
                <span>На портале с {formatDate(user.registrationDate)}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="profile-grid">
          <Card className="profile-card profile-card--wide">
            <div className="profile-card__header">
              <div>
                <p className="profile-card__eyebrow">Основные данные</p>
                <h2>Личная информация</h2>
              </div>
              <p className="profile-card__hint">
                Данные используются в отчётности и карточках заданий. Держите их актуальными.
              </p>
            </div>

            <form className="profile-form" onSubmit={handleProfileSubmit}>
              <div className="profile-form__group">
                <label>ФИО *</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  placeholder="Полностью, как в официальных документах"
                />
                {profileErrors.name && <span className="field-error">{profileErrors.name}</span>}
              </div>

              <div className="profile-form__group">
                <label>Учётный логин *</label>
                <input
                  type="text"
                  value={profileData.login}
                  onChange={(e) => handleProfileChange('login', e.target.value)}
                  placeholder="Например, ivanov_a"
                />
                {profileErrors.login && <span className="field-error">{profileErrors.login}</span>}
              </div>

              <div className="profile-form__group">
                <label>Email *</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => handleProfileChange('email', e.target.value)}
                  placeholder="ivanov@college.ru"
                />
                {profileErrors.email && <span className="field-error">{profileErrors.email}</span>}
              </div>

              <div className="profile-form__group">
                <label>Телефон</label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => handleProfileChange('phone', e.target.value)}
                  placeholder="+7 (___) ___-__-__"
                />
                {profileErrors.phone && <span className="field-error">{profileErrors.phone}</span>}
              </div>

              <div className="profile-form__group">
                <label>{currentRoleConfig.field.label} *</label>
                <input
                  type="text"
                  value={profileData[currentRoleConfig.field.key]}
                  onChange={(e) => handleProfileChange(currentRoleConfig.field.key, e.target.value)}
                  placeholder={currentRoleConfig.field.placeholder}
                />
                {profileErrors[currentRoleConfig.field.key] && (
                  <span className="field-error">{profileErrors[currentRoleConfig.field.key]}</span>
                )}
              </div>

              <div className="profile-form__group">
                <label>Часовой пояс</label>
                <select
                  value={profileData.timezone}
                  onChange={(e) => handleProfileChange('timezone', e.target.value)}
                >
                  <option value="UTC+2">UTC+2 (Калининград)</option>
                  <option value="UTC+3">UTC+3 (Москва)</option>
                  <option value="UTC+4">UTC+4 (Самара)</option>
                  <option value="UTC+5">UTC+5 (Екатеринбург)</option>
                  <option value="UTC+7">UTC+7 (Красноярск)</option>
                </select>
              </div>

              <div className="profile-form__group profile-form__group--full">
                <label>О себе</label>
                <textarea
                  rows="4"
                  value={profileData.bio}
                  onChange={(e) => handleProfileChange('bio', e.target.value)}
                  placeholder="Коротко расскажите о себе, опыте и задачах"
                />
              </div>

              <div className="profile-form__actions">
                <Button
                  type="submit"
                  variant="primary"
                  loading={savingProfile}
                  fullWidth
                >
                  Сохранить изменения
                </Button>
              </div>
            </form>
          </Card>

          <Card className="profile-card">
            <div className="profile-card__header">
              <div>
                <p className="profile-card__eyebrow">Безопасность</p>
                <h2>Смена пароля</h2>
              </div>
            </div>

            <form className="profile-form" onSubmit={handlePasswordSubmit}>
              <div className="profile-form__group">
                <label>Текущий пароль</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                  placeholder="Введите текущий пароль"
                />
                {passwordErrors.currentPassword && (
                  <span className="field-error">{passwordErrors.currentPassword}</span>
                )}
              </div>

              <div className="profile-form__group">
                <label>Новый пароль</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  placeholder="Минимум 8 символов"
                />
                {passwordErrors.newPassword && (
                  <span className="field-error">{passwordErrors.newPassword}</span>
                )}
              </div>

              <div className="profile-form__group">
                <label>Подтверждение</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  placeholder="Повторите новый пароль"
                />
                {passwordErrors.confirmPassword && (
                  <span className="field-error">{passwordErrors.confirmPassword}</span>
                )}
              </div>

              <div className="profile-form__actions">
                <Button
                  type="submit"
                  variant="primary"
                  loading={savingPassword}
                  fullWidth
                >
                  Обновить пароль
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;

