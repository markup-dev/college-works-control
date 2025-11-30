import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { readFromStorage, writeToStorage, generateId, STORAGE_KEYS } from '../utils/storageUtils';
import userService from '../services/userService';


const SHARED_ASSIGNMENTS_KEY = STORAGE_KEYS.ASSIGNMENTS;
const SHARED_SUBMISSIONS_KEY = STORAGE_KEYS.SUBMISSIONS;
const DEFAULT_TEACHER_LOGIN = 'teacher_kartseva';
const DEFAULT_TEACHER_NAME = 'Карцева Мария Сергеевна';

const TeacherContext = createContext();

export const useTeacher = () => {
  const context = useContext(TeacherContext);
  if (!context) {
    throw new Error('useTeacher must be used within a TeacherProvider');
  }
  return context;
};

export const TeacherProvider = ({ children }) => {
  const [allTeacherAssignments, setAllTeacherAssignments] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const teacherLogin = user?.login;
  const teacherName = user?.name;

  const resolveOwnerLogin = useCallback(
    (login) => login || DEFAULT_TEACHER_LOGIN,
    []
  );

  const belongsToCurrentTeacher = useCallback(
    (login) => {
      const targetLogin = teacherLogin || DEFAULT_TEACHER_LOGIN;
      return resolveOwnerLogin(login) === targetLogin;
    },
    [teacherLogin, resolveOwnerLogin]
  );

  const normalizeAssignments = useCallback(
    (assignments) =>
      assignments.map((assignment) => ({
        ...assignment,
        teacherLogin: resolveOwnerLogin(assignment.teacherLogin),
        teacherName: assignment.teacherName || DEFAULT_TEACHER_NAME,
      })),
    [resolveOwnerLogin]
  );

  const normalizeSubmissions = useCallback(
    (submissions, assignments) => {
      const allUsers = userService.getAllUsers();
      
      return submissions.map((submission) => {
        const subAssignId = typeof submission.assignmentId === 'number' ? submission.assignmentId : parseInt(submission.assignmentId, 10);
        const assignment = assignments.find(a => {
          const assignId = typeof a.id === 'number' ? a.id : parseInt(a.id, 10);
          return assignId === subAssignId;
        });
        
        let studentName = submission.studentName;
        let studentGroup = submission.group;
        if (submission.studentId) {
          const studentId = typeof submission.studentId === 'number' 
            ? submission.studentId 
            : parseInt(submission.studentId, 10);
          const student = allUsers.find(u => {
            const userId = typeof u.id === 'number' ? u.id : parseInt(u.id, 10);
            return userId === studentId && u.role === 'student';
          });
          if (student) {
            if (student.name) {
              studentName = student.name;
            }
            if (student.group) {
              studentGroup = student.group;
            }
          }
        }
        
        return {
          ...submission,
          teacherLogin: resolveOwnerLogin(submission.teacherLogin),
          assignmentTitle: assignment ? assignment.title : 'Неизвестно',
          assignmentCourse: assignment ? assignment.course : '',
          maxScore: assignment ? assignment.maxScore : 100,
          studentName: studentName || submission.studentName,
          group: studentGroup || submission.group
        };
      });
    },
    [resolveOwnerLogin]
  );

  const loadTeacherData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const storedAssignments = readFromStorage(SHARED_ASSIGNMENTS_KEY, []);
      const storedSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, []);

      const normalizedAssignments = normalizeAssignments(storedAssignments);
      const normalizedSubmissions = normalizeSubmissions(storedSubmissions, normalizedAssignments);

      setAllTeacherAssignments(normalizedAssignments);
      setAllSubmissions(normalizedSubmissions);
    } catch (err) {
      setError('Ошибка загрузки данных преподавателя');
    } finally {
      setLoading(false);
    }
  }, [normalizeAssignments, normalizeSubmissions]);

  const loadTeacherAssignments = useCallback(async () => {
    return loadTeacherData();
  }, [loadTeacherData]);

  const loadTeacherSubmissions = useCallback(async () => {
    return loadTeacherData();
  }, [loadTeacherData]);

  const gradeSubmission = useCallback(async (submissionId, score, comment) => {
    setLoading(true);
    try {
      const currentSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, []);
      const subIdNum = typeof submissionId === 'number' ? submissionId : parseInt(submissionId, 10);
      const updated = currentSubmissions.map(submission => {
        const idNum = typeof submission.id === 'number' ? submission.id : parseInt(submission.id, 10);
        return idNum === subIdNum
          ? { ...submission, status: 'graded', score: parseInt(score, 10), comment }
          : submission;
      });
      writeToStorage(SHARED_SUBMISSIONS_KEY, updated);

      const currentAssignments = readFromStorage(SHARED_ASSIGNMENTS_KEY, []);
      const updatedAssignments = currentAssignments.map(assignment => {
        const assignIdNum = typeof assignment.id === 'number' ? assignment.id : parseInt(assignment.id, 10);
        const assignmentSubmissions = updated.filter(sub => {
          const subAssignId = typeof sub.assignmentId === 'number' ? sub.assignmentId : parseInt(sub.assignmentId, 10);
          return subAssignId === assignIdNum;
        });
        const pendingCount = assignmentSubmissions.filter(sub =>
          sub.status === 'submitted'
        ).length;
        return {
          ...assignment,
          submissionsCount: assignmentSubmissions.length,
          pendingCount
        };
      });
      writeToStorage(SHARED_ASSIGNMENTS_KEY, updatedAssignments);

      const normalizedAssignments = normalizeAssignments(updatedAssignments);
      const normalizedSubmissions = normalizeSubmissions(updated, normalizedAssignments);
      setAllTeacherAssignments(normalizedAssignments);
      setAllSubmissions(normalizedSubmissions);

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при оценке работы' };
    } finally {
      setLoading(false);
    }
  }, [normalizeAssignments, normalizeSubmissions]);

  const returnSubmission = useCallback(async (submissionId, comment) => {
    setLoading(true);
    try {
      const currentSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, []);
      const subIdNum = typeof submissionId === 'number' ? submissionId : parseInt(submissionId, 10);
      const updated = currentSubmissions.map(submission => {
        const idNum = typeof submission.id === 'number' ? submission.id : parseInt(submission.id, 10);
        return idNum === subIdNum
          ? { ...submission, status: 'returned', comment }
          : submission;
      });
      writeToStorage(SHARED_SUBMISSIONS_KEY, updated);

      const currentAssignments = readFromStorage(SHARED_ASSIGNMENTS_KEY, []);
      const updatedAssignments = currentAssignments.map(assignment => {
        const assignIdNum = typeof assignment.id === 'number' ? assignment.id : parseInt(assignment.id, 10);
        const assignmentSubmissions = updated.filter(sub => {
          const subAssignId = typeof sub.assignmentId === 'number' ? sub.assignmentId : parseInt(sub.assignmentId, 10);
          return subAssignId === assignIdNum;
        });
        const pendingCount = assignmentSubmissions.filter(sub =>
          sub.status === 'submitted'
        ).length;
        return {
          ...assignment,
          submissionsCount: assignmentSubmissions.length,
          pendingCount
        };
      });
      writeToStorage(SHARED_ASSIGNMENTS_KEY, updatedAssignments);

      const normalizedAssignments = normalizeAssignments(updatedAssignments);
      const normalizedSubmissions = normalizeSubmissions(updated, normalizedAssignments);
      setAllTeacherAssignments(normalizedAssignments);
      setAllSubmissions(normalizedSubmissions);

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при возврате работы' };
    } finally {
      setLoading(false);
    }
  }, [normalizeAssignments, normalizeSubmissions]);

  const createAssignment = useCallback(async (assignmentData) => {
    setLoading(true);
    try {
      const studentGroups = assignmentData.studentGroups || 
        (assignmentData.group && assignmentData.group !== 'Все группы' ? [assignmentData.group] : []);
      
      const currentAssignments = readFromStorage(SHARED_ASSIGNMENTS_KEY, []);
      
      const newAssignment = {
        id: generateId(),
        title: assignmentData.title || '',
        course: assignmentData.course || '',
        description: assignmentData.description || '',
        deadline: assignmentData.deadline || '',
        maxScore: assignmentData.maxScore || 100,
        submissionType: assignmentData.submissionType || 'file',
        criteria: assignmentData.criteria || [],
        studentsCount: assignmentData.studentsCount || 0,
        submissionsCount: 0,
        pendingCount: 0,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
        submissions: [],
        studentGroups: Array.isArray(studentGroups) ? studentGroups : (studentGroups ? [studentGroups] : []),
        priority: assignmentData.priority || 'medium',
        teacherLogin: resolveOwnerLogin(teacherLogin),
        teacherName: teacherName || assignmentData.teacherName || DEFAULT_TEACHER_NAME,
        allowedFormats: assignmentData.allowedFormats,
        maxFileSize: assignmentData.maxFileSize
      };

      const updated = [...currentAssignments, newAssignment];
      
      const saved = writeToStorage(SHARED_ASSIGNMENTS_KEY, updated);
      if (!saved) {
        throw new Error('Failed to save assignment');
      }
      
      const normalizedAssignments = normalizeAssignments(updated);
      const currentSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, []);
      const normalizedSubmissions = normalizeSubmissions(currentSubmissions, normalizedAssignments);
      
      setAllTeacherAssignments(normalizedAssignments);
      setAllSubmissions(normalizedSubmissions);
      
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при создании задания' };
    } finally {
      setLoading(false);
    }
  }, [resolveOwnerLogin, teacherLogin, teacherName, normalizeAssignments, normalizeSubmissions]);

  const updateAssignment = useCallback(async (assignmentId, updates) => {
    setLoading(true);
    try {
      const currentAssignments = readFromStorage(SHARED_ASSIGNMENTS_KEY, []);
      const assignIdNum = typeof assignmentId === 'number' ? assignmentId : parseInt(assignmentId, 10);
      const updated = currentAssignments.map(assignment => {
        const idNum = typeof assignment.id === 'number' ? assignment.id : parseInt(assignment.id, 10);
        return idNum === assignIdNum ? { ...assignment, ...updates } : assignment;
      });
      writeToStorage(SHARED_ASSIGNMENTS_KEY, updated);
      
      const normalizedAssignments = normalizeAssignments(updated);
      setAllTeacherAssignments(normalizedAssignments);
      
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при обновлении задания' };
    } finally {
      setLoading(false);
    }
  }, [normalizeAssignments]);

  const deleteAssignment = useCallback(async (assignmentId) => {
    setLoading(true);
    try {
      const currentAssignments = readFromStorage(SHARED_ASSIGNMENTS_KEY, []);
      const assignIdNum = typeof assignmentId === 'number' ? assignmentId : parseInt(assignmentId, 10);
      const updatedAssignments = currentAssignments.filter(assignment => {
        const idNum = typeof assignment.id === 'number' ? assignment.id : parseInt(assignment.id, 10);
        return idNum !== assignIdNum;
      });
      writeToStorage(SHARED_ASSIGNMENTS_KEY, updatedAssignments);

      const currentSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, []);
      const updatedSubmissions = currentSubmissions.filter(submission => {
        const subAssignId = typeof submission.assignmentId === 'number' ? submission.assignmentId : parseInt(submission.assignmentId, 10);
        return subAssignId !== assignIdNum;
      });
      writeToStorage(SHARED_SUBMISSIONS_KEY, updatedSubmissions);

      const normalizedAssignments = normalizeAssignments(updatedAssignments);
      const normalizedSubmissions = normalizeSubmissions(updatedSubmissions, normalizedAssignments);
      setAllTeacherAssignments(normalizedAssignments);
      setAllSubmissions(normalizedSubmissions);

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при удалении задания' };
    } finally {
      setLoading(false);
    }
  }, [normalizeAssignments, normalizeSubmissions]);

  const teacherAssignments = useMemo(() => {
    return allTeacherAssignments.filter(assignment => belongsToCurrentTeacher(assignment.teacherLogin));
  }, [allTeacherAssignments, belongsToCurrentTeacher]);

  const teacherSubmissions = useMemo(() => {
    return allSubmissions.filter(sub => belongsToCurrentTeacher(sub.teacherLogin));
  }, [allSubmissions, belongsToCurrentTeacher]);

  const assignmentsWithSubmissions = useMemo(() => {
    return teacherAssignments.map(assignment => {
      const assignIdNum = typeof assignment.id === 'number' ? assignment.id : parseInt(assignment.id, 10);
      const assignmentSubmissions = teacherSubmissions.filter(sub => {
        const subAssignId = typeof sub.assignmentId === 'number' ? sub.assignmentId : parseInt(sub.assignmentId, 10);
        return subAssignId === assignIdNum;
      });
      const pendingCount = assignmentSubmissions.filter(sub =>
        sub.status === 'submitted'
      ).length;

      return {
        ...assignment,
        submissions: assignmentSubmissions,
        submissionsCount: assignmentSubmissions.length,
        pendingCount
      };
    });
  }, [teacherAssignments, teacherSubmissions]);

  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user, loadTeacherData]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const handleStorageChange = (e) => {
      const eventKey = e.detail?.key || e.key;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        if (isMounted && (eventKey === SHARED_ASSIGNMENTS_KEY || eventKey === SHARED_SUBMISSIONS_KEY)) {
          loadTeacherData();
        }
      }, 100);
    };

    window.addEventListener('storageChange', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('storageChange', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadTeacherData]);

  const value = {
    teacherAssignments: assignmentsWithSubmissions,
    submissions: teacherSubmissions,
    loading,
    error,
    loadTeacherAssignments,
    loadTeacherSubmissions,
    gradeSubmission,
    returnSubmission,
    createAssignment,
    updateAssignment,
    deleteAssignment,
  };

  return <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>;
};
