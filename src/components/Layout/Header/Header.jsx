import React from 'react';
import { NavLink, Link } from 'react-router-dom';
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

  return (
    <header className="header">
      <div className="header__content">
        <div className="header__left">
          <h1 className="header__title">
            <Link to="/welcome">🎓 Учебный портал</Link>
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
          <span className="header__user">Привет, {user?.name || user?.login}!</span>
          <button className="header__logout" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;