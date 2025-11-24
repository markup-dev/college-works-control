// src/services/authService.js
import bcrypt from 'bcryptjs';
import userService from './userService';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, password, ...safeUser } = user;
  return safeUser;
};

class AuthService {
  constructor() {
    this.currentUser = userService.getCurrentUser();
  }

  async hashPassword(password) {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  async register(userData) {
    try {
      const existingUser = userService
        .getAllUsers()
        .find(
          (user) =>
            user.login === userData.login || user.email === userData.email
        );

      if (existingUser) {
        return {
          success: false,
          error:
            existingUser.login === userData.login
              ? 'Пользователь с таким логином уже существует'
              : 'Пользователь с таким email уже существует'
        };
      }

      const passwordHash = await this.hashPassword(userData.password);
      const { password, ...userDataWithoutPassword } = userData;
      const defaultNotifications = {
        email: true,
        push: true,
        sms: false
      };

      const newUser = {
        id: Date.now(),
        ...userDataWithoutPassword,
        phone: userDataWithoutPassword.phone || '',
        timezone: userDataWithoutPassword.timezone || 'UTC+3',
        bio: userDataWithoutPassword.bio || '',
        notifications:
          userDataWithoutPassword.notifications || defaultNotifications,
        theme: userDataWithoutPassword.theme || 'system',
        passwordHash,
        isActive: true,
        registrationDate: new Date().toISOString().split('T')[0],
        lastLogin: null
      };

      userService.createUser(newUser);

      return {
        success: true,
        user: sanitizeUser(newUser)
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Ошибка при регистрации'
      };
    }
  }

  async login(identifier, password, expectedRole) {
    try {
      const user = userService.findByLoginOrEmail(identifier);

      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'Неверный логин/email или пароль'
        };
      }

      if (expectedRole && user.role !== expectedRole) {
        return {
          success: false,
          error: 'Вы выбрали неверную роль для этого аккаунта'
        };
      }

      let passwordValid = false;
      if (user.passwordHash) {
        passwordValid = await this.comparePassword(password, user.passwordHash);
      } else if (user.password) {
        if (user.password === password) {
          passwordValid = true;
          const passwordHash = await this.hashPassword(password);
          userService.updateUser(user.id, { passwordHash });
        }
      }

      if (!passwordValid) {
        return {
          success: false,
          error: 'Неверный логин/email или пароль'
        };
      }

      const updatedUser = userService.updateUser(user.id, {
        lastLogin: new Date().toISOString()
      });
      const safeUser = sanitizeUser(updatedUser);
      this.currentUser = safeUser;
      userService.setCurrentUser(safeUser);

      return {
        success: true,
        user: safeUser
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Ошибка при входе в систему'
      };
    }
  }

  async updateUser(userId, updates) {
    try {
      const allUsers = userService.getAllUsers();
      const userExists = allUsers.some((user) => user.id === userId);
      if (!userExists) {
        return { success: false, error: 'Пользователь не найден' };
      }

      if (updates.login) {
        const loginExists = allUsers.some(
          (user) => user.login === updates.login && user.id !== userId
        );
        if (loginExists) {
          return {
            success: false,
            error: 'Пользователь с таким логином уже существует'
          };
        }
      }

      if (updates.email) {
        const emailExists = allUsers.some(
          (user) => user.email === updates.email && user.id !== userId
        );
        if (emailExists) {
          return {
            success: false,
            error: 'Пользователь с таким email уже существует'
          };
        }
      }

      const payload = { ...updates };

      if (updates.password) {
        payload.passwordHash = await this.hashPassword(updates.password);
        delete payload.password;
      }

      const updatedUser = userService.updateUser(userId, payload);
      if (!updatedUser) {
        return { success: false, error: 'Не удалось обновить пользователя' };
      }

      const safeUser = sanitizeUser(updatedUser);
      if (this.currentUser?.id === userId) {
        this.currentUser = safeUser;
        userService.setCurrentUser(safeUser);
      }

      return { success: true, user: safeUser };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: 'Ошибка обновления пользователя' };
    }
  }

  deleteUser(userId) {
    try {
      const removedUser = userService.deleteUser(userId);
      if (!removedUser) {
        return { success: false, error: 'Пользователь не найден' };
      }

      if (this.currentUser?.id === userId) {
        this.logout();
      }

      return { success: true, user: sanitizeUser(removedUser) };
    } catch (error) {
      console.error('Delete user error:', error);
      return { success: false, error: 'Ошибка удаления пользователя' };
    }
  }

  logout() {
    this.currentUser = null;
    userService.clearCurrentUser();
    return { success: true };
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getCurrentUser() {
    if (this.currentUser) {
      return this.currentUser;
    }
    const stored = userService.getCurrentUser();
    this.currentUser = stored;
    return stored;
  }

  getAllUsers() {
    return userService
      .getAllUsers()
      .map((user) => sanitizeUser(user));
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = userService.getUserById(userId);
      if (!user) {
        return { success: false, error: 'Пользователь не найден' };
      }

      let passwordValid = false;
      if (user.passwordHash) {
        passwordValid = await this.comparePassword(
          currentPassword,
          user.passwordHash
        );
      } else if (user.password) {
        passwordValid = user.password === currentPassword;
      }

      if (!passwordValid) {
        return { success: false, error: 'Текущий пароль указан неверно' };
      }

      const passwordHash = await this.hashPassword(newPassword);
      const updatedUser = userService.updateUser(userId, { passwordHash });

      if (this.currentUser?.id === userId) {
        const safeUser = sanitizeUser(updatedUser);
        this.currentUser = safeUser;
        userService.setCurrentUser(safeUser);
      }

      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: 'Ошибка при смене пароля' };
    }
  }
}

const authService = new AuthService();
export default authService;