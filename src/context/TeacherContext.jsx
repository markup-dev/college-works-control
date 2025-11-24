// src/context/TeacherContext.jsx
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { mockTeacherAssignments } from '../data/mockData/teacherData';
import { mockStudentSubmissions } from '../data/mockData/studentData';
import { useAuth } from './AuthContext';

// Используем submissions от студентов как начальные данные
const combinedSubmissions = [...mockStudentSubmissions];

// Используем assignments от преподавателя
const combinedAssignments = [...mockTeacherAssignments];

const SHARED_ASSIGNMENTS_KEY = 'college_assignments';
const TEACHER_ASSIGNMENTS_KEY = 'college_teacher_assignments';
const SHARED_SUBMISSIONS_KEY = 'college_submissions';
const DEFAULT_TEACHER_LOGIN = 'teacher_kartseva';
const DEFAULT_TEACHER_NAME = 'Карцева Мария Сергеевна';

const readFromStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error(`Error reading ${key} from storage:`, error);
  }
  return fallback;
};

const writeToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to storage:`, error);
  }
};

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
    (submissions, assignments) =>
      submissions.map((submission) => {
        const assignment = assignments.find(a => a.id === submission.assignmentId);
        return {
          ...submission,
          teacherLogin: resolveOwnerLogin(submission.teacherLogin),
          assignmentTitle: assignment ? assignment.title : 'Неизвестно',
          assignmentCourse: assignment ? assignment.course : '',
          maxScore: assignment ? assignment.maxScore : 100
        };
      }),
    [resolveOwnerLogin]
  );

  // Загрузка данных преподавателя
  const loadTeacherData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Имитация загрузки данных
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const storedAssignments = readFromStorage(TEACHER_ASSIGNMENTS_KEY, combinedAssignments);
      const storedSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, combinedSubmissions);

      const normalizedAssignments = normalizeAssignments(storedAssignments);
      const normalizedSubmissions = normalizeSubmissions(storedSubmissions, normalizedAssignments);

      setAllTeacherAssignments(normalizedAssignments);
      setAllSubmissions(normalizedSubmissions);

      writeToStorage(TEACHER_ASSIGNMENTS_KEY, normalizedAssignments);
      writeToStorage(SHARED_SUBMISSIONS_KEY, normalizedSubmissions);
    } catch (err) {
      setError('Ошибка загрузки данных преподавателя');
      console.error('Error loading teacher data:', err);
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

  // Оценка работы
  const gradeSubmission = useCallback(async (submissionId, score, comment) => {
    setLoading(true);
    try {
      // Имитация обработки
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Обновляем submission
      setAllSubmissions(prev => {
        const updated = prev.map(submission =>
          submission.id === submissionId
            ? { ...submission, status: 'graded', score: parseInt(score, 10), comment }
            : submission
        );
        writeToStorage(SHARED_SUBMISSIONS_KEY, updated);
        return updated;
      });

      // Обновляем assignments в storage для синхронизации
      setAllTeacherAssignments(prev => {
        const updatedAssignments = prev.map(assignment => {
          const assignmentSubmissions = allSubmissions.filter(sub => sub.assignmentId === assignment.id);
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
        return updatedAssignments;
      });

      return { success: true };
    } catch (err) {
      console.error('Error grading submission:', err);
      return { success: false, error: 'Ошибка при оценке работы' };
    } finally {
      setLoading(false);
    }
  }, [allSubmissions]);

  // Возврат работы на доработку
  const returnSubmission = useCallback(async (submissionId, comment) => {
    setLoading(true);
    try {
      // Имитация обработки
      await new Promise(resolve => setTimeout(resolve, 500));

      // Обновляем submission
      setAllSubmissions(prev => {
        const updated = prev.map(submission =>
          submission.id === submissionId
            ? { ...submission, status: 'returned', comment }
            : submission
        );
        writeToStorage(SHARED_SUBMISSIONS_KEY, updated);
        return updated;
      });

      // Обновляем assignments в storage для синхронизации
      setAllTeacherAssignments(prev => {
        const updatedAssignments = prev.map(assignment => {
          const assignmentSubmissions = allSubmissions.filter(sub => sub.assignmentId === assignment.id);
          const pendingCount = assignmentSubmissions.filter(sub =>
            sub.status === 'submitted'
          ).length;
          return {
            ...assignment,
            submissionsCount: assignmentSubmissions.length,
            pendingCount
          };
        });
        writeToStorage(TEACHER_ASSIGNMENTS_KEY, updatedAssignments);
        return updatedAssignments;
      });

      return { success: true };
    } catch (err) {
      console.error('Error returning submission:', err);
      return { success: false, error: 'Ошибка при возврате работы' };
    } finally {
      setLoading(false);
    }
  }, [allSubmissions]);

  // Создание задания
  const createAssignment = useCallback(async (assignmentData) => {
    setLoading(true);
    try {
      // Преобразуем group в studentGroups, если нужно
      const studentGroups = assignmentData.studentGroups || 
        (assignmentData.group && assignmentData.group !== 'Все группы' ? [assignmentData.group] : []);
      
      const newAssignment = {
        id: Date.now(),
        ...assignmentData,
        studentsCount: assignmentData.studentsCount || 0,
        submissionsCount: 0,
        pendingCount: 0,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0],
        submissions: [], // Пустой массив submissions для нового задания
        studentGroups: studentGroups,
        priority: assignmentData.priority || 'medium',
        teacherLogin: resolveOwnerLogin(teacherLogin),
        teacherName: teacherName || assignmentData.teacherName || DEFAULT_TEACHER_NAME
      };

      setAllTeacherAssignments(prev => {
        const updated = [...prev, newAssignment];
        writeToStorage(TEACHER_ASSIGNMENTS_KEY, updated);
        return updated;
      });
      return { success: true };
    } catch (err) {
      console.error('Error creating assignment:', err);
      return { success: false, error: 'Ошибка при создании задания' };
    } finally {
      setLoading(false);
    }
  }, [resolveOwnerLogin, teacherLogin, teacherName]);

  const updateAssignment = useCallback(async (assignmentId, updates) => {
    setLoading(true);
    try {
      setAllTeacherAssignments(prev => {
        const updated = prev.map(assignment =>
          assignment.id === assignmentId ? { ...assignment, ...updates } : assignment
        );
        writeToStorage(TEACHER_ASSIGNMENTS_KEY, updated);
        return updated;
      });
      return { success: true };
    } catch (err) {
      console.error('Error updating assignment:', err);
      return { success: false, error: 'Ошибка при обновлении задания' };
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAssignment = useCallback(async (assignmentId) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      setAllTeacherAssignments(prev => {
        const updated = prev.filter(assignment => assignment.id !== assignmentId);
        writeToStorage(TEACHER_ASSIGNMENTS_KEY, updated);
        return updated;
      });

      setAllSubmissions(prev => {
        const updated = prev.filter(submission => submission.assignmentId !== assignmentId);
        writeToStorage(SHARED_SUBMISSIONS_KEY, updated);
        return updated;
      });

      return { success: true };
    } catch (err) {
      console.error('Error deleting assignment:', err);
      return { success: false, error: 'Ошибка при удалении задания' };
    } finally {
      setLoading(false);
    }
  }, []);

  const teacherAssignments = useMemo(() => {
    return allTeacherAssignments.filter(assignment => belongsToCurrentTeacher(assignment.teacherLogin));
  }, [allTeacherAssignments, belongsToCurrentTeacher]);

  const teacherSubmissions = useMemo(() => {
    return allSubmissions.filter(sub => belongsToCurrentTeacher(sub.teacherLogin));
  }, [allSubmissions, belongsToCurrentTeacher]);

  const assignmentsWithSubmissions = useMemo(() => {
    return teacherAssignments.map(assignment => {
      const assignmentSubmissions = teacherSubmissions.filter(sub => sub.assignmentId === assignment.id);
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

  // Синхронизация с localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === TEACHER_ASSIGNMENTS_KEY || e.key === SHARED_SUBMISSIONS_KEY) {
        loadTeacherData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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

