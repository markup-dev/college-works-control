// src/components/UI/Table/Table.jsx
import React from 'react';
import './Table.scss';

const Table = ({ 
  columns, 
  data, 
  className = '',
  striped = false,
  hoverable = false,
  emptyText = 'Данные не найдены',
  ...props 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={`table-empty ${className}`}>
        <div className="table-empty__content">
          <div className="table-empty__icon">📊</div>
          <div className="table-empty__text">{emptyText}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`table-container ${className}`}>
      <table 
        className={`table ${striped ? 'table--striped' : ''} ${hoverable ? 'table--hoverable' : ''}`} 
        {...props}
      >
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th 
                key={index} 
                style={{ width: column.width }}
                className={column.className}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, colIndex) => (
                <td key={colIndex} className={column.cellClassName}>
                  {column.render ? column.render(row[column.key], row, rowIndex) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;