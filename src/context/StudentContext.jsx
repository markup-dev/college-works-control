// src/context/StudentContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { mockStudentAssignments, mockStudentSubmissions } from '../data/mockData/studentData';
import { useAuth } from './AuthContext';

const STUDENT_ASSIGNMENTS_KEY = 'college_student_assignments';
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

      const storedAssignments = readFromStorage(STUDENT_ASSIGNMENTS_KEY, mockStudentAssignments);
      const storedSubmissions = readFromStorage(SHARED_SUBMISSIONS_KEY, mockStudentSubmissions);

      setAssignments(storedAssignments);
      setStudentSubmissions(storedSubmissions);

      // Обновляем storage (на случай, если данных еще не было)
      writeToStorage(STUDENT_ASSIGNMENTS_KEY, storedAssignments);
      writeToStorage(SHARED_SUBMISSIONS_KEY, storedSubmissions);
    } catch (err) {
      setError('Ошибка загрузки данных студента');
      console.error('Error loading student data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      const studentGroup = user?.group || assignment.group || 'Не указана';
      const studentIdentifier = user?.login || `student-${user?.id || Date.now()}`;

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
        writeToStorage(STUDENT_ASSIGNMENTS_KEY, updated);
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
        maxScore: assignment.maxScore || 100
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
  }, []);

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

