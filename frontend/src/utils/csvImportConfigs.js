import React from 'react';

const get = (data, keys) => {
  if (!data || typeof data !== 'object') return '—';
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '—';
};

const rowFio = (data) => {
  const value = [
    get(data, ['lastName', 'last_name']),
    get(data, ['firstName', 'first_name']),
    get(data, ['middleName', 'middle_name']),
  ].filter((part) => part !== '—').join(' ').trim();

  return value || '—';
};

const userRoleLabel = (data) => {
  const role = data?.role;
  if (role === 'student') return 'Студент';
  if (role === 'teacher') return 'Преподаватель';
  if (role === 'admin') return 'Администратор';
  return role || '—';
};

const statusLabel = (value, activeLabel = 'Активен', inactiveLabel = 'Неактивен') => {
  if (value === 'active') return activeLabel;
  if (value === 'inactive') return inactiveLabel;
  return value || activeLabel;
};

export const CSV_IMPORT_CONFIGS = {
  users: {
    title: 'Импорт пользователей',
    subtitle: 'Загрузите список пользователей из CSV',
    previewUrl: '/admin/users/import/preview',
    importUrl: '/admin/users/import',
    sampleFileName: 'users_import_example.csv',
    sampleHeader: 'email,last_name,first_name,role,group',
    sampleRow: 'ivanov@example.ru,Иванов,Иван,student,ИСП-0001',
    instructions: [
      <>Первая строка — заголовки столбцов. Разделитель: запятая или точка с запятой.</>,
      <>В каждой строке укажите <strong>фамилию</strong>, <strong>имя</strong>, <strong>email</strong> и <strong>роль</strong> — <code>student</code>, <code>teacher</code> или <code>admin</code>.</>,
      <>Для студентов добавьте колонку <code>group</code> (название группы) или <code>group_id</code>.</>,
      <>Логин и пароль создаются автоматически. Если на шаге проверки включить отправку письма, учётные данные придут на email из файла.</>,
    ],
    importOptions: {
      sendCredentials: true,
    },
    rowFields: [
      { key: 'fio', label: 'ФИО', getValue: rowFio, primary: true },
      { key: 'login', label: 'Логин', getValue: (data) => get(data, ['login']) },
      { key: 'email', label: 'Email', getValue: (data) => get(data, ['email']), clip: true },
      { key: 'role', label: 'Роль', getValue: userRoleLabel },
    ],
    emptyText: 'В файле нет пользователей для импорта.',
  },
  groups: {
    title: 'Импорт групп',
    subtitle: 'Загрузите список учебных групп из CSV',
    previewUrl: '/admin/groups/import/preview',
    importUrl: '/admin/groups/import',
    sampleFileName: 'groups_import_example.csv',
    sampleHeader: 'name,specialty,status',
    sampleRow: 'ИСП-0001,Информационные системы и программирование,inactive',
    instructions: [
      <>Первая строка — заголовки столбцов. Разделитель: запятая или точка с запятой.</>,
      <>Обязательная колонка: <code>name</code>. Название группы может содержать буквы, цифры и дефис.</>,
      <>Дополнительно можно указать <code>specialty</code> и <code>status</code>: <code>active</code> или <code>inactive</code>.</>,
    ],
    rowFields: [
      { key: 'name', label: 'Группа', getValue: (data) => get(data, ['name']), primary: true },
      { key: 'specialty', label: 'Специальность', getValue: (data) => get(data, ['specialty']) },
      { key: 'status', label: 'Статус', getValue: (data) => statusLabel(data?.status, 'Активна', 'Закрыта') },
    ],
    emptyText: 'В файле нет групп для импорта.',
  },
  subjects: {
    title: 'Импорт дисциплин',
    subtitle: 'Загрузите список дисциплин из CSV',
    previewUrl: '/admin/subjects/import/preview',
    importUrl: '/admin/subjects/import',
    sampleFileName: 'subjects_import_example.csv',
    sampleHeader: 'name,code,status',
    sampleRow: 'Backend API проектирование,API-401,active',
    instructions: [
      <>Первая строка — заголовки столбцов. Разделитель: запятая или точка с запятой.</>,
      <>Обязательные колонки: <code>name</code> и <code>code</code>. Код должен быть уникальным.</>,
      <>Дополнительно можно указать <code>status</code>: <code>active</code> или <code>inactive</code>.</>,
    ],
    rowFields: [
      { key: 'name', label: 'Дисциплина', getValue: (data) => get(data, ['name']), primary: true },
      { key: 'code', label: 'Код', getValue: (data) => get(data, ['code']) },
      { key: 'status', label: 'Статус', getValue: (data) => statusLabel(data?.status) },
    ],
    emptyText: 'В файле нет дисциплин для импорта.',
  },
};
