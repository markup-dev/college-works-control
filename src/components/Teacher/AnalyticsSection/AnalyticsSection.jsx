import React from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import './AnalyticsSection.scss';

const AnalyticsSection = ({ submissions = [], assignments = [] }) => {
  const groupStats = React.useMemo(() => {
    const groups = {};
    submissions.forEach(sub => {
      const group = sub.group || 'Не указана';
      if (!groups[group]) {
        groups[group] = { total: 0, submitted: 0, graded: 0 };
      }
      groups[group].total++;
      if (sub.status === 'submitted') {
        groups[group].submitted++;
      }
      if (sub.status === 'graded') {
        groups[group].graded++;
      }
    });
    return groups;
  }, [submissions]);

  const courseStats = React.useMemo(() => {
    const courses = {};
    assignments.forEach(assignment => {
      const course = assignment.course || 'Не указана';
      if (!courses[course]) {
        courses[course] = { total: 0, sum: 0, count: 0 };
      }
      const courseSubmissions = submissions.filter(s => s.assignmentId === assignment.id && s.score !== null && s.score !== undefined);
      courses[course].total += courseSubmissions.length;
      courses[course].sum += courseSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
      courses[course].count += courseSubmissions.length;
    });
    return courses;
  }, [assignments, submissions]);

  const handleExport = () => {
    const rows = [
      ['Тип', 'Название', 'Метрика', 'Значение']
    ];

    Object.entries(groupStats).forEach(([groupName, stats]) => {
      rows.push(['Группа', groupName, 'Всего работ', stats.total]);
      rows.push(['Группа', groupName, 'Сдано', stats.submitted]);
      rows.push(['Группа', groupName, 'Проверено', stats.graded]);
    });

    Object.entries(courseStats).forEach(([courseName, stats]) => {
      const average = stats.count > 0 ? (stats.sum / stats.count).toFixed(2) : '0.00';
      rows.push(['Курс', courseName, 'Оцененных работ', stats.count]);
      rows.push(['Курс', courseName, 'Средний балл', average]);
    });

    const summaryRow = [
      ['Итого', 'Системно', 'Работ в системе', submissions.length]
    ];
    rows.push(...summaryRow);

    const csvContent = rows
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="analytics-section">
      <div className="section-header">
        <h2>Аналитика успеваемости</h2>
        <Button variant="outline" onClick={handleExport}>
          📊 Экспорт в CSV
        </Button>
      </div>
      
      <div className="analytics-grid">
        <GroupStatsCard groupStats={groupStats} />
        <AverageGradesCard courseStats={courseStats} />
        <ActivityChartCard submissions={submissions} />
      </div>
    </div>
  );
};

const GroupStatsCard = ({ groupStats = {} }) => {
  const groups = Object.entries(groupStats).map(([groupName, stats]) => {
    const percentage = stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;
    return {
      groupName,
      percentage,
      value: `${stats.submitted}/${stats.total} сдано`,
      stats
    };
  });

  if (groups.length === 0) {
    return (
      <Card className="analytics-card">
        <h3>Статистика по группам</h3>
        <div className="empty-stats">
          <p>Нет данных для отображения</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="analytics-card">
      <h3>Статистика по группам</h3>
      <div className="group-stats">
        {groups.map(({ groupName, percentage, value }) => (
          <GroupStat 
            key={groupName}
            groupName={groupName} 
            percentage={percentage} 
            value={value} 
          />
        ))}
      </div>
    </Card>
  );
};

const GroupStat = ({ groupName, percentage, value }) => (
  <div className="group-stat">
    <span className="group-name">{groupName}</span>
    <div className="stat-bar">
      <div 
        className="bar-fill" 
        style={{width: `${percentage}%`}}
      ></div>
    </div>
    <span className="stat-value">{value}</span>
  </div>
);

const AverageGradesCard = ({ courseStats = {} }) => {
  const courses = Object.entries(courseStats)
    .map(([course, stats]) => ({
      course,
      average: stats.count > 0 ? (stats.sum / stats.count).toFixed(1) : 0
    }))
    .filter(item => item.average > 0)
    .sort((a, b) => parseFloat(b.average) - parseFloat(a.average));

  if (courses.length === 0) {
    return (
      <Card className="analytics-card">
        <h3>Средние оценки по дисциплинам</h3>
        <div className="empty-stats">
          <p>Нет данных для отображения</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="analytics-card">
      <h3>Средние оценки по дисциплинам</h3>
      <div className="average-grades">
        {courses.map(({ course, average }) => (
          <GradeItem key={course} subject={course} grade={parseFloat(average)} />
        ))}
      </div>
    </Card>
  );
};

const GradeItem = ({ subject, grade }) => (
  <div className="grade-item">
    <span>{subject}</span>
    <span className="grade-value">{grade}</span>
  </div>
);

const ActivityChartCard = ({ submissions = [] }) => {
  const monthlyData = React.useMemo(() => {
    const months = {};
    submissions.forEach(sub => {
      const date = new Date(sub.submissionDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!months[monthKey]) {
        months[monthKey] = { submitted: 0, graded: 0 };
      }
      if (sub.status === 'submitted') {
        months[monthKey].submitted++;
      }
      if (sub.status === 'graded') {
        months[monthKey].graded++;
      }
    });
    return months;
  }, [submissions]);

  return (
  <Card className="analytics-card wide">
    <h3>Активность сдачи работ</h3>
    <div className="activity-chart">
      <div className="chart-header">
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-color submitted"></span>
            <span>Сдано работ</span>
          </div>
          <div className="legend-item">
            <span className="legend-color graded"></span>
            <span>Проверено работ</span>
          </div>
        </div>
        <div className="time-period">
          <select defaultValue="month">
            <option value="week">За неделю</option>
            <option value="month">За месяц</option>
            <option value="semester">За семестр</option>
          </select>
        </div>
      </div>
      <div className="chart-placeholder">
        {Object.keys(monthlyData).length > 0 ? (
          <div className="chart-mock">
            <div className="chart-bars">
              {Object.entries(monthlyData).map(([monthKey, data], index) => {
                const maxValue = Math.max(...Object.values(monthlyData).map(d => Math.max(d.submitted, d.graded)));
                const submittedHeight = maxValue > 0 ? (data.submitted / maxValue) * 100 : 0;
                const gradedHeight = maxValue > 0 ? (data.graded / maxValue) * 100 : 0;
                return (
                  <div key={monthKey} className="chart-bar">
                    <div 
                      className="bar submitted" 
                      style={{height: `${submittedHeight}%`}}
                    ></div>
                    <div 
                      className="bar graded" 
                      style={{height: `${gradedHeight}%`}}
                    ></div>
                  </div>
                );
              })}
            </div>
            <div className="chart-labels">
              {Object.keys(monthlyData).map(monthKey => {
                const date = new Date(monthKey + '-01');
                const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
                return (
                  <span key={monthKey} className="chart-label">
                    {monthNames[date.getMonth()]}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="empty-chart">
            <p>Нет данных для отображения</p>
          </div>
        )}
      </div>
    </div>
  </Card>
  );
};

export default AnalyticsSection;