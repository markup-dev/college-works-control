import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { getApiErrorMessage } from '../../../utils/adminApiErrors';
import Button from '../../UI/Button/Button';
import FileDropzone from '../../UI/FileDropzone/FileDropzone';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import './AdminCsvImportModal.scss';

const MAX_BYTES = 5 * 1024 * 1024;

const buildImportRowsPayload = (preview) =>
  (preview?.rows || []).map((item) => ({
    row: item.row,
    data: item.data && typeof item.data === 'object' ? item.data : {},
  }));

const normalizeSummaryValue = (summary, camelKey, snakeKey) => summary?.[camelKey] ?? summary?.[snakeKey] ?? 0;

const AdminCsvImportModal = ({ isOpen, onClose, config, onImported }) => {
  const [step, setStep] = useState('pick');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [mode, setMode] = useState('strict');
  const [sendCredentials, setSendCredentials] = useState(Boolean(config?.importOptions?.sendCredentials));

  useEffect(() => {
    if (!isOpen) return;
    setStep('pick');
    setFile(null);
    setPreview(null);
    setPreviewLoading(false);
    setImportLoading(false);
    setErrorMessage(null);
    setMode('strict');
    setSendCredentials(Boolean(config?.importOptions?.sendCredentials));
  }, [isOpen, config]);

  const summary = preview?.summary;
  const errorRowCount = normalizeSummaryValue(summary, 'errorRows', 'error_rows');
  const validRowCount = normalizeSummaryValue(summary, 'validRows', 'valid_rows');
  const totalRowCount = normalizeSummaryValue(summary, 'totalRows', 'total_rows');
  const canImport = validRowCount > 0 && (mode === 'partial' || errorRowCount === 0);
  const tableRows = useMemo(() => preview?.rows ?? [], [preview]);

  const handleDownloadExample = useCallback(() => {
    const body = `${config.sampleHeader}\n${config.sampleRow}\n`;
    const blob = new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = config.sampleFileName;
    link.click();
    URL.revokeObjectURL(url);
  }, [config]);

  const runPreview = async () => {
    if (!file) {
      setErrorMessage('Выберите CSV-файл.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrorMessage('Размер файла не должен превышать 5 МБ.');
      return;
    }
    setPreviewLoading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(config.previewUrl, formData);
      setPreview(data);
      setStep('review');
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Не удалось разобрать файл'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const runImport = async () => {
    if (!preview || !canImport) return;
    setImportLoading(true);
    setErrorMessage(null);
    try {
      const payload = {
        rows: buildImportRowsPayload(preview),
        mode,
      };
      if (config.importOptions?.sendCredentials) {
        payload.send_credentials = sendCredentials;
      }
      const { data } = await api.post(config.importUrl, payload);
      onImported?.(data);
      onClose();
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Импорт не выполнен'));
    } finally {
      setImportLoading(false);
    }
  };

  if (!isOpen || !config) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config.title}
      subtitle={config.subtitle}
      size="large"
      className="admin-csv-import-modal"
      contentClassName="admin-csv-import-modal__body"
      footer={(
        <div className="admin-csv-import-modal__actions">
          {step === 'pick' && (
            <Button type="button" variant="primary" loading={previewLoading} onClick={() => void runPreview()}>
              Проверить файл
            </Button>
          )}
          {step === 'review' && (
            <>
              <Button type="button" variant="secondary" onClick={() => setStep('pick')} disabled={importLoading}>
                Другой файл
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={importLoading}
                disabled={!canImport || importLoading}
                onClick={() => void runImport()}
              >
                Импортировать
              </Button>
            </>
          )}
        </div>
      )}
    >
      {errorMessage && (
        <div className="admin-csv-import-modal__error" role="alert">
          <span className="admin-csv-import-modal__error-icon">!</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {step === 'pick' && (
        <>
          <ModalSection title="Формат файла" variant="soft">
            <div className="admin-csv-import-modal__instructions">
              {config.instructions.map((item, index) => (
                <p key={index}>{item}</p>
              ))}
            </div>
          </ModalSection>

          <ModalSection title="Файл для проверки">
            <FileDropzone
              accept=".csv,.txt,text/csv,text/plain"
              selectedFiles={file ? [file] : []}
              onFilesSelected={(files) => setFile(files[0] ?? null)}
              buttonText="Выбрать CSV"
              hint="До 5 МБ · разделитель: запятая или точка с запятой"
              className="admin-file-dropzone admin-csv-import-modal__dropzone"
            />
            <Button type="button" size="small" variant="outline" onClick={handleDownloadExample}>
              Скачать пример
            </Button>
          </ModalSection>
        </>
      )}

      {step === 'review' && preview && (
        <>
          <ModalSection title="Результат проверки" variant="soft">
            <div className="admin-csv-import-modal__stats">
              <div className="admin-csv-import-modal__stat-card">
                <div className="admin-csv-import-modal__stat-value">{totalRowCount}</div>
                <div className="admin-csv-import-modal__stat-label">Всего строк</div>
              </div>
              <div className="admin-csv-import-modal__stat-card admin-csv-import-modal__stat-card--success">
                <div className="admin-csv-import-modal__stat-value">{validRowCount}</div>
                <div className="admin-csv-import-modal__stat-label">Без ошибок</div>
              </div>
              <div className="admin-csv-import-modal__stat-card admin-csv-import-modal__stat-card--danger">
                <div className="admin-csv-import-modal__stat-value">{errorRowCount}</div>
                <div className="admin-csv-import-modal__stat-label">С ошибками</div>
              </div>
            </div>
          </ModalSection>

          <ModalSection title="Настройки импорта">
            <div className="admin-csv-import-modal__options">
              <div className="admin-csv-import-modal__radio-group" role="radiogroup" aria-label="Режим импорта">
                <label className="admin-csv-import-modal__radio-label">
                  <input type="radio" name="import-mode" checked={mode === 'strict'} onChange={() => setMode('strict')} />
                  <span className="admin-csv-import-modal__option-text">
                    <strong>Строгий</strong>
                    <span>Только если все строки корректны</span>
                  </span>
                </label>
                <label className="admin-csv-import-modal__radio-label">
                  <input type="radio" name="import-mode" checked={mode === 'partial'} onChange={() => setMode('partial')} />
                  <span className="admin-csv-import-modal__option-text">
                    <strong>Частичный</strong>
                    <span>Импортировать только корректные строки</span>
                  </span>
                </label>
              </div>
              {config.importOptions?.sendCredentials && (
                <label className="admin-csv-import-modal__checkbox-label">
                  <input type="checkbox" checked={sendCredentials} onChange={(event) => setSendCredentials(event.target.checked)} />
                  <span className="admin-csv-import-modal__option-text">
                    <strong>Отправить логин и пароль на email</strong>
                    <span>Для строк без своего пароля</span>
                  </span>
                </label>
              )}
            </div>
          </ModalSection>

          {mode === 'strict' && errorRowCount > 0 && (
            <div className="admin-csv-import-modal__warning">
              <span>В строгом режиме импорт недоступен, пока есть ошибки. Исправьте файл или включите частичный режим.</span>
            </div>
          )}

          <ModalSection title={`Строки файла (${tableRows.length})`}>
            {tableRows.length === 0 ? (
              <p className="admin-csv-import-modal__rows-empty">{config.emptyText}</p>
            ) : (
              <ul className="admin-csv-import-modal__rows">
                {tableRows.map((row, index) => {
                  const isValid = row.status === 'valid';
                  const errors = Array.isArray(row.errors) ? row.errors : [];
                  return (
                    <li
                      key={`${row.row}-${index}`}
                      className={`admin-csv-import-modal__row-card${isValid ? '' : ' admin-csv-import-modal__row-card--invalid'}`}
                    >
                      <div className="admin-csv-import-modal__row-card-head">
                        <span className="admin-csv-import-modal__row-card-num">Строка {row.row}</span>
                        <StatusBadge tone={isValid ? 'success' : 'danger'}>
                          {isValid ? 'Ок' : 'Ошибка'}
                        </StatusBadge>
                      </div>
                      <dl className="admin-csv-import-modal__row-card-fields">
                        {config.rowFields.map((field) => {
                          const value = field.getValue(row.data);
                          return (
                            <div
                              key={field.key}
                              className={`admin-csv-import-modal__row-field${field.primary ? ' admin-csv-import-modal__row-field--primary' : ''}`}
                            >
                              <dt>{field.label}</dt>
                              <dd className={field.clip ? 'admin-csv-import-modal__row-field-value--clip' : ''} title={field.clip ? String(value) : undefined}>
                                {value}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                      {errors.length > 0 && (
                        <div className="admin-csv-import-modal__row-card-errors" role="alert">
                          <span className="admin-csv-import-modal__row-card-errors-label">Ошибки</span>
                          <ul>
                            {errors.map((text, errorIndex) => (
                              <li key={errorIndex}>{text}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </ModalSection>
        </>
      )}
    </Modal>
  );
};

export default AdminCsvImportModal;
