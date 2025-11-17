// src/services/userService.js
import usersDatabase from '../data/usersDatabase';

class UserService {
  getAllUsers() {
    return usersDatabase.getUsers();
  }

  getUserById(userId) {
    return usersDatabase.getUserById(userId);
  }

  findByLoginOrEmail(identifier) {
    return usersDatabase.getUserByLoginOrEmail(identifier);
  }

  createUser(userData) {
    return usersDatabase.addUser(userData);
  }

  updateUser(userId, updates) {
    return usersDatabase.updateUser(userId, updates);
  }

  deleteUser(userId) {
    return usersDatabase.deleteUser(userId);
  }

  setCurrentUser(user) {
    usersDatabase.setCurrentUser(user);
  }

  getCurrentUser() {
    return usersDatabase.getCurrentUser();
  }

  clearCurrentUser() {
    usersDatabase.clearCurrentUser();
  }
}

const userService = new UserService();

export default userService;

