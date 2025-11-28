import collegeDatabase from '../data/usersDatabase.js';

const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, password, ...safeUser } = user;
  return safeUser;
};

class UserService {
  getAllUsers() {
    return collegeDatabase.getUsers().map(user => sanitizeUser(user));
  }

  getUserById(userId) {
    const user = collegeDatabase.getUserById(userId);
    return sanitizeUser(user);
  }

  findByLoginOrEmail(identifier) {
    const user = collegeDatabase.getUserByLoginOrEmail(identifier);
    return user ? { ...user } : null;
  }

  createUser(userData) {
    const user = collegeDatabase.addUser(userData);
    return sanitizeUser(user);
  }

  updateUser(userId, updates) {
    const user = collegeDatabase.updateUser(userId, updates);
    return sanitizeUser(user);
  }

  deleteUser(userId) {
    const user = collegeDatabase.deleteUser(userId);
    return sanitizeUser(user);
  }

  setCurrentUser(user) {
    collegeDatabase.setCurrentUser(sanitizeUser(user));
  }

  getCurrentUser() {
    return collegeDatabase.getCurrentUser();
  }

  clearCurrentUser() {
    collegeDatabase.clearCurrentUser();
  }

  getStudentsByTeacher(teacherLogin) {
    const students = collegeDatabase.getStudentsByTeacher(teacherLogin);
    return students.map(student => sanitizeUser(student));
  }

  getTeacherByStudent(studentLogin) {
    const teacher = collegeDatabase.getTeacherByStudent(studentLogin);
    return sanitizeUser(teacher);
  }

  searchUsers(query) {
    const users = collegeDatabase.getUsers();
    const searchTerm = query.toLowerCase();
    
    return users
      .filter(user => 
        user.name.toLowerCase().includes(searchTerm) ||
        user.login.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm)
      )
      .map(user => sanitizeUser(user));
  }
}

const userService = new UserService();
export default userService;