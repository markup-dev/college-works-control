import React from 'react';
import studentIcon from '../../../assets/welcome/student.svg';
import emailIcon from '../../../assets/email.svg';
import phoneIcon from '../../../assets/phone.svg';
import buildingIcon from '../../../assets/classical-building.svg';
import './Footer.scss';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4 className='footer-brand-title'>
            <img
              className='footer-brand-icon'
              src={studentIcon}
              alt=''
              aria-hidden
            />
            <span>Учебный портал колледжа</span>
          </h4>
          <p>Система автоматизации контроля учебных работ для студентов и преподавателей</p>
        </div>

        <div className="footer-section">
          <h5>Контакты</h5>
          <div className="footer-contacts">
            <p>
              <img
                className="footer-contact-icon"
                src={emailIcon}
                alt=""
                aria-hidden
              />
              <span>info@college.ru</span>
            </p>
            <p>
              <img
                className="footer-contact-icon"
                src={phoneIcon}
                alt=""
                aria-hidden
              />
              <span>+7 (495) 123-45-67</span>
            </p>
            <p>
              <img
                className="footer-contact-icon"
                src={buildingIcon}
                alt=""
                aria-hidden
              />
              <span>Адрес: ул. Образовательная, 1, Москва</span>
            </p>
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