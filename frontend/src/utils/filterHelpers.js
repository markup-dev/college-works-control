export const normalizeGroupName = (value) => (
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[—–−]/g, '-')
    .toUpperCase()
);

const getSubjectName = (item) => {
  const rel = item?.subject;
  if (rel && typeof rel === 'object' && !Array.isArray(rel) && rel.name != null) {
    return String(rel.name).trim();
  }
  return String(
    item?.subjectName
    || item?.subjectRelation?.name
    || (typeof item?.subject === 'string' ? item.subject : '')
    || ''
  ).trim();
};

const getSubjectId = (item) => {
  const rel = item?.subject;
  if (rel && typeof rel === 'object' && !Array.isArray(rel) && rel.id != null) {
    return Number(rel.id);
  }
  return Number(
    item?.subjectId
    ?? item?.subject_id
    ?? item?.subjectRelation?.id
  );
};

export const resolveAssignmentSubjectName = getSubjectName;

/** @returns {number|null} */
export const resolveAssignmentSubjectId = (item) => {
  const n = getSubjectId(item);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getTeacherName = (item) => String(
  item?.teacher
  || item?.teacherName
  || item?.teacherRelation?.full_name
  || ''
).trim();

const getTeacherId = (item) => Number(item?.teacherId ?? item?.teacher_id);

export const buildStudentFilterCatalog = (assignments = []) => {
  const catalogMap = new Map();

  assignments.forEach((assignment) => {
    const subject = getSubjectName(assignment);
    const teacherName = getTeacherName(assignment);
    const teacherId = getTeacherId(assignment);

    if (!subject || !teacherName) {
      return;
    }

    const teacherKey = Number.isFinite(teacherId) && teacherId > 0 ? `id:${teacherId}` : `name:${teacherName}`;
    const key = `${subject}::${teacherKey}`;

    catalogMap.set(key, {
      subject,
      teacherName,
      teacherId: Number.isFinite(teacherId) && teacherId > 0 ? teacherId : null,
    });
  });

  return Array.from(catalogMap.values()).sort((left, right) => {
    const teacherCompare = left.teacherName.localeCompare(right.teacherName, 'ru');
    if (teacherCompare !== 0) {
      return teacherCompare;
    }
    return left.subject.localeCompare(right.subject, 'ru');
  });
};

export const mergeStudentFilterCatalog = (currentCatalog = [], nextAssignments = []) => {
  const merged = new Map();
  [...currentCatalog, ...buildStudentFilterCatalog(nextAssignments)].forEach((item) => {
    const teacherKey = item.teacherId ? `id:${item.teacherId}` : `name:${item.teacherName}`;
    merged.set(`${item.subject}::${teacherKey}`, item);
  });
  return Array.from(merged.values()).sort((left, right) => {
    const teacherCompare = left.teacherName.localeCompare(right.teacherName, 'ru');
    if (teacherCompare !== 0) {
      return teacherCompare;
    }
    return left.subject.localeCompare(right.subject, 'ru');
  });
};

export const buildTeacherOptionsFromCatalog = (catalog = []) => {
  const optionsMap = new Map();

  catalog.forEach((pair) => {
    const key = pair.teacherId ? `id:${pair.teacherId}` : `name:${pair.teacherName}`;
    if (!optionsMap.has(key)) {
      optionsMap.set(key, {
        id: pair.teacherId || null,
        name: pair.teacherName,
      });
    }
  });

  return Array.from(optionsMap.values()).sort((left, right) => left.name.localeCompare(right.name, 'ru'));
};

export const buildAvailableSubjectsForStudent = (catalog = [], teacherFilter = 'all') => {
  const source = teacherFilter !== 'all'
    ? catalog.filter((item) => item.teacherName === teacherFilter)
    : catalog;

  return Array.from(new Set(source.map((item) => item.subject))).sort((a, b) => a.localeCompare(b, 'ru'));
};

export const buildAvailableTeachersForStudent = (catalog = [], subjectFilter = 'all') => {
  const source = subjectFilter !== 'all'
    ? catalog.filter((item) => item.subject === subjectFilter)
    : catalog;

  return Array.from(new Set(source.map((item) => item.teacherName))).sort((a, b) => a.localeCompare(b, 'ru'));
};

export const resolveTeacherIdByName = (teacherName, teacherOptions = []) => {
  if (!teacherName || teacherName === 'all') {
    return undefined;
  }

  const teacher = teacherOptions.find((item) => item.name === teacherName);
  return teacher?.id || undefined;
};

export const buildSubmissionSubjectOptions = ({
  teacherSubjects = [],
  analyticsAssignments = [],
} = {}) => {
  const subjectsMap = new Map();

  teacherSubjects.forEach((subject) => {
    const subjectId = Number(subject?.id);
    const subjectName = String(subject?.name || '').trim();
    if (!Number.isFinite(subjectId) || subjectId <= 0 || !subjectName) {
      return;
    }
    subjectsMap.set(subjectId, {
      id: subjectId,
      title: subjectName,
    });
  });

  analyticsAssignments.forEach((assignment) => {
    const subjectId = getSubjectId(assignment);
    const subjectName = getSubjectName(assignment);
    if (!Number.isFinite(subjectId) || subjectId <= 0 || !subjectName) {
      return;
    }
    if (!subjectsMap.has(subjectId)) {
      subjectsMap.set(subjectId, {
        id: subjectId,
        title: subjectName,
      });
    }
  });

  return Array.from(subjectsMap.values()).sort((a, b) => a.title.localeCompare(b.title, 'ru'));
};

export const buildNormalizedGroupOptions = (groups = []) => (
  Array.from(new Set((groups || []).map((group) => normalizeGroupName(group)).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'ru'))
);
