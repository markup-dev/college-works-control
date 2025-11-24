import React from 'react';
import './Footer.scss';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>🎓 Учебный портал колледжа</h4>
          <p>Система автоматизации контроля учебных работ для студентов и преподавателей</p>
        </div>

        <div className="footer-section">
          <h5>Контакты</h5>
          <div className="footer-contacts">
            <p>📧 info@college.ru</p>
            <p>📞 +7 (495) 123-45-67</p>
            <p>🏛️ Адрес: ул. Образовательная, 1, Москва</p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-copyright">
          <p>&copy; {currentYear} Учебный портал колледжа. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;