export const formatSubjectLabel = (name, code) => (
  code ? `${name} (${code})` : (name || '—')
);

export const toSubjectSelectOptions = (items = []) => items.map((subject) => ({
  value: String(subject.id),
  label: formatSubjectLabel(subject.name, subject.code),
  meta: subject.code || undefined,
  searchText: `${subject.name || ''} ${subject.code || ''}`.trim(),
}));

export const toGroupSelectOptions = (items = []) => items.map((group) => ({
  value: String(group.id),
  label: group.name || '—',
  meta: group.specialty || group.specialtyRef?.name || undefined,
  searchText: `${group.name || ''} ${group.specialty || group.specialtyRef?.name || ''}`.trim(),
}));

export const toSpecialtySelectOptions = (items = []) => items.map((specialty) => ({
  value: String(specialty.id),
  label: specialty.code ? `${specialty.name} (${specialty.code})` : (specialty.name || '—'),
  meta: specialty.code || undefined,
  searchText: `${specialty.name || ''} ${specialty.code || ''}`.trim(),
}));

const defaultTeacherLabel = (teacher) => {
  if (!teacher) return '—';
  const last = (teacher.lastName ?? '').trim();
  const first = (teacher.firstName ?? '').trim()?.[0];
  const middle = (teacher.middleName ?? '').trim()?.[0];
  const initials = [first && `${first}.`, middle && `${middle}.`].filter(Boolean).join('');
  return initials ? `${last} ${initials}`.trim() : last || teacher.login || '—';
};

export const toTeacherSelectOptions = (items = [], { labelFn = defaultTeacherLabel } = {}) => items.map((teacher) => {
  const label = labelFn(teacher);
  const email = teacher.email || '';
  const login = teacher.login || '';
  return {
    value: String(teacher.id),
    label,
    meta: email || login || undefined,
    searchText: `${label} ${email} ${login}`.trim(),
  };
});

export const toReassignTeacherSelectOptions = (items = []) => items.map((teacher) => {
  const base = teacher.shortName ?? teacher.fullName ?? teacher.label ?? defaultTeacherLabel(teacher);
  const label = teacher.matchLabel ? `${base} — ${teacher.matchLabel}` : base;
  return {
    value: String(teacher.id),
    label,
    searchText: `${base} ${teacher.matchLabel || ''} ${teacher.email || ''} ${teacher.login || ''}`.trim(),
  };
});
