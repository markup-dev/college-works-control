/** Тексты пустых состояний и подсказок в заявках преподавателя (допуск / назначение). */

export const TEACHER_REQUEST_MESSAGES = {
  discipline: {
    noInProgram: 'В программе этой специальности пока нет дисциплин. Обратитесь к администратору.',
    allInAllowances: 'Все дисциплины из программы уже есть в ваших допусках.',
    allBlocked: 'По всем дисциплинам программы уже есть допуски или заявки на рассмотрении.',
    searchEmpty: 'По запросу ничего не найдено. Измените поисковую фразу.',
  },
  load: {
    noInProgram: 'Для этой дисциплины нет групп на текущем курсе учебного плана. Обратитесь к администратору, чтобы добавить дисциплину в программу группы.',
    allAssigned: 'Все подходящие группы уже есть в ваших назначениях по этой дисциплине.',
    allBlocked: 'По всем группам этой дисциплины уже есть назначения или заявки на рассмотрении.',
    selectDisciplineFirst: 'Сначала выберите дисциплину.',
  },
};

export const groupsWithActiveSubjectOnCourse = (groups, subjectId) => {
  if (!subjectId) {
    return [];
  }
  return (groups || []).filter((group) => {
    const groupSubjects = group.activeGroupSubjects || group.active_group_subjects || [];
    return groupSubjects.some((item) => {
      const itemSubjectId = item.subjectId ?? item.subject_id ?? item.subject?.id;
      return String(itemSubjectId) === String(subjectId);
    });
  });
};

export const mergeGroupsForSubject = (catalogGroups, teachingLoads, subjectId) => {
  const byId = new Map();
  catalogGroups.forEach((group) => {
    byId.set(String(group.id), group);
  });

  (teachingLoads || []).forEach((load) => {
    const loadSubjectId = load.subject?.id ?? load.subjectId ?? load.subject_id;
    if (String(loadSubjectId) !== String(subjectId)) {
      return;
    }
    const group = load.group;
    const groupId = group?.id ?? load.groupId ?? load.group_id;
    if (groupId == null || groupId === '') {
      return;
    }
    const key = String(groupId);
    if (!byId.has(key)) {
      byId.set(key, {
        id: groupId,
        name: group?.name || 'Группа',
        currentCourse: group?.currentCourse ?? group?.current_course,
      });
    }
  });

  return Array.from(byId.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
};

export const resolveDisciplinePickerEmptyMessage = ({
  specialtyId,
  programSubjects,
  selectableSubjects,
  ownedSubjectIds,
  pendingSubjectIds,
}) => {
  if (!specialtyId) {
    return null;
  }
  if (selectableSubjects.length > 0) {
    return null;
  }
  if (programSubjects.length === 0) {
    return TEACHER_REQUEST_MESSAGES.discipline.noInProgram;
  }
  if (programSubjects.every((subject) => ownedSubjectIds.has(String(subject.id)))) {
    return TEACHER_REQUEST_MESSAGES.discipline.allInAllowances;
  }
  if (
    programSubjects.every(
      (subject) => ownedSubjectIds.has(String(subject.id)) || pendingSubjectIds.has(String(subject.id)),
    )
  ) {
    return TEACHER_REQUEST_MESSAGES.discipline.allBlocked;
  }
  return TEACHER_REQUEST_MESSAGES.discipline.allBlocked;
};

export const resolveLoadGroupEmptyMessage = ({
  loadSubjectId,
  selectableGroups,
  catalogGroups,
  assignedGroupIds,
  pendingGroupIds,
}) => {
  if (!loadSubjectId || selectableGroups.length > 0) {
    return null;
  }

  if (assignedGroupIds.size > 0) {
    if (catalogGroups.length === 0) {
      return TEACHER_REQUEST_MESSAGES.load.allAssigned;
    }
    if (catalogGroups.every((group) => assignedGroupIds.has(String(group.id)))) {
      return TEACHER_REQUEST_MESSAGES.load.allAssigned;
    }
  }

  if (catalogGroups.length === 0) {
    return TEACHER_REQUEST_MESSAGES.load.noInProgram;
  }

  if (
    catalogGroups.every(
      (group) => assignedGroupIds.has(String(group.id)) || pendingGroupIds.has(String(group.id)),
    )
  ) {
    return TEACHER_REQUEST_MESSAGES.load.allBlocked;
  }

  return TEACHER_REQUEST_MESSAGES.load.allBlocked;
};
