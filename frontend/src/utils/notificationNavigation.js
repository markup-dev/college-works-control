/**
 * Путь для перехода с экрана уведомлений (данные уже в camelCase после api interceptor).
 */
export function getNotificationNavigatePath(role, data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const kind = data.kind;
  const assignmentId = data.assignmentId ?? data.assignment_id;
  const submissionId = data.submissionId ?? data.submission_id;
  if (assignmentId === undefined || assignmentId === null || assignmentId === '') {
    return null;
  }
  const aid = String(assignmentId);

  if (role === 'student') {
    let focus = 'details';
    if (kind === 'submission_graded') {
      focus = 'results';
    } else if (kind === 'submission_returned') {
      focus = 'details';
    }
    return `/student?assignment=${encodeURIComponent(aid)}&focus=${encodeURIComponent(focus)}`;
  }

  if (role === 'teacher') {
    const base = `/teacher?tab=submissions&assignment=${encodeURIComponent(aid)}`;
    if (submissionId !== undefined && submissionId !== null && submissionId !== '') {
      return `${base}&submission=${encodeURIComponent(String(submissionId))}`;
    }
    return base;
  }

  return null;
}
