import React from 'react';
import { downloadRequestDocument, openRequestDocument } from '../../../utils/teacherRequestDocuments';
import './RequestDocumentsList.scss';

export const RequestDocumentsList = ({
  apiClient,
  scope = 'teacher',
  requestKind,
  requestId,
  documents = [],
  className = '',
  onError,
}) => {
  if (!documents.length) {
    return <p className="request-documents-list__empty">Файлы не прикреплены</p>;
  }

  const handleOpen = async (document) => {
    try {
      await openRequestDocument(apiClient, {
        scope,
        requestKind,
        requestId,
        documentId: document.id,
        fileName: document.name,
      });
    } catch {
      onError?.('Не удалось открыть файл');
    }
  };

  const handleDownload = async (document) => {
    try {
      await downloadRequestDocument(apiClient, {
        scope,
        requestKind,
        requestId,
        documentId: document.id,
        fileName: document.name,
      });
    } catch {
      onError?.('Не удалось скачать файл');
    }
  };

  return (
    <ul className={`request-documents-list ${className}`.trim()}>
      {documents.map((document) => (
        <li key={document.id} className="request-documents-list__item">
          <span className="request-documents-list__name" title={document.name}>
            {document.name}
          </span>
          <div className="request-documents-list__actions">
            <button type="button" className="request-documents-list__action" onClick={() => void handleOpen(document)}>
              Открыть
            </button>
            <button type="button" className="request-documents-list__action" onClick={() => void handleDownload(document)}>
              Скачать
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default RequestDocumentsList;
