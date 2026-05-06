import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card/Card';
import Button from '../../components/UI/Button/Button';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { DEFAULT_GRADE_SCALE, getGradeLabelForScore, normalizeGradeScale } from '../../utils';
import './Profile.scss';

const roleConfig = {
  student: {
    title: 'Личный кабинет студента',
    accent: '#2c5aa0',
    badge: 'Студент',
    tips: [
      'Учебная группа назначается администратором',
      'Заполните контактный номер, чтобы преподаватели могли связаться с вами'
    ]
  },
  teacher: {
    title: 'Личный кабинет преподавателя',
    accent: '#5c2cbf',
    badge: 'Преподаватель',
    tips: [
      'Актуализируйте контакты — студенты видят их в карточках заданий'
    ]
  },
  admin: {
    title: 'Личный кабинет администратора',
    accent: '#0f7b6c',
    badge: 'Администратор',
    tips: [
      'При необходимости включите дублирование уведомлений на email в блоке ниже'
    ]
  }
};

const getInitialProfileState = (user) => ({
  lastName: user?.lastName || '',
  firstName: user?.firstName || '',
  middleName: user?.middleName || '',
  login: user?.login || '',
  email: user?.email || '',
  phone: user?.phone || '',
  gradeScale: normalizeGradeScale(user?.gradeScale),
  notifications: {
    email: user?.notifications?.email ?? true
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

  const handleGradeScaleChange = (index, field, value) => {
    setProfileData((prev) => ({
      ...prev,
      gradeScale: prev.gradeScale.map((item, itemIndex) => (
        itemIndex === index
          ? {
            ...item,
            [field]: field === 'minScore'
              ? Number(String(value).replace(/[^\d]/g, '').slice(0, 3))
              : value,
          }
          : item
      )),
    }));

    if (profileErrors.gradeScale) {
      setProfileErrors((prev) => ({ ...prev, gradeScale: '' }));
    }
  };

  const addGradeScaleRow = () => {
    setProfileData((prev) => ({
      ...prev,
      gradeScale: [...prev.gradeScale, { label: '4+', minScore: 80 }],
    }));
  };

  const removeGradeScaleRow = (index) => {
    setProfileData((prev) => ({
      ...prev,
      gradeScale: prev.gradeScale.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const resetGradeScale = () => {
    setProfileData((prev) => ({
      ...prev,
      gradeScale: DEFAULT_GRADE_SCALE,
    }));
    setProfileErrors((prev) => ({ ...prev, gradeScale: '' }));
  };

  const validateProfile = () => {
    const { validateProfileForm } = require('../../utils/validation');
    const trimmedProfileData = {
      ...profileData,
      lastName: profileData.lastName?.trim() || '',
      firstName: profileData.firstName?.trim() || '',
      middleName: profileData.middleName?.trim() || '',
      email: profileData.email?.trim() || '',
      phone: profileData.phone?.trim() || ''
    };
    
    const validation = validateProfileForm(trimmedProfileData);
    
    const errors = { ...validation.errors };
    
    if (!trimmedProfileData.login.trim()) {
      errors.login = 'Логин обязателен';
    }

    if (user?.role === 'teacher') {
      const scaleRows = Array.isArray(profileData.gradeScale) ? profileData.gradeScale : [];
      const hasInvalidRow = scaleRows.some((item) => {
        const label = String(item?.label || '').trim();
        const minScore = Number(item?.minScore);
        return !/^[1-5][+-]?$/.test(label) || !Number.isInteger(minScore) || minScore < 0 || minScore > 100;
      });

      if (scaleRows.length === 0) {
        errors.gradeScale = 'Добавьте хотя бы один порог оценки';
      } else if (hasInvalidRow) {
        errors.gradeScale = 'Оценка должна быть от 1 до 5, можно с +/-. Порог — целое число от 0 до 100';
      }
      if (!scaleRows.some((item) => Number(item?.minScore) === 0)) {
        errors.gradeScale = 'Добавьте нижний порог от 0 баллов';
      }
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
      lastName: (profileData.lastName || '').trim(),
      firstName: (profileData.firstName || '').trim(),
      middleName: (profileData.middleName || '').trim(),
      login: (profileData.login || '').trim(),
      email: (profileData.email || '').trim(),
      phone: (profileData.phone || '').trim(),
      notifications: profileData.notifications
    };

    if (user?.role === 'teacher') {
      payload.gradeScale = normalizeGradeScale(profileData.gradeScale);
    }

    return payload;
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (savingProfile) {
      return;
    }
    const validation = validateProfile();
    if (!validation.isValid) {
      setProfileErrors(validation.errors);
      return;
    }

    setSavingProfile(true);
    try {
      const result = await updateProfile(buildProfilePayload());

      if (result?.success) {
        showSuccess('Профиль успешно обновлён');
        setProfileErrors({});
      } else {
        showError(result?.error || 'Не удалось сохранить профиль');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    if (savingPassword) {
      return;
    }
    const validation = validatePassword();
    if (!validation.isValid) {
      setPasswordErrors(validation.errors);
      return;
    }

    setSavingPassword(true);
    try {
      const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);

      if (result?.success) {
        showSuccess('Пароль успешно изменён');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setPasswordErrors({});
      } else {
        showError(result?.error || 'Не удалось сменить пароль');
      }
    } finally {
      setSavingPassword(false);
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
    const fullName = [profileData.lastName, profileData.firstName]
      .filter(Boolean)
      .join(' ');
    if (!fullName) {
      return '👤';
    }
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profileData.lastName, profileData.firstName]);

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page app-page">
      <div className="profile-page__container">
        <section
          className={`profile-hero profile-hero--${user?.role || 'student'}`}
          style={{ borderColor: currentRoleConfig.accent }}
        >
          <div className="profile-hero__info">
            <div className="profile-avatar" style={{ color: currentRoleConfig.accent }}>
              {initials}
            </div>
            <div>
              <p className="profile-hero__badge">{currentRoleConfig.badge}</p>
              <h1>{currentRoleConfig.title}</h1>
              <p className="profile-hero__subtitle">
                Управляйте личными данными, контактами и настройками безопасности
              </p>
              <div className="profile-hero__meta">
                <span>Логин: {profileData.login}</span>
                <span>На портале с {formatDate(user.registrationDate || user.createdAt)}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="profile-grid app-reveal-stagger">
          <Card className="profile-card profile-card--personal">
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
                <label>Фамилия *</label>
                <input
                  type="text"
                  value={profileData.lastName}
                  onChange={(e) => handleProfileChange('lastName', e.target.value)}
                  placeholder="Иванов"
                />
                {profileErrors.lastName && <span className="field-error">{profileErrors.lastName}</span>}
              </div>

              <div className="profile-form__group">
                <label>Имя *</label>
                <input
                  type="text"
                  value={profileData.firstName}
                  onChange={(e) => handleProfileChange('firstName', e.target.value)}
                  placeholder="Иван"
                />
                {profileErrors.firstName && <span className="field-error">{profileErrors.firstName}</span>}
              </div>

              <div className="profile-form__group">
                <label>Отчество</label>
                <input
                  type="text"
                  value={profileData.middleName}
                  onChange={(e) => handleProfileChange('middleName', e.target.value)}
                  placeholder="Иванович"
                />
                {profileErrors.middleName && <span className="field-error">{profileErrors.middleName}</span>}
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

              <div className="profile-form__group profile-form__group--full">
                <div className="profile-notification-toggle">
                  <div className="profile-notification-toggle__copy">
                    <span className="profile-notification-toggle__title" id="profile-email-notif-label">
                      Дублировать уведомления на email
                    </span>
                    <p
                      className="profile-notification-toggle__hint"
                      id="profile-email-notif-hint"
                    >
                      Письма о заданиях, сроках и проверках — на email выше. В портале колокольчик по-прежнему
                      работает.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="profile-notification-toggle__checkbox"
                    checked={profileData.notifications.email}
                    onChange={(e) =>
                      setProfileData((prev) => ({
                        ...prev,
                        notifications: { email: e.target.checked }
                      }))
                    }
                    aria-labelledby="profile-email-notif-label"
                    aria-describedby="profile-email-notif-hint"
                  />
                </div>
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

          <Card className="profile-card profile-card--password">
            <div className="profile-card__header">
              <div>
                <p className="profile-card__eyebrow">Безопасность</p>
                <h2>Смена пароля</h2>
              </div>
            </div>

            {user?.mustChangePassword && (
              <div className="profile-card__hint" style={{ marginBottom: '0.75rem', color: '#b45309' }}>
                Для вашего аккаунта установлен временный пароль. Смените его перед продолжением работы.
              </div>
            )}

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

          {user?.role === 'teacher' && (
            <Card className="profile-card profile-card--wide profile-card--grade-scale">
              <div className="profile-card__header">
                <div>
                  <p className="profile-card__eyebrow">Система оценивания</p>
                  <h2>Шкала перевода 100 баллов</h2>
                </div>
                <p className="profile-card__hint">
                  Укажите, с какого количества баллов начинается каждая оценка. Можно использовать плюс и минус: 5-, 4+, 3-.
                </p>
              </div>

              <form className="profile-form profile-grade-scale-form" onSubmit={handleProfileSubmit}>
                <div className="profile-grade-scale">
                  <div className="profile-grade-scale__preview">
                    <span>Пример:</span>
                    <strong>86 баллов = {getGradeLabelForScore(86, profileData.gradeScale) || '—'}</strong>
                  </div>

                  <div className="profile-grade-scale__rows">
                    {profileData.gradeScale.map((item, index) => (
                      <div className="profile-grade-scale__row" key={`${item.label}-${index}`}>
                        <label className="profile-grade-scale__field profile-grade-scale__field--label">
                          <span>Оценка</span>
                          <input
                            className="profile-grade-scale__input profile-grade-scale__input--label"
                            type="text"
                            value={item.label}
                            onChange={(e) => handleGradeScaleChange(index, 'label', e.target.value)}
                            placeholder="4+"
                            maxLength={3}
                          />
                        </label>
                        <label className="profile-grade-scale__field profile-grade-scale__field--score">
                          <span>От баллов</span>
                          <input
                            className="profile-grade-scale__input profile-grade-scale__input--score"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={item.minScore}
                            onChange={(e) => handleGradeScaleChange(index, 'minScore', e.target.value)}
                            placeholder="0-100"
                          />
                        </label>
                        <Button
                          type="button"
                          variant="secondary"
                          size="small"
                          className="profile-grade-scale__remove"
                          onClick={() => removeGradeScaleRow(index)}
                          disabled={profileData.gradeScale.length <= 1}
                        >
                          Убрать
                        </Button>
                      </div>
                    ))}
                  </div>

                  {profileErrors.gradeScale && <span className="field-error">{profileErrors.gradeScale}</span>}

                  <div className="profile-grade-scale__actions">
                    <Button type="button" variant="secondary" onClick={addGradeScaleRow}>
                      Добавить порог
                    </Button>
                    <Button type="button" variant="secondary" onClick={resetGradeScale}>
                      Вернуть стандартную шкалу
                    </Button>
                    <Button type="submit" variant="primary" loading={savingProfile}>
                      Сохранить шкалу
                    </Button>
                  </div>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;

