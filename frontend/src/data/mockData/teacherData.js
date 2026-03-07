import { defaultAssignments, defaultSubmissions } from '../usersDatabase.js';

export const mockTeacherAssignments = defaultAssignments.filter(assign => assign.teacherLogin === 'teacher_kartseva');
export const mockTeacherSubmissions = defaultSubmissions.filter(sub => sub.teacherLogin === 'teacher_kartseva');