import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import logo from '../../../assets/logo-border-gradient.svg';
import './Header.scss';

const Header = ({ user, onLogout }) => {
  const handleLogout = () => {
    onLogout();
  };

  const getRoleLabel = (role) => {
    const roles = {
      student: '👨‍🎓 Студент',
      teacher: '👩‍🏫 Преподаватель',
      admin: '⚙️ Администратор'
    };
    return roles[role] || role;
  };

  const getFirstName = (userData) => {
    if (!userData) return '';
    if (userData.firstName) return userData.firstName;
    if (userData.fullName) {
      const parts = userData.fullName.trim().split(' ');
      return parts.length > 1 ? parts[1] : parts[0] || userData.fullName;
    }
    return userData.login || '';
  };

  return (
    <header className="header">
      <div className="header__content">
        <div className="header__left">
          <h1 className="header__title">
            <Link to="/welcome">
              <img src={logo} alt="Логотип" className="header__logo" />
            </Link>
          </h1>
          <span className="header__role">
            {getRoleLabel(user?.role)}
          </span>
        </div>

        <nav className="header__nav">
          <NavLink 
            to={`/${user?.role || ''}`} 
            className={({ isActive }) => `header__link ${isActive ? 'header__link--active' : ''}`}
          >
            Дашборд
          </NavLink>
          <NavLink 
            to="/profile" 
            className={({ isActive }) => `header__link ${isActive ? 'header__link--active' : ''}`}
          >
            Профиль
          </NavLink>
        </nav>
        
        <div className="header__right">
          <span className="header__user">Привет, {getFirstName(user)}!</span>
          <button className="header__logout" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;