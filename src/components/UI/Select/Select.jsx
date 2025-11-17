import React from 'react';
import './Select.scss';

const Select = ({ 
  label, 
  value, 
  onChange, 
  options = [], 
  error,
  placeholder = "Выберите...",
  required = false,
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`select-group ${className}`}>
      {label && (
        <label className="select-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <select
        className={`select ${error ? 'select--error' : ''} ${disabled ? 'select--disabled' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <div className="select-error">{error}</div>}
    </div>
  );
};

export default Select;