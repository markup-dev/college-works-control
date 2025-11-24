import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Welcome.scss';

const Welcome = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleRoleNavigation = (role) => {
    navigate('/login', { state: { preselectedRole: role } });
  };

  const features = [
    {
      icon: '📚',
      title: 'Управление заданиями',
      description: 'Создавайте учебные задания, устанавливайте сроки сдачи, прикрепляйте материалы и критерии оценки',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      icon: '📤',
      title: 'Легкая сдача работ',
      description: 'Студенты загружают работы в несколько кликов, отслеживают статус проверки и получают уведомления',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
      icon: '✏️',
      title: 'Эффективная проверка',
      description: 'Преподаватели оценивают работы, оставляют комментарии и предоставляют обратную связь в удобном интерфейсе',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    {
      icon: '📊',
      title: 'Аналитика и отчеты',
      description: 'Получайте статистику по успеваемости, отслеживайте прогресс студентов и генерируйте отчеты',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    }
  ];

  const roles = [
    {
      icon: '👨‍🎓',
      title: 'Студент',
      features: [
        '📅 Просмотр учебных заданий и сроков',
        '📤 Простая загрузка выполненных работ',
        '📈 Отслеживание оценок и прогресса',
        '💬 Получение обратной связи от преподавателей'
      ],
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      role: 'student'
    },
    {
      icon: '👩‍🏫',
      title: 'Преподаватель',
      features: [
        '📝 Создание и управление заданиями',
        '✅ Проверка и оценка студенческих работ',
        '📊 Аналитика успеваемости группы',
        '💡 Конструктор критериев оценки'
      ],
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      role: 'teacher'
    },
    {
      icon: '⚙️',
      title: 'Администратор',
      features: [
        '👥 Управление пользователями и группами',
        '📋 Настройка учебных дисциплин',
        '📑 Генерация отчетов и статистики',
        '🔧 Администрирование системы'
      ],
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      role: 'admin'
    }
  ];

  return (
    <div className={`welcome-page ${isVisible ? 'visible' : ''}`}>
      <div className="animated-background">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <nav className="welcome-nav">
        <div className="nav-content">
          <Link to="/welcome" className="nav-brand">
            <span className="nav-logo">🎓</span>
            <span className="nav-title">Учебный портал</span>
          </Link>
          <button 
            className="nav-login-btn"
            onClick={handleGetStarted}
          >
            Войти в систему
          </button>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-orbit orbit-1"></div>
          <div className="hero-orbit orbit-2"></div>
          <div className="hero-orbit orbit-3"></div>
        </div>
        
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-icon">🚀</span>
            Современная образовательная платформа
          </div>
          
          <h1 className="hero-title">
            <span className="title-line">Контроль учебных</span>
            <span className="title-line">
              работ <span className="title-accent">стал проще</span>
            </span>
          </h1>
          
          <p className="hero-description">
            Инновационная платформа для автоматизации учебного процесса. 
            Объединяем студентов, преподавателей и администрацию в едином 
            цифровом пространстве для эффективного взаимодействия.
          </p>
          
          <div className="hero-actions">
            <button 
              className="btn-primary btn-large btn-glow"
              onClick={handleGetStarted}
            >
              <span className="btn-text">Начать работу</span>
              <span className="btn-icon">→</span>
            </button>
            <button 
              className="btn-outline btn-large"
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
            >
              Узнать возможности
            </button>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">1000+</div>
              <div className="stat-label">студентов</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">50+</div>
              <div className="stat-label">преподавателей</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">5000+</div>
              <div className="stat-label">работ проверено</div>
            </div>
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="floating-cards">
            <div className="floating-card card-1">
              <div className="card-icon">📚</div>
              <div className="card-title">Задания</div>
              <div className="card-subtitle">Учебные материалы</div>
            </div>
            <div className="floating-card card-2">
              <div className="card-icon">📊</div>
              <div className="card-title">Аналитика</div>
              <div className="card-subtitle">Статистика успеваемости</div>
            </div>
            <div className="floating-card card-3">
              <div className="card-icon">👥</div>
              <div className="card-title">Группы</div>
              <div className="card-subtitle">Учебные коллективы</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Возможности платформы</h2>
            <p className="section-subtitle">
              Все необходимое для эффективной организации учебного процесса в одном месте
            </p>
          </div>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="feature-card"
                style={{ '--gradient': feature.gradient }}
              >
                <div className="feature-icon-wrapper">
                  <div className="feature-icon-bg"></div>
                  <span className="feature-icon">{feature.icon}</span>
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
                <div className="feature-decoration"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="roles-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Выберите свою роль</h2>
            <p className="section-subtitle">
              Платформа адаптируется под ваши задачи и предоставляет соответствующий функционал
            </p>
          </div>
          
          <div className="roles-grid">
            {roles.map((role, index) => (
              <div 
                key={index}
                className="role-card"
                onClick={() => handleRoleNavigation(role.role)}
                style={{ '--gradient': role.gradient }}
              >
                <div className="role-header">
                  <div className="role-icon-wrapper">
                    <span className="role-icon">{role.icon}</span>
                  </div>
                  <h3 className="role-title">{role.title}</h3>
                </div>
                
                <ul className="role-features">
                  {role.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="role-feature">
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <button className="role-action">
                  <span>Войти как {role.title.toLowerCase()}</span>
                  <span className="action-arrow">→</span>
                </button>
                
                <div className="role-decoration"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Готовы начать работу?</h2>
            <p className="cta-description">
              Присоединяйтесь к образовательной платформе, которая уже помогает тысячам студентов и преподавателей
            </p>
            <button 
              className="btn-primary btn-xlarge btn-glow"
              onClick={handleGetStarted}
            >
              <span className="btn-text">Начать использовать платформу</span>
              <span className="btn-icon">🎓</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Welcome;