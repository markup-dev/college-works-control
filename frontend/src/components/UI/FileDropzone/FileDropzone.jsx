import React, { useRef, useState } from 'react';
import Button from '../Button/Button';
import './FileDropzone.scss';

const FileDropzone = ({
  accept = '',
  multiple = false,
  disabled = false,
  onFilesSelected,
  selectedFiles = [],
  buttonText = 'Выбрать файл',
  hint = '',
  className = '',
  showSelectedFiles = true,
}) => {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const normalizedSelectedFiles = Array.isArray(selectedFiles)
    ? selectedFiles
    : selectedFiles
      ? [selectedFiles]
      : [];

  const emitFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || disabled) {
      return;
    }
    onFilesSelected?.(multiple ? files : [files[0]]);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    if (disabled) {
      return;
    }
    inputRef.current?.click();
  };

  return (
    <div className={`file-dropzone ${isDragOver ? 'file-dropzone--drag-over' : ''} ${disabled ? 'file-dropzone--disabled' : ''} ${className}`}>
      <input
        ref={inputRef}
        type="file"
        className="file-dropzone__input"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => emitFiles(event.target.files)}
      />

      <div
        className="file-dropzone__surface"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={openFileDialog}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFileDialog();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragOver(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          emitFiles(event.dataTransfer.files);
        }}
      >
        <span className="file-dropzone__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 4a1 1 0 0 1 1 1v8.59l2.3-2.29a1 1 0 1 1 1.4 1.41l-4 3.99a1 1 0 0 1-1.4 0l-4-3.99a1 1 0 1 1 1.4-1.41L11 13.59V5a1 1 0 0 1 1-1Z" />
            <path d="M5 18a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z" />
          </svg>
        </span>
        <Button
          type="button"
          variant="outline"
          size="small"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            openFileDialog();
          }}
        >
          {buttonText}
        </Button>
        <span className="file-dropzone__text file-dropzone__text--drag-hint">
          или перетащите файл сюда
        </span>
        <span className="file-dropzone__text file-dropzone__text--tap-hint">
          Нажмите кнопку или пунктирную область — откроется выбор файла.
        </span>
      </div>

      {hint && <p className="file-dropzone__hint">{hint}</p>}

      {showSelectedFiles && normalizedSelectedFiles.length > 0 && (
        <div className="file-dropzone__selected">
          {normalizedSelectedFiles.map((file, index) => (
            <span key={`${file?.name || 'file'}-${index}`}>
              {file?.name || `Файл ${index + 1}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileDropzone;
