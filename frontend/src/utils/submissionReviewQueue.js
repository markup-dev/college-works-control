/**
 * Подсказки для очереди проверки преподавателя (дедлайн задания относительно сегодня).
 */
export const getDeadlineReviewHint = (assignmentDeadline, submissionStatus) => {
  if (!assignmentDeadline || submissionStatus !== 'submitted') {
    return null;
  }
  const d = new Date(`${assignmentDeadline}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return { label: 'Срок сдачи прошёл', tone: 'overdue' };
  }
  if (diffDays === 0) {
    return { label: 'Дедлайн сегодня', tone: 'today' };
  }
  if (diffDays <= 3) {
    return { label: `До дедлайна: ${diffDays} дн.`, tone: 'soon' };
  }
  return { label: `Дедлайн через ${diffDays} дн.`, tone: 'normal' };
};
