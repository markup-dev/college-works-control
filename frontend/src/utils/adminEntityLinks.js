export const buildAdminUsersHref = ({ role, groupId } = {}) => {
  const q = new URLSearchParams();
  if (role) q.set('role', role);
  if (groupId) q.set('group_id', String(groupId));
  const s = q.toString();
  return s ? `/admin/users?${s}` : '/admin/users';
};

export const buildAdminHomeworkHref = ({ groupId, teacherId, subjectId, status } = {}) => {
  const q = new URLSearchParams();
  if (groupId) q.set('group_id', String(groupId));
  if (teacherId) q.set('teacher_id', String(teacherId));
  if (subjectId) q.set('subject_id', String(subjectId));
  if (status) q.set('status', status);
  const s = q.toString();
  return s ? `/admin/homework?${s}` : '/admin/homework';
};

export const buildAdminGroupsHref = ({ specialtyId } = {}) => {
  const q = new URLSearchParams();
  if (specialtyId) q.set('specialty_id', String(specialtyId));
  const s = q.toString();
  return s ? `/admin/groups?${s}` : '/admin/groups';
};

export const buildAdminTeachingAssignmentsHref = ({ groupId, teacherId, subjectId } = {}) => {
  const q = new URLSearchParams();
  if (groupId) q.set('group_id', String(groupId));
  if (teacherId) q.set('teacher_id', String(teacherId));
  if (subjectId) q.set('subject_id', String(subjectId));
  const s = q.toString();
  return s ? `/admin/assignments?${s}` : '/admin/assignments';
};

export const openAdminSubject = (navigate, subjectId) => {
  if (!subjectId) return;
  navigate('/admin/subjects', { state: { viewSubjectId: subjectId } });
};

export const openAdminUser = (navigate, userId, { role, groupId } = {}) => {
  if (!userId) return;
  navigate(buildAdminUsersHref({ role, groupId }), { state: { viewUserId: userId } });
};
