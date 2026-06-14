const parseBlobErrorMessage = async (blob) => {
  if (!(blob instanceof Blob) || blob.type !== 'application/json') {
    return null;
  }

  try {
    const payload = JSON.parse(await blob.text());
    return payload?.message || null;
  } catch {
    return null;
  }
};

const saveBlobWithAnchor = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

const suggestSavePickerTypes = (fileName) => {
  const extension = String(fileName || '').split('.').pop()?.toLowerCase();
  if (!extension) {
    return undefined;
  }

  const mimeByExtension = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    txt: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };

  const mime = mimeByExtension[extension];
  if (!mime) {
    return undefined;
  }

  return [{ description: extension.toUpperCase(), accept: { [mime]: [`.${extension}`] } }];
};

/**
 * Материал задания: системное окно «Сохранить как» (если поддерживается браузером),
 * иначе — сохранение через ссылку, как раньше.
 */
export const downloadAssignmentMaterial = async (apiClient, assignmentId, material) => {
  if (!assignmentId || !material?.id) {
    throw new Error('Материал не найден');
  }

  const fileName = material.fileName || 'material';
  let saveHandle = null;

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      saveHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: suggestSavePickerTypes(fileName),
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new DownloadCancelledError();
      }
    }
  }

  const response = await apiClient.get(
    `/assignments/${assignmentId}/materials/${material.id}/download`,
    { responseType: 'blob' },
  );

  const blob = response.data;
  const apiError = await parseBlobErrorMessage(blob);
  if (apiError) {
    throw new Error(apiError);
  }

  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('Не удалось получить файл');
  }

  if (saveHandle) {
    const writable = await saveHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return fileName;
  }

  saveBlobWithAnchor(blob, fileName);
  return fileName;
};

export class DownloadCancelledError extends Error {
  constructor() {
    super('Сохранение отменено');
    this.name = 'DownloadCancelledError';
  }
}
