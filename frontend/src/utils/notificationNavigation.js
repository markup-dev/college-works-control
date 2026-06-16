const TEACHER_DISCIPLINES_TAB = '/teacher?tab=disciplines';

const TEACHER_DISCIPLINES_ACTIONS = new Set([
  'teacher_subject_request_resolved',
  'teaching_load_request_resolved',
  'teacher_subject_changed',
  'teacher_subject_disabled',
  'teaching_load_assigned',
  'teaching_load_removed',
  'subject_deactivated_teacher_subject',
  'subject_deactivated_teaching_load',
]);

/**
 * Путь для перехода с экрана уведомлений (данные уже в camelCase после api interceptor).
 */
export function getNotificationNavigatePath(role, data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const kind = data.kind;
  const action = data.action;

  if (role === 'admin') {
    if (kind === 'teacher_discipline_request') {
      return '/admin/subjects';
    }
    if (kind === 'teacher_teaching_load_request') {
      return '/admin/assignments';
    }
  }

  if (role === 'teacher' && kind === 'admin_action' && TEACHER_DISCIPLINES_ACTIONS.has(action)) {
    return TEACHER_DISCIPLINES_TAB;
  }

  const assignmentId = data.assignmentId;
  const submissionId = data.submissionId;
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
    const openAssignmentsTab = kind === 'admin_action'
      && (action === 'assignment_teacher_assigned' || action === 'assignment_teacher_removed');

    if (openAssignmentsTab) {
      return `/teacher?tab=assignments&assignment=${encodeURIComponent(aid)}`;
    }

    const base = `/teacher?tab=submissions&assignment=${encodeURIComponent(aid)}`;
    if (submissionId !== undefined && submissionId !== null && submissionId !== '') {
      return `${base}&submission=${encodeURIComponent(String(submissionId))}`;
    }
    return base;
  }

  return null;
}
