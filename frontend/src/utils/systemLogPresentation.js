import React from 'react';

const SYSTEM_LOG_ACTION_LABELS = {
  create_user: 'Создание пользователя',
  update_user: 'Изменение пользователя',
  delete_user: 'Удаление пользователя',
  reset_user_credentials: 'Сброс пароля',
  import_users: 'Импорт пользователей',
  create_group: 'Создание группы',
  update_group: 'Изменение группы',
  delete_group: 'Удаление группы',
  import_groups: 'Импорт групп',
  bulk_attach_students_to_group: 'Добавление студентов в группу',
  detach_student_from_group: 'Исключение студента из группы',
  promote_groups_course_batch: 'Перевод групп на новый курс',
  create_subject: 'Создание дисциплины',
  update_subject: 'Изменение дисциплины',
  delete_subject: 'Удаление дисциплины',
  import_subjects: 'Импорт дисциплин',
  create_specialty: 'Создание специальности',
  update_specialty: 'Изменение специальности',
  sync_specialty_program: 'Обновление программы специальности',
  archive_specialty: 'Архивирование специальности',
  store_teacher_discipline: 'Изменение допуска к дисциплине',
  disable_teacher_discipline: 'Отключение допуска к дисциплине',
  resolve_discipline_request: 'Рассмотрение заявки на дисциплину',
  resolve_teaching_load_request: 'Рассмотрение заявки на назначение',
  create_teaching_load: 'Создание учебного назначения',
  create_teaching_load_batch: 'Пакетное создание назначений',
  update_teaching_load: 'Изменение учебного назначения',
  delete_teaching_load: 'Удаление учебного назначения',
  sync_teaching_loads_pair: 'Синхронизация групп назначения',
  transfer_teaching_load_teacher: 'Смена преподавателя в назначении',
  update_assignment: 'Изменение задания',
  reassign_assignment_teacher: 'Смена преподавателя у задания',
  delete_assignment: 'Удаление задания',
};

const SYSTEM_LOG_ROLE_LABELS = {
  admin: 'Админ',
  teacher: 'Преподаватель',
  student: 'Студент',
  system: 'Система',
};

const STATUS_WORDS = {
  approved: 'одобрена',
  rejected: 'отклонена',
  pending: 'на рассмотрении',
  active: 'активен',
  inactive: 'неактивен',
  archived: 'в архиве',
  graduated: 'выпуск',
  closed: 'закрыта',
};

const humanizeActionCode = (action) => {
  if (!action) return 'Событие';
  return String(action)
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const getSystemLogActionLabel = (action) => (
  SYSTEM_LOG_ACTION_LABELS[action] ?? humanizeActionCode(action)
);

export const getSystemLogRoleLabel = (role) => (
  SYSTEM_LOG_ROLE_LABELS[role] ?? role ?? '—'
);

export const getSystemLogTypeClass = (action = '') => {
  const code = String(action).toLowerCase();
  if (/delete|disable|archive|detach|remove|удал|отключ|архив|исключ/.test(code)) {
    return 'log-delete';
  }
  if (/create|store|import|attach|add|созд|добав|импорт/.test(code)) {
    return 'log-create';
  }
  if (/update|change|sync|resolve|reassign|transfer|promote|измен|смен|синхрон|одобр|перевод/.test(code)) {
    return 'log-update';
  }
  return 'log-default';
};

export const formatLogDetailsText = (details) => {
  if (!details) return '';

  let text = String(details);

  Object.entries(STATUS_WORDS).forEach(([en, ru]) => {
    text = text.replace(new RegExp(`\\b${en}\\b`, 'gi'), ru);
  });

  text = text
    .replace(/\s*\(id\s+(\d+)\)/gi, ' №$1')
    .replace(/:\s*approved\b/gi, ': одобрена')
    .replace(/:\s*rejected\b/gi, ': отклонена')
    .replace(/от\s+([А-ЯЁ][а-яё]+)\s+([А-ЯЁ][а-яё]+)\s+([А-ЯЁ][а-яё]+)/g, 'от $1 $2 $3');

  return text.trim();
};

export const parseLogDetailSegments = (details) => {
  const full = formatLogDetailsText(details);
  if (!full) {
    return { prefix: null, chips: [], full: '' };
  }

  const colonIndex = full.indexOf(':');
  if (colonIndex === -1 || !full.includes('·')) {
    return { prefix: null, chips: [], full };
  }

  const prefix = full.slice(0, colonIndex + 1).trim();
  const rest = full.slice(colonIndex + 1).trim();

  if (!rest.includes('·')) {
    return { prefix, chips: [], full };
  }

  const chips = rest
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);

  return { prefix, chips, full };
};

const renderInlineHighlights = (text) => {
  const parts = String(text).split(/(«[^»]+»)/g);

  return parts.map((part, index) => {
    if (part.startsWith('«') && part.endsWith('»')) {
      return (
        <span key={`quote-${index}`} className="log-details__quote">
          {part}
        </span>
      );
    }
    return part;
  });
};

export const LogDetailsText = ({ details, className = '' }) => {
  const segments = parseLogDetailSegments(details);

  if (segments.chips.length > 0) {
    return (
      <p className={className}>
        {segments.prefix ? <span className="log-details__prefix">{segments.prefix} </span> : null}
        <span className="log-details__chips">
          {segments.chips.map((chip, index) => (
            <React.Fragment key={`${chip}-${index}`}>
              {index > 0 ? <span className="log-details__sep" aria-hidden>·</span> : null}
              <span className="log-details__chip">{chip}</span>
            </React.Fragment>
          ))}
        </span>
      </p>
    );
  }

  return (
    <p className={className}>
      {renderInlineHighlights(segments.full)}
    </p>
  );
};
