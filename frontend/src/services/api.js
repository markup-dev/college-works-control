import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const snakeToCamel = (str) =>
  str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const camelToSnake = (str) =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const convertKeys = (obj, converter) => {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeys(item, converter));
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof File) && !(obj instanceof Date)) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[converter(key)] = convertKeys(obj[key], converter);
      return acc;
    }, {});
  }
  return obj;
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  if (config.data && !(config.data instanceof FormData)) {
    config.data = convertKeys(config.data, camelToSnake);
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const responseType = response.config?.responseType;
    if (responseType === 'blob' || responseType === 'arraybuffer') {
      return response;
    }

    if (typeof Blob !== 'undefined' && response.data instanceof Blob) {
      return response;
    }

    if (response.data) {
      try {
        response.data = convertKeys(response.data, snakeToCamel);
      } catch {
        // Не роняем успешный HTTP-ответ из‑за нестандартного тела (создание сущности уже могло пройти на сервере).
      }
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
