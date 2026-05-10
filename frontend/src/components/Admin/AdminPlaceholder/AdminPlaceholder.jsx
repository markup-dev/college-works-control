import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../UI/Card/Card';
import './AdminPlaceholder.scss';

const AdminPlaceholder = ({ title, hint }) => (
  <div className="admin-placeholder app-page">
    <Card className="admin-placeholder__card" padding="large" shadow="small">
      <h1 className="admin-placeholder__title">{title}</h1>
      <p className="admin-placeholder__text">{hint || 'Раздел будет подключён на следующем этапе.'}</p>
      <Link className="admin-placeholder__back" to="/admin/dashboard">
        К дашборду
      </Link>
    </Card>
  </div>
);

export default AdminPlaceholder;
