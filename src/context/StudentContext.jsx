// src/context/StudentContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { mockStudentSubmissions } from '../data/mockData/studentData';
import { mockTeacherAssignments } from '../data/mockData/teacherData';
import { useAuth } from './AuthContext';

// Используем assignments от преподавателя
const combinedAssignments = [...mockTeacherAssignments];

const SHARED_ASSIGNMENTS_KEY = 'college_assignments';
const SHARED_SUBMISSIONS_KEY = 'college_submissions';

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

const StudentContext = createContext();

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used within a StudentProvider');
  }
  return context;
};

const normalizeGroup = (group) => group?.trim().toLowerCase() || '';

export const StudentProvider = ({ children }) => {
  const [assignments, setAssignments] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Загрузка данных студента
  const loadStudentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Имитация загрузки данных
      await new Promise(resolve => setTimeout(resolve, 500));

      const storedAssignments = readFromStorage(SHARED_ASSIGNMENTS_KEY, combinedAssignments);
      const storedSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, mockStudentSubmissions);

      const studentGroup = normalizeGroup(user?.group);
      const filteredAssignments = storedAssignments.filter(assignment => {
        const assignmentGroups = Array.isArray(assignment.studentGroups) && assignment.studentGroups.length > 0
          ? assignment.studentGroups
          : [];

        if (assignmentGroups.length === 0 || !studentGroup) {
          return true;
        }
        return assignmentGroups
          .map(group => normalizeGroup(group))
          .includes(studentGroup);
      }).map(assignment => {
        const studentSubmission = storedSubmissions.find(sub => sub.assignmentId === assignment.id && sub.studentId === user?.id);
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
        return {
          ...assignment,
          status,
          teacher: assignment.teacherName || assignment.teacher || 'Не указан',
          submittedAt: studentSubmission?.submitDate,
          score: studentSubmission?.score,
          maxScore: studentSubmission?.maxScore || assignment.maxScore
        };
      });

      setAssignments(filteredAssignments);
      setStudentSubmissions(storedSubmissions);

      // Обновляем storage (на случай, если данных еще не было)
      writeToStorage(SHARED_ASSIGNMENTS_KEY, storedAssignments);
      writeToStorage(SHARED_SUBMISSIONS_KEY, storedSubmissions);
    } catch (err) {
      setError('Ошибка загрузки данных студента');
      console.error('Error loading student data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadStudentAssignments = useCallback(async () => {
    return loadStudentData();
  }, [loadStudentData]);

  // Сдача работы
  const submitWork = useCallback(async (assignmentId, file) => {
    setLoading(true);
    try {
      // Имитация загрузки файла
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Обновляем статус задания
      const assignment = assignments.find(item => item.id === assignmentId) || {};
      const submitDate = new Date().toISOString();
      const studentName = user?.name || user?.login || 'Студент';
      const studentGroup = user?.group || assignment.studentGroups?.[0] || 'Не указана';
      const studentIdentifier = user?.id;
      const assignmentTeacherLogin = assignment.teacherLogin || 'teacher_kartseva';

      setAssignments(prev => {
        const updated = prev.map(assignmentItem => 
          assignmentItem.id === assignmentId 
            ? { 
                ...assignmentItem, 
                status: 'submitted', 
                submittedAt: submitDate 
              }
            : assignmentItem
        );
        writeToStorage(SHARED_ASSIGNMENTS_KEY, updated);
        return updated;
      });

      // Добавляем submission
      const newSubmission = {
        id: Date.now(),
        assignmentId,
        assignmentTitle: assignment.title || 'Задание',
        course: assignment.course,
        fileName: file.name,
        submissionDate: submitDate,
        submitDate,
        status: 'submitted',
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        group: studentGroup,
        studentName,
        studentId: studentIdentifier,
        score: null,
        comment: '',
        maxScore: assignment.maxScore || 100,
        teacherLogin: assignmentTeacherLogin
      };

      setStudentSubmissions(prev => {
        const updated = [...prev, newSubmission];
        writeToStorage(SHARED_SUBMISSIONS_KEY, updated);
        return updated;
      });

      return { success: true };
    } catch (err) {
      console.error('Error submitting work:', err);
      return { success: false, error: 'Ошибка при отправке работы' };
    } finally {
      setLoading(false);
    }
  }, [assignments, user]);

  // Синхронизация с localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === SHARED_ASSIGNMENTS_KEY || e.key === SHARED_SUBMISSIONS_KEY) {
        loadStudentData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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

