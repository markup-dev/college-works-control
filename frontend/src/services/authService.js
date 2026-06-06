import api from './api';
import { getApiErrorMessage } from '../utils/adminApiErrors';

const normalizeUser = (user) => {
  if (!user) return user;
  const notificationSettings = user.notificationSettings ?? user.notifications ?? { email: true };
  const fullName = [user.lastName, user.firstName, user.middleName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return {
    ...user,
    notificationSettings,
    fullName,
    group: user.group || user.studentGroup?.name || '',
    registrationDate: user.registrationDate || user.createdAt || '',
  };
};

class AuthService {
  async login(identifier, password, expectedRole = null) {
    try {
      const response = await api.post('/login', {
        login: identifier,
        password,
        role: expectedRole,
      });

      const { token } = response.data;
      const user = normalizeUser(response.data.user);

      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));

      return { success: true, user };
    } catch (error) {
      return { success: false, error: getApiErrorMessage(error, 'Ошибка при входе в систему') };
    }
  }

  async logout() {
    try {
      await api.post('/logout');
    } catch {
      // Даже при ошибке сети очищаем локальное состояние
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
    return { success: true };
  }

  async getProfile() {
    try {
      const response = await api.get('/profile');
      return { success: true, user: normalizeUser(response.data) };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки профиля' };
    }
  }

  async updateProfile(updates) {
    try {
      const response = await api.put('/profile', updates);
      const user = normalizeUser(response.data.user);
      localStorage.setItem('auth_user', JSON.stringify(user));
      return { success: true, user };
    } catch (error) {
      return { success: false, error: getApiErrorMessage(error, 'Ошибка обновления профиля') };
    }
  }

  async changePassword(currentPassword, newPassword) {
    try {
      const response = await api.put('/profile/password', {
        currentPassword,
        newPassword,
        newPasswordConfirmation: newPassword,
      });

      const userFromResponse = response?.data?.user;
      if (userFromResponse) {
        const normalizedUser = normalizeUser(userFromResponse);
        localStorage.setItem('auth_user', JSON.stringify(normalizedUser));
        return { success: true, user: normalizedUser };
      }

      const profileResult = await this.getProfile();
      if (profileResult.success && profileResult.user) {
        localStorage.setItem('auth_user', JSON.stringify(profileResult.user));
        return { success: true, user: profileResult.user };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: getApiErrorMessage(error, 'Ошибка смены пароля') };
    }
  }

  getCurrentUser() {
    try {
      const stored = localStorage.getItem('auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  getToken() {
    return localStorage.getItem('auth_token');
  }

  isAuthenticated() {
    return !!this.getToken();
  }
}

const authService = new AuthService();
export default authService;
