import { defaultAssignments, defaultSubmissions } from '../usersDatabase.js';

const studentLogin = 'student_zabiryuchenko';
const studentGroup = 'ИСП-029';
const teacherLogin = 'teacher_kartseva';

export const mockStudentAssignments = defaultAssignments.filter(assign => 
  assign.teacherLogin === teacherLogin &&
  assign.studentGroups?.includes(studentGroup)
);
export const mockStudentSubmissions = defaultSubmissions.filter(sub => sub.studentLogin === studentLogin);