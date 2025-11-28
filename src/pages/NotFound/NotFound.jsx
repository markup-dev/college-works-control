import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './NotFound.scss';

const NotFound = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className={`not-found-page ${isVisible ? 'visible' : ''}`}>
      {/* Animated Background */}
      <div className="not-found-background">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
        <div className="floating-shape shape-4"></div>
      </div>

      <div className="not-found-container">
        {/* Main Content */}
        <div className="not-found-content">
          <div className="error-code">
            <span className="digit">4</span>
            <span className="digit zero">0</span>
            <span className="digit">4</span>
          </div>
          
          <div className="error-message">
            <h1 className="error-title">Страница не найдена</h1>
            <p className="error-description">
              Возможно, эта страница была перемещена или удалена. 
              Давайте вернем вас на главную страницу.
            </p>
          </div>

          {/* Animated Elements */}
          <div className="error-visual">
            <div className="lost-astronaut">
              <div className="astronaut">👨‍🚀</div>
              <div className="floating-dots">
                <div className="dot dot-1"></div>
                <div className="dot dot-2"></div>
                <div className="dot dot-3"></div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="error-actions">
            <Link to="/welcome" className="btn-primary btn-large">
              <span className="btn-icon">🏠</span>
              <span className="btn-text">На главную</span>
            </Link>
            <button 
              className="btn-outline btn-large"
              onClick={() => window.history.back()}
            >
              <span className="btn-icon">↩️</span>
              <span className="btn-text">Вернуться назад</span>
            </button>
          </div>

          {/* Additional Info */}
          <div className="error-help">
            <p>Если проблема повторяется, свяжитесь с поддержкой</p>
            <div className="help-links">
              <a href="mailto:support@university.ru" className="help-link">
                📧 support@university.ru
              </a>
              <a href="tel:+78001234567" className="help-link">
                📞 8 (800) 123-45-67
              </a>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="decoration-orbits">
          <div className="orbit orbit-1"></div>
          <div className="orbit orbit-2"></div>
          <div className="orbit orbit-3"></div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
