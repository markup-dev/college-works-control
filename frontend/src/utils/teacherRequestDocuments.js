export const TEACHER_REQUEST_MAX_FILES = 5;

export const TEACHER_REQUEST_FILE_HINT = `PDF, DOC/DOCX, JPG или PNG до 5 МБ. Не более ${TEACHER_REQUEST_MAX_FILES} файлов.`;

export const appendRequestDocuments = (formData, files) => {
  (files || []).forEach((file) => {
    if (file) {
      formData.append('documents[]', file);
    }
  });
};

const buildDownloadPath = ({ scope, requestKind, requestId, documentId }) => {
  const base = scope === 'admin' ? '/admin' : '/teacher';
  const segment = requestKind === 'load' ? 'teaching-load-requests' : 'discipline-requests';
  return `${base}/${segment}/${requestId}/documents/${documentId}/download`;
};

const saveBlob = (blob, fileName) => {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

const isPreviewableRequestDocument = (fileName) => {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase();
  return ['pdf', 'png', 'jpg', 'jpeg'].includes(extension || '');
};

export const downloadRequestDocument = async (apiClient, {
  scope = 'teacher',
  requestKind,
  requestId,
  documentId,
  fileName,
}) => {
  const response = await apiClient.get(
    buildDownloadPath({ scope, requestKind, requestId, documentId }),
    { responseType: 'blob' },
  );
  saveBlob(response.data, fileName || 'Вложение');
};

export const openRequestDocument = async (apiClient, params) => {
  const fileName = params.fileName || 'Вложение';

  if (!isPreviewableRequestDocument(fileName)) {
    await downloadRequestDocument(apiClient, params);
    return;
  }

  const response = await apiClient.get(
    buildDownloadPath(params),
    { responseType: 'blob' },
  );
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const previewWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!previewWindow) {
    window.URL.revokeObjectURL(blobUrl);
    await downloadRequestDocument(apiClient, params);
    return;
  }
  previewWindow.addEventListener('beforeunload', () => {
    window.URL.revokeObjectURL(blobUrl);
  }, { once: true });
};

export const requestDocumentsCount = (request) => {
  if (Array.isArray(request?.documents)) {
    return request.documents.length;
  }
  if (request?.documentUrl || request?.documentName) {
    return 1;
  }
  return 0;
};
