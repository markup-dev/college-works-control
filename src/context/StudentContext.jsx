import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { readFromStorage, writeToStorage, generateId, STORAGE_KEYS, normalizeGroup } from '../utils/storageUtils';

const SHARED_ASSIGNMENTS_KEY = STORAGE_KEYS.ASSIGNMENTS;
const SHARED_SUBMISSIONS_KEY = STORAGE_KEYS.SUBMISSIONS;

const StudentContext = createContext();

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
};

export const StudentProvider = ({ children }) => {
  const [assignments, setAssignments] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const loadStudentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const storedAssignments = readFromStorage(SHARED_ASSIGNMENTS_KEY, []);
      const storedSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, []);
      const storedUsers = readFromStorage(STORAGE_KEYS.USERS, []);

      const studentGroup = normalizeGroup(user?.group);
      const studentTeacherLogin = user?.teacherLogin;
        
      const getTeacherName = (teacherLogin) => {
        if (!teacherLogin) return 'Не указан';
        
        const teacher = storedUsers.find(u => u.login === teacherLogin && u.role === 'teacher');
        return teacher?.name || 'Не указан';
      };
      
      const filteredAssignments = storedAssignments.filter(assignment => {
        if (assignment.teacherLogin) {
          if (studentTeacherLogin && assignment.teacherLogin !== studentTeacherLogin) {
            return false;
          }
          if (!studentTeacherLogin) {
            return false;
          }
        }
        
        const assignmentGroups = Array.isArray(assignment.studentGroups) && assignment.studentGroups.length > 0
          ? assignment.studentGroups
          : [];

        if (assignmentGroups.length === 0) {
          return false;
        }
        
        if (!studentGroup) {
          return false;
        }
        
        const normalizedGroups = assignmentGroups.map(group => normalizeGroup(group));
        const includesGroup = normalizedGroups.includes(studentGroup);
        
        return includesGroup;
      }).map(assignment => {
        const studentSubmissions = storedSubmissions.filter(sub => {
          const subStudentId = typeof sub.studentId === 'number' ? sub.studentId : (typeof sub.studentId === 'string' ? parseInt(sub.studentId, 10) : null);
          const userId = typeof user?.id === 'number' ? user.id : (typeof user?.id === 'string' ? parseInt(user.id, 10) : null);
          const assignmentIdMatch = typeof sub.assignmentId === 'number' 
            ? sub.assignmentId === assignment.id 
            : (typeof sub.assignmentId === 'string' && typeof assignment.id === 'number'
              ? parseInt(sub.assignmentId, 10) === assignment.id
              : sub.assignmentId === String(assignment.id));
          
          return assignmentIdMatch && subStudentId === userId;
        });
        
        const studentSubmission = studentSubmissions.sort((a, b) => {
          const dateA = new Date(a.submissionDate || 0);
          const dateB = new Date(b.submissionDate || 0);
          return dateB - dateA;
        })[0];
        
        let status = 'not_submitted';
        if (studentSubmission) {
          if (studentSubmission.status === 'graded') {
            status = 'graded';
          } else if (studentSubmission.status === 'returned') {
            status = 'returned';
          } else {
            status = 'submitted';
          }
        }
        
        // Получаем имя преподавателя: сначала из задания, затем из базы пользователей
        const teacherName = assignment.teacherName || assignment.teacher || getTeacherName(assignment.teacherLogin);
        
        return {
          ...assignment,
          status,
          teacher: teacherName,
          submittedAt: studentSubmission?.submissionDate,
          score: studentSubmission?.score,
          maxScore: studentSubmission?.maxScore || assignment.maxScore
        };
      });
      
      setAssignments(filteredAssignments);
      setStudentSubmissions(storedSubmissions);
    } catch (err) {
      setError('Ошибка загрузки данных студента');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadStudentAssignments = useCallback(async () => {
    return loadStudentData();
  }, [loadStudentData]);

  const submitWork = useCallback(async (assignmentId, file) => {
    setLoading(true);
    try {
      const currentAssignments = readFromStorage(SHARED_ASSIGNMENTS_KEY, []);
      const assignment = currentAssignments.find(item => {
        const itemId = typeof item.id === 'number' ? item.id : parseInt(item.id, 10);
        const searchId = typeof assignmentId === 'number' ? assignmentId : parseInt(assignmentId, 10);
        return itemId === searchId;
      }) || {};
      const submissionDate = new Date().toISOString();
      const studentName = user?.name || user?.login || 'Студент';
      const studentGroup = user?.group || assignment.studentGroups?.[0] || 'Не указана';
      const studentIdentifier = user?.id;
      const assignmentTeacherLogin = assignment.teacherLogin || 'teacher_kartseva';

      const currentSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, []);

      const newSubmission = {
        id: generateId(),
        assignmentId,
        assignmentTitle: assignment.title || 'Задание',
        course: assignment.course,
        submissionDate,
        status: 'submitted',
        group: studentGroup,
        studentName,
        studentId: studentIdentifier,
        score: null,
        comment: '',
        maxScore: assignment.maxScore || 100,
        teacherLogin: assignmentTeacherLogin,
        ...(assignment.submissionType === 'file' ? {
          fileName: file.name,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        } : {
          fileName: 'Демонстрация',
          fileSize: 'N/A',
        })
      };

      const updatedSubmissions = [...currentSubmissions, newSubmission];

      const updatedAssignments = currentAssignments.map(assignmentItem => {
        const itemId = typeof assignmentItem.id === 'number' ? assignmentItem.id : parseInt(assignmentItem.id, 10);
        const searchId = typeof assignmentId === 'number' ? assignmentId : parseInt(assignmentId, 10);
        const matches = itemId === searchId;
        
        if (matches) {
          const matchingSubmissions = updatedSubmissions.filter(sub => {
            const subAssignmentId = typeof sub.assignmentId === 'number' ? sub.assignmentId : parseInt(sub.assignmentId, 10);
            return subAssignmentId === searchId;
          });
          return {
            ...assignmentItem,
            submissionsCount: matchingSubmissions.length,
            pendingCount: matchingSubmissions.filter(sub => sub.status === 'submitted').length
          };
        }
        return assignmentItem;
      });

      writeToStorage(SHARED_ASSIGNMENTS_KEY, updatedAssignments);
      writeToStorage(SHARED_SUBMISSIONS_KEY, updatedSubmissions);

      await loadStudentData();

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Ошибка при отправке работы' };
    } finally {
      setLoading(false);
    }
  }, [user, loadStudentData]);

  useEffect(() => {
    if (user) {
      loadStudentData();
    }
  }, [user, loadStudentData]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const handleStorageChange = (e) => {
      const eventKey = e.detail?.key || e.key;
      
      if (eventKey !== SHARED_ASSIGNMENTS_KEY && eventKey !== SHARED_SUBMISSIONS_KEY) {
        return;
      }
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        if (isMounted) {
          loadStudentData();
        }
      }, 50);
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
  }, [loadStudentData]);

  const value = {
    assignments,
    studentSubmissions,
    loading,
    error,
    loadStudentAssignments,
    submitWork,
  };

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
};
