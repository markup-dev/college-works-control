import React from 'react';
import Card from '../../UI/Card/Card';
import './StatisticsSection.scss';

const StatisticsSection = ({ stats, users, courses, submissions = [] }) => {
  const userStats = {
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    admins: users.filter(u => u.role === 'admin').length,
    activeUsers: users.filter(u => u.status === 'active').length,
    inactiveUsers: users.filter(u => u.status === 'inactive').length,
    totalUsers: users.length
  };

  const courseStats = {
    activeCourses: courses.filter(c => c.status === 'active').length,
    inactiveCourses: courses.filter(c => c.status === 'inactive').length,
    totalCourses: courses.length,
    totalStudents: courses.reduce((sum, course) => sum + (course.studentsCount || 0), 0),
    avgStudents: Math.round(courses.reduce((sum, course) => sum + (course.studentsCount || 0), 0) / courses.length) || 0,
    totalAssignments: courses.reduce((sum, course) => sum + (course.assignmentsCount || 0), 0)
  };

  const submissionStats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === 'submitted').length,
    graded: submissions.filter(s => s.status === 'graded').length,
    returned: submissions.filter(s => s.status === 'returned').length,
    notSubmitted: submissions.filter(s => s.status === 'not_submitted').length
  };

  const progressPercentage = submissionStats.total > 0 
    ? ((submissionStats.graded + submissionStats.returned) / submissionStats.total) * 100 
    : 0;

  return (
    <div className="statistics-section">
      <div className="statistics-header">
        <h2>📊 Статистика системы</h2>
        <p>Обзор активности и производительности учебного портала</p>
      </div>
      
      <div className="stats-grid">
        {/* Основные метрики */}
        <Card className="stat-card overview-card" hoverable>
          <div className="card-header">
            <div className="card-icon">📈</div>
            <h3>Ключевые показатели</h3>
          </div>
          <div className="metrics-grid">
            <MetricCard 
              icon="👥"
              value={userStats.totalUsers}
              label="Всего пользователей"
              trend="+12%"
              color="primary"
            />
            <MetricCard 
              icon="📚"
              value={courseStats.totalCourses}
              label="Активных курсов"
              trend="+5%"
              color="success"
            />
            <MetricCard 
              icon="📝"
              value={stats.totalAssignments || courseStats.totalAssignments}
              label="Всего заданий"
              trend="+8%"
              color="info"
            />
            <MetricCard 
              icon="⏳"
              value={submissionStats.pending}
              label="Работ на проверке"
              trend="−3%"
              color="warning"
            />
          </div>
        </Card>

        {/* Статистика пользователей */}
        <Card className="stat-card users-card" hoverable>
          <div className="card-header">
            <div className="card-icon">👥</div>
            <h3>Пользователи</h3>
          </div>
          <div className="users-chart">
            <div className="chart-bars">
              <ChartBar 
                label="Студенты"
                value={userStats.students}
                total={userStats.totalUsers}
                color="var(--primary-color)"
                icon="🎓"
              />
              <ChartBar 
                label="Преподаватели"
                value={userStats.teachers}
                total={userStats.totalUsers}
                color="var(--success-color)"
                icon="👨‍🏫"
              />
              <ChartBar 
                label="Администраторы"
                value={userStats.admins}
                total={userStats.totalUsers}
                color="var(--warning-color)"
                icon="⚙️"
              />
            </div>
            <div className="users-summary">
              <SummaryItem 
                label="Активных пользователей"
                value={userStats.activeUsers}
                total={userStats.totalUsers}
                type="success"
              />
              <SummaryItem 
                label="Неактивных пользователей"
                value={userStats.inactiveUsers}
                total={userStats.totalUsers}
                type="danger"
              />
            </div>
          </div>
        </Card>

        {/* Статистика курсов */}
        <Card className="stat-card courses-card" hoverable>
          <div className="card-header">
            <div className="card-icon">📚</div>
            <h3>Курсы и задания</h3>
          </div>
          <div className="courses-stats">
            <div className="stats-row">
              <StatItem 
                value={courseStats.activeCourses}
                label="Активных курсов"
                icon="✅"
                color="success"
              />
              <StatItem 
                value={courseStats.inactiveCourses}
                label="Неактивных курсов"
                icon="⏸️"
                color="secondary"
              />
            </div>
            <div className="stats-row">
              <StatItem 
                value={courseStats.totalStudents}
                label="Всего студентов"
                icon="👨‍🎓"
                color="primary"
              />
              <StatItem 
                value={courseStats.avgStudents}
                label="Среднее на курс"
                icon="📊"
                color="info"
              />
            </div>
            <div className="total-assignments">
              <div className="assignments-icon">📋</div>
              <div className="assignments-info">
                <div className="assignments-count">{courseStats.totalAssignments}</div>
                <div className="assignments-label">Всего заданий в системе</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Статистика работ */}
        <Card className="stat-card submissions-card" hoverable>
          <div className="card-header">
            <div className="card-icon">📝</div>
            <h3>Работы студентов</h3>
          </div>
          <div className="submissions-overview">
            <div className="submission-stats-grid">
              <SubmissionStat 
                count={submissionStats.pending}
                label="На проверке"
                icon="⏳"
                type="warning"
              />
              <SubmissionStat 
                count={submissionStats.graded}
                label="Оценено"
                icon="✅"
                type="success"
              />
              <SubmissionStat 
                count={submissionStats.returned}
                label="Возвращено"
                icon="↩️"
                type="danger"
              />
              <SubmissionStat 
                count={submissionStats.notSubmitted}
                label="Не сдано"
                icon="📭"
                type="secondary"
              />
            </div>
            <div className="progress-section">
              <div className="progress-header">
                <span>Прогресс проверки</span>
                <span className="progress-percent">{progressPercentage.toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="progress-stats">
                <span>Проверено: {submissionStats.graded + submissionStats.returned} из {submissionStats.total}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Вспомогательные компоненты
const MetricCard = ({ icon, value, label, trend, color }) => (
  <div className={`metric-card metric-card--${color}`}>
    <div className="metric-icon">{icon}</div>
    <div className="metric-content">
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
    <div className={`metric-trend metric-trend--${trend.includes('+') ? 'up' : 'down'}`}>
      {trend}
    </div>
  </div>
);

const ChartBar = ({ label, value, total, color, icon }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  
  return (
    <div className="chart-bar">
      <div className="bar-info">
        <span className="bar-icon">{icon}</span>
        <span className="bar-label">{label}</span>
      </div>
      <div className="bar-container">
        <div 
          className="bar-fill" 
          style={{ 
            width: `${percentage}%`,
            backgroundColor: color
          }}
        ></div>
      </div>
      <div className="bar-value">
        {value} <span className="bar-percent">({percentage.toFixed(0)}%)</span>
      </div>
    </div>
  );
};

const SummaryItem = ({ label, value, total, type }) => (
  <div className="summary-item">
    <span className="summary-label">{label}</span>
    <div className="summary-value">
      <span className={`value-number value-number--${type}`}>{value}</span>
      <span className="value-total">/ {total}</span>
    </div>
  </div>
);

const StatItem = ({ value, label, icon, color }) => (
  <div className="stat-item">
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <div className={`stat-value stat-value--${color}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  </div>
);

const SubmissionStat = ({ count, label, icon, type }) => (
  <div className={`submission-stat submission-stat--${type}`}>
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <div className="stat-count">{count}</div>
      <div className="stat-label">{label}</div>
    </div>
  </div>
);

export default StatisticsSection;