import bcrypt from 'bcryptjs';
import userService from './userService.js';

class AuthService {
  constructor() {
    this.currentUser = userService.getCurrentUser();
  }

  async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  async register(userData) {
    try {
      const existingUser = userService.findByLoginOrEmail(userData.login) || 
                          userService.findByLoginOrEmail(userData.email);

      if (existingUser) {
        return {
          success: false,
          error: existingUser.login === userData.login 
            ? 'Пользователь с таким логином уже существует'
            : 'Пользователь с таким email уже существует'
        };
      }

      const passwordHash = await this.hashPassword(userData.password);

      const newUser = {
        ...userData,
        passwordHash,
        id: Date.now(),
        isActive: true,
        registrationDate: new Date().toISOString().split('T')[0],
        lastLogin: null,
        notifications: userData.notifications || { email: true, push: true, sms: false },
        theme: userData.theme || 'system'
      };

      const createdUser = userService.createUser(newUser);

      return {
        success: true,
        user: createdUser
      };
    } catch (error) {
      return {
        success: false,
        error: 'Ошибка при регистрации'
      };
    }
  }

  async login(identifier, password, expectedRole = null) {
    try {
      const demoPassword = 'Password123';
      
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
          error: `Этот аккаунт не является ${this.getRoleName(expectedRole)}`
        };
      }

      let passwordValid = false;
      
      if (user.passwordHash) {
        passwordValid = await this.comparePassword(password, user.passwordHash);
      } else if (user.password === demoPassword || user.password === password) {
        passwordValid = true;
        const passwordHash = await this.hashPassword(password);
        userService.updateUser(user.id, { passwordHash });
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

      this.currentUser = updatedUser;
      userService.setCurrentUser(updatedUser);

      return {
        success: true,
        user: updatedUser
      };
    } catch (error) {
      return {
        success: false,
        error: 'Ошибка при входе в систему'
      };
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

  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = userService.findByLoginOrEmail(userService.getUserById(userId)?.login);
      
      if (!user) {
        return { success: false, error: 'Пользователь не найден' };
      }

      let passwordValid = false;
      const demoPassword = 'Password123';

      if (user.passwordHash) {
        passwordValid = await this.comparePassword(currentPassword, user.passwordHash);
      } else if (user.password === demoPassword || user.password === currentPassword) {
        passwordValid = true;
      }
      
      if (!passwordValid) {
        return { success: false, error: 'Текущий пароль указан неверно' };
      }

      const passwordHash = await this.hashPassword(newPassword);
      userService.updateUser(userId, { passwordHash });

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Ошибка при смене пароля' };
    }
  }

  getRoleName(role) {
    const roles = {
      student: 'студентом',
      teacher: 'преподавателем',
      admin: 'администратором'
    };
    return roles[role] || 'пользователем';
  }
}

const authService = new AuthService();
export default authService;