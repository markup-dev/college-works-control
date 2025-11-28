import { defaultAssignments, defaultSubmissions } from '../data/usersDatabase';
import { readFromStorage, writeToStorage, STORAGE_KEYS } from './storageUtils';

const ASSIGNMENTS_KEY = STORAGE_KEYS.ASSIGNMENTS;
const SUBMISSIONS_KEY = STORAGE_KEYS.SUBMISSIONS;

let isInitialized = false;

export const initializeStorage = () => {
  if (isInitialized) {
    const assignments = readFromStorage(ASSIGNMENTS_KEY, []);
    const submissions = readFromStorage(SUBMISSIONS_KEY, []);
    return { assignments, submissions };
  }

  let assignments = readFromStorage(ASSIGNMENTS_KEY);
  let submissions = readFromStorage(SUBMISSIONS_KEY);
  
  const wasEmpty = !assignments || assignments.length === 0;
  
  if (wasEmpty) {
    assignments = [...defaultAssignments];
    writeToStorage(ASSIGNMENTS_KEY, assignments, true);
  }
  
  if (!submissions || submissions.length === 0) {
    submissions = [...defaultSubmissions];
    writeToStorage(SUBMISSIONS_KEY, submissions, true);
  }
  
  isInitialized = true;
  
  return { assignments, submissions };
};

