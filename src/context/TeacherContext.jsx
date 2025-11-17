// src/context/TeacherContext.jsx
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { mockTeacherAssignments, mockTeacherSubmissions } from '../data/mockData/teacherData';

const TEACHER_ASSIGNMENTS_KEY = 'college_teacher_assignments';
const TEACHER_SUBMISSIONS_KEY = 'college_submissions';

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
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Загрузка данных преподавателя
  const loadTeacherData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Имитация загрузки данных
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const storedAssignments = readFromStorage(TEACHER_ASSIGNMENTS_KEY, mockTeacherAssignments);
      const storedSubmissions = readFromStorage(TEACHER_SUBMISSIONS_KEY, mockTeacherSubmissions);

      setTeacherAssignments(storedAssignments);
      setSubmissions(storedSubmissions);

      writeToStorage(TEACHER_ASSIGNMENTS_KEY, storedAssignments);
      writeToStorage(TEACHER_SUBMISSIONS_KEY, storedSubmissions);
    } catch (err) {
      setError('Ошибка загрузки данных преподавателя');
      console.error('Error loading teacher data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setSubmissions(prev => {
        const updated = prev.map(submission =>
          submission.id === submissionId
            ? { ...submission, status: 'зачтена', score: parseInt(score, 10), comment }
            : submission
        );
        writeToStorage(TEACHER_SUBMISSIONS_KEY, updated);
        return updated;
      });

      return { success: true };
    } catch (err) {
      console.error('Error grading submission:', err);
      return { success: false, error: 'Ошибка при оценке работы' };
    } finally {
      setLoading(false);
    }
  }, []);

  // Возврат работы на доработку
  const returnSubmission = useCallback(async (submissionId, comment) => {
    setLoading(true);
    try {
      // Имитация обработки
      await new Promise(resolve => setTimeout(resolve, 500));

      // Обновляем submission
      setSubmissions(prev => {
        const updated = prev.map(submission =>
          submission.id === submissionId
            ? { ...submission, status: 'возвращена', comment }
            : submission
        );
        writeToStorage(TEACHER_SUBMISSIONS_KEY, updated);
        return updated;
      });

      return { success: true };
    } catch (err) {
      console.error('Error returning submission:', err);
      return { success: false, error: 'Ошибка при возврате работы' };
    } finally {
      setLoading(false);
    }
  }, []);

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
        priority: assignmentData.priority || 'medium'
      };

      setTeacherAssignments(prev => {
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
  }, []);

  const updateAssignment = useCallback(async (assignmentId, updates) => {
    setLoading(true);
    try {
      setTeacherAssignments(prev => {
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

  const assignmentsWithSubmissions = useMemo(() => {
    return teacherAssignments.map(assignment => {
      const assignmentSubmissions = submissions.filter(sub => sub.assignmentId === assignment.id);
      const pendingCount = assignmentSubmissions.filter(sub => 
        sub.status === 'на проверке' || sub.status === 'submitted'
      ).length;

      return {
        ...assignment,
        submissions: assignmentSubmissions,
        submissionsCount: assignmentSubmissions.length,
        pendingCount
      };
    });
  }, [teacherAssignments, submissions]);

  const value = {
    teacherAssignments: assignmentsWithSubmissions,
    submissions,
    loading,
    error,
    loadTeacherAssignments,
    loadTeacherSubmissions,
    gradeSubmission,
    returnSubmission,
    createAssignment,
    updateAssignment,
  };

  return <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>;
};

