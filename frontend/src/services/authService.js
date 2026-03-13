import api from './api';

class AuthService {
  async register(userData) {
    try {
      const response = await api.post('/register', userData);
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка при регистрации';
      return { success: false, error: message };
    }
  }

  async login(identifier, password, expectedRole = null) {
    try {
      const response = await api.post('/login', {
        login: identifier,
        password,
        role: expectedRole,
      });

      const { token, user } = response.data;

      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));

      return { success: true, user };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка при входе в систему';
      return { success: false, error: message };
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
      return { success: true, user: response.data };
    } catch (error) {
      return { success: false, error: 'Ошибка загрузки профиля' };
    }
  }

  async updateProfile(updates) {
    try {
      const response = await api.put('/profile', updates);
      const user = response.data.user;
      localStorage.setItem('auth_user', JSON.stringify(user));
      return { success: true, user };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка обновления профиля';
      return { success: false, error: message };
    }
  }

  async changePassword(currentPassword, newPassword) {
    try {
      await api.put('/profile/password', {
        currentPassword,
        newPassword,
        newPasswordConfirmation: newPassword,
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка смены пароля';
      return { success: false, error: message };
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
