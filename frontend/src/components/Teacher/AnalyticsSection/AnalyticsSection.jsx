import React from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import { formatDate } from '../../../utils';
import './AnalyticsSection.scss';

const PERIOD_OPTIONS = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: 'all', label: 'Все время' },
];

const parseDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getSubmissionDate = (submission) => (
  parseDate(submission?.submissionDate)
  || parseDate(submission?.submittedAt)
  || parseDate(submission?.createdAt)
  || parseDate(submission?.created_at)
  || null
);

const normalizeScore = (score) => {
  if (score === null || score === undefined || score === '') {
    return null;
  }
  const num = Number(score);
  return Number.isFinite(num) ? num : null;
};

const AnalyticsSection = ({ submissions = [], assignments = [] }) => {
  const [period, setPeriod] = React.useState('30');

  const dateThreshold = React.useMemo(() => {
    if (period === 'all') {
      return null;
    }
    const days = Number(period);
    if (!Number.isFinite(days)) {
      return null;
    }
    const threshold = new Date();
    threshold.setHours(0, 0, 0, 0);
    threshold.setDate(threshold.getDate() - days);
    return threshold;
  }, [period]);

  const submissionsInPeriod = React.useMemo(
    () => submissions.filter((submission) => {
      const date = getSubmissionDate(submission);
      if (!date) {
        return period === 'all';
      }
      return !dateThreshold || date >= dateThreshold;
    }),
    [submissions, dateThreshold, period]
  );

  const latestSubmissions = React.useMemo(() => {
    const map = new Map();
    [...submissionsInPeriod]
      .sort((a, b) => (getSubmissionDate(b)?.getTime() || 0) - (getSubmissionDate(a)?.getTime() || 0))
      .forEach((submission) => {
        const studentKey = submission.studentId || submission.studentLogin || submission.studentName || 'unknown';
        const key = `${submission.assignmentId || 'unknown'}::${studentKey}`;
        if (!map.has(key)) {
          map.set(key, submission);
        }
      });

    return Array.from(map.values());
  }, [submissionsInPeriod]);

  const assignmentMap = React.useMemo(
    () => new Map(assignments.map((assignment) => [assignment.id, assignment])),
    [assignments]
  );

  const kpi = React.useMemo(() => {
    const pending = latestSubmissions.filter((submission) => submission.status === 'submitted').length;
    const graded = latestSubmissions.filter((submission) => submission.status === 'graded').length;
    const returned = latestSubmissions.filter((submission) => submission.status === 'returned').length;
    const total = latestSubmissions.length;

    const gradedScores = latestSubmissions
      .filter((submission) => submission.status === 'graded')
      .map((submission) => normalizeScore(submission.score))
      .filter((score) => score !== null);

    const averageScore = gradedScores.length > 0
      ? (gradedScores.reduce((sum, score) => sum + score, 0) / gradedScores.length)
      : null;

    return {
      total,
      pending,
      graded,
      returned,
      avgScore: averageScore,
      returnRate: total > 0 ? Math.round((returned / total) * 100) : 0,
      gradedRate: total > 0 ? Math.round((graded / total) * 100) : 0,
    };
  }, [latestSubmissions]);

  const assignmentInsights = React.useMemo(() => {
    const grouped = new Map();
    latestSubmissions.forEach((submission) => {
      const assignmentId = submission.assignmentId;
      if (!grouped.has(assignmentId)) {
        grouped.set(assignmentId, []);
      }
      grouped.get(assignmentId).push(submission);
    });

    return Array.from(grouped.entries())
      .map(([assignmentId, rows]) => {
        const assignment = assignmentMap.get(assignmentId) || {};
        const pending = rows.filter((row) => row.status === 'submitted').length;
        const returned = rows.filter((row) => row.status === 'returned').length;
        const graded = rows.filter((row) => row.status === 'graded').length;
        const submitted = rows.filter((row) => ['submitted', 'graded', 'returned'].includes(row.status)).length;
        const expected = Number(assignment.totalStudents || assignment.total_students || rows.length || 0);
        const completionRate = expected > 0 ? Math.round((submitted / expected) * 100) : 0;
        const scores = rows
          .map((row) => normalizeScore(row.score))
          .filter((score) => score !== null);
        const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;

        return {
          id: assignmentId,
          title: assignment.title || rows[0]?.assignmentTitle || 'Без названия',
          subject: assignment.subject || 'Без предмета',
          pending,
          returned,
          graded,
          completionRate,
          avgScore,
        };
      })
      .sort((a, b) => (b.pending - a.pending) || (b.returned - a.returned))
      .slice(0, 8);
  }, [latestSubmissions, assignmentMap]);

  const reviewQueue = React.useMemo(
    () => latestSubmissions
      .filter((submission) => submission.status === 'submitted')
      .sort((a, b) => (getSubmissionDate(a)?.getTime() || 0) - (getSubmissionDate(b)?.getTime() || 0))
      .slice(0, 8),
    [latestSubmissions]
  );

  const studentRisks = React.useMemo(() => {
    const grouped = new Map();
    latestSubmissions.forEach((submission) => {
      const key = submission.studentId || submission.studentLogin || submission.studentName || 'unknown';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(submission);
    });

    return Array.from(grouped.values())
      .map((rows) => {
        const name = rows[0]?.studentName || rows[0]?.studentLogin || 'Студент';
        const group = rows[0]?.group || '—';
        const returnedCount = rows.filter((row) => row.status === 'returned').length;
        const pendingCount = rows.filter((row) => row.status === 'submitted').length;
        const scores = rows
          .map((row) => normalizeScore(row.score))
          .filter((score) => score !== null);
        const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
        const riskScore = returnedCount * 2 + pendingCount + ((avgScore !== null && avgScore < 60) ? 2 : 0);

        return {
          name,
          group,
          returnedCount,
          pendingCount,
          avgScore,
          riskScore,
        };
      })
      .filter((student) => student.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8);
  }, [latestSubmissions]);

  const groupSummary = React.useMemo(() => {
    const grouped = new Map();
    latestSubmissions.forEach((submission) => {
      const groupName = submission.group || 'Не указана';
      if (!grouped.has(groupName)) {
        grouped.set(groupName, { total: 0, pending: 0, graded: 0, returned: 0 });
      }
      const stats = grouped.get(groupName);
      stats.total += 1;
      if (submission.status === 'submitted') stats.pending += 1;
      if (submission.status === 'graded') stats.graded += 1;
      if (submission.status === 'returned') stats.returned += 1;
    });

    return Array.from(grouped.entries())
      .map(([group, stats]) => ({ group, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [latestSubmissions]);

  const activity = React.useMemo(() => {
    const weeksCount = period === '7' ? 2 : period === '30' ? 6 : period === '90' ? 10 : 12;
    const buckets = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((weeksCount - 1) * 7));

    for (let index = 0; index < weeksCount; index += 1) {
      const bucketStart = new Date(start);
      bucketStart.setDate(start.getDate() + index * 7);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketStart.getDate() + 6);
      buckets.push({
        key: `${bucketStart.toISOString()}-${bucketEnd.toISOString()}`,
        label: `${bucketStart.getDate()}.${bucketStart.getMonth() + 1}`,
        start: bucketStart,
        end: bucketEnd,
        submitted: 0,
        graded: 0,
      });
    }

    submissionsInPeriod.forEach((submission) => {
      const date = getSubmissionDate(submission);
      if (!date) return;
      const target = buckets.find((bucket) => date >= bucket.start && date <= bucket.end);
      if (!target) return;

      target.submitted += 1;
      if (submission.status === 'graded') {
        target.graded += 1;
      }
    });

    return buckets;
  }, [submissionsInPeriod, period]);

  const handleExport = React.useCallback(() => {
    const rows = [
      ['Тип', 'Название', 'Метрика', 'Значение'],
      ['KPI', 'Работ в срезе', 'Всего', kpi.total],
      ['KPI', 'Работ в срезе', 'На проверке', kpi.pending],
      ['KPI', 'Работ в срезе', 'Проверено', kpi.graded],
      ['KPI', 'Работ в срезе', 'Возвращено', kpi.returned],
      ['KPI', 'Работ в срезе', 'Средний балл', kpi.avgScore !== null ? kpi.avgScore.toFixed(1) : '—'],
      ['KPI', 'Работ в срезе', 'Доля возвратов, %', kpi.returnRate],
      ['KPI', 'Работ в срезе', 'Доля проверенных, %', kpi.gradedRate],
    ];

    assignmentInsights.forEach((item) => {
      rows.push(['Задание', item.title, 'На проверке', item.pending]);
      rows.push(['Задание', item.title, 'Возвращено', item.returned]);
      rows.push(['Задание', item.title, 'Проверено', item.graded]);
      rows.push(['Задание', item.title, 'Прогресс, %', item.completionRate]);
      rows.push(['Задание', item.title, 'Средний балл', item.avgScore !== null ? item.avgScore.toFixed(1) : '—']);
    });

    studentRisks.forEach((item) => {
      rows.push(['Студент', item.name, 'Группа', item.group]);
      rows.push(['Студент', item.name, 'Возвраты', item.returnedCount]);
      rows.push(['Студент', item.name, 'На проверке', item.pendingCount]);
      rows.push(['Студент', item.name, 'Средний балл', item.avgScore !== null ? item.avgScore.toFixed(1) : '—']);
    });

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teacher-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [kpi, assignmentInsights, studentRisks]);

  return (
    <div className="analytics-section">
      <div className="analytics-section__header">
        <div>
          <h2>Аналитика</h2>
          <p>Показывает текущую нагрузку, качество проверки и рисковые зоны.</p>
        </div>
        <div className="analytics-section__controls">
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button variant="outline" onClick={handleExport}>
            Экспорт CSV
          </Button>
        </div>
      </div>

      <div className="analytics-kpi">
        <KpiCard label="Работ в срезе" value={kpi.total} tone="default" />
        <KpiCard label="На проверке" value={kpi.pending} tone="warning" />
        <KpiCard label="Проверено" value={kpi.graded} tone="success" />
        <KpiCard label="Возвращено" value={kpi.returned} tone="danger" />
        <KpiCard label="Средний балл" value={kpi.avgScore !== null ? kpi.avgScore.toFixed(1) : '—'} tone="info" />
        <KpiCard label="Доля возвратов" value={`${kpi.returnRate}%`} tone="secondary" />
      </div>

      <div className="analytics-grid">
        <Card className="analytics-card analytics-card--queue">
          <h3>Сначала проверить</h3>
          {reviewQueue.length === 0 ? (
            <EmptyState text="Новых непроверенных работ нет." />
          ) : (
            <ul className="analytics-list">
              {reviewQueue.map((submission) => (
                <li key={submission.id} className="analytics-list__item">
                  <div>
                    <p className="analytics-list__title">{submission.studentName}</p>
                    <p className="analytics-list__meta">{submission.assignmentTitle || 'Без названия'}</p>
                  </div>
                  <span className="analytics-list__date">{formatDate(getSubmissionDate(submission))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="analytics-card">
          <h3>Проблемные задания</h3>
          {assignmentInsights.length === 0 ? (
            <EmptyState text="Недостаточно данных по заданиям." />
          ) : (
            <div className="assignment-insights">
              {assignmentInsights.map((item) => (
                <div className="assignment-insights__item" key={item.id}>
                  <div className="assignment-insights__top">
                    <p className="assignment-insights__title">{item.title}</p>
                    <span className="assignment-insights__subject">{item.subject}</span>
                  </div>
                  <div className="assignment-insights__stats">
                    <span>На проверке: <strong>{item.pending}</strong></span>
                    <span>Возвраты: <strong>{item.returned}</strong></span>
                    <span>Прогресс: <strong>{item.completionRate}%</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="analytics-card analytics-card--wide">
          <h3>Динамика по неделям</h3>
          <div className="activity-chart">
            {activity.map((bucket) => (
              <div className="activity-chart__col" key={bucket.key}>
                <div className="activity-chart__bars">
                  <span
                    className="activity-chart__bar activity-chart__bar--submitted"
                    style={{ height: `${Math.max(6, bucket.submitted * 12)}px` }}
                    title={`Сдано: ${bucket.submitted}`}
                  />
                  <span
                    className="activity-chart__bar activity-chart__bar--graded"
                    style={{ height: `${Math.max(6, bucket.graded * 12)}px` }}
                    title={`Проверено: ${bucket.graded}`}
                  />
                </div>
                <span className="activity-chart__label">{bucket.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="analytics-card">
          <h3>Студенты, требующие внимания</h3>
          {studentRisks.length === 0 ? (
            <EmptyState text="Рисковые студенты не выявлены." />
          ) : (
            <ul className="analytics-list">
              {studentRisks.map((student) => (
                <li key={`${student.name}-${student.group}`} className="analytics-list__item">
                  <div>
                    <p className="analytics-list__title">{student.name}</p>
                    <p className="analytics-list__meta">{student.group}</p>
                  </div>
                  <div className="analytics-list__badges">
                    {student.returnedCount > 0 && <span>Возвраты: {student.returnedCount}</span>}
                    {student.pendingCount > 0 && <span>На проверке: {student.pendingCount}</span>}
                    {student.avgScore !== null && <span>Ср. балл: {student.avgScore.toFixed(1)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="analytics-card">
          <h3>Сводка по группам</h3>
          {groupSummary.length === 0 ? (
            <EmptyState text="Нет данных по группам." />
          ) : (
            <div className="group-summary">
              {groupSummary.map((group) => (
                <div className="group-summary__item" key={group.group}>
                  <p className="group-summary__name">{group.group}</p>
                  <p className="group-summary__stats">
                    На проверке: <strong>{group.pending}</strong> · Проверено: <strong>{group.graded}</strong> · Возвраты: <strong>{group.returned}</strong>
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, tone }) => (
  <Card className={`analytics-kpi__card analytics-kpi__card--${tone}`}>
    <p className="analytics-kpi__label">{label}</p>
    <p className="analytics-kpi__value">{value}</p>
  </Card>
);

const EmptyState = ({ text }) => (
  <div className="analytics-empty">
    <p>{text}</p>
  </div>
);

export default AnalyticsSection;