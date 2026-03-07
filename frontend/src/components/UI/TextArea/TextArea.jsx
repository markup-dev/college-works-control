import React from 'react';
import './TextArea.scss';

const TextArea = ({ 
  label, 
  value, 
  onChange, 
  error,
  placeholder = "",
  required = false,
  disabled = false,
  rows = 3,
  className = ''
}) => {
  return (
    <div className={`textarea-group ${className}`}>
      {label && (
        <label className="textarea-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <textarea
        className={`textarea ${error ? 'textarea--error' : ''} ${disabled ? 'textarea--disabled' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
      />
      {error && <div className="textarea-error">{error}</div>}
    </div>
  );
};

export default TextArea;