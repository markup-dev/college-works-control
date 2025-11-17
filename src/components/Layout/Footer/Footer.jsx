import React from 'react';
import './Footer.scss';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>Учебный портал колледжа</h4>
          <p>Система автоматизации контроля учебных работ</p>
          <div className="footer-contacts">
            <p>📧 info@college.ru</p>
            <p>📞 +7 (495) 123-45-67</p>
          </div>
        </div>

        <div className="footer-section">
          <h5>Быстрые ссылки</h5>
          <ul className="footer-links">
            <li><a href="/student">Дашборд студента</a></li>
            <li><a href="/teacher">Дашборд преподавателя</a></li>
            <li><a href="/login">Вход в систему</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h5>Поддержка</h5>
          <ul className="footer-links">
            <li><a href="/help">Помощь</a></li>
            <li><a href="/docs">Документация</a></li>
            <li><a href="/contacts">Контакты</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h5>Система</h5>
          <div className="system-info">
            <p>Версия: 1.0.0</p>
            <p>Статус: <span className="status-active">● Активна</span></p>
            <p>Пользователей: 150+</p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-copyright">
          <p>&copy; {currentYear} Учебный портал. Все права защищены.</p>
        </div>
        <div className="footer-developers">
          <p>Разработано специально для колледжа</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;