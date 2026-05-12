import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import Button from '../../UI/Button/Button';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import StatusBadge from '../../UI/StatusBadge/StatusBadge';
import './AdminUsersImportModal.scss';

const MAX_BYTES = 5 * 1024 * 1024;

const CSV_TEMPLATE_HEADER = 'email,last_name,first_name,role,group';

const buildImportRowsPayload = (preview) =>
  (preview?.rows || []).map((item) => ({
    row: item.row,
    data: item.data && typeof item.data === 'object' ? item.data : {},
  }));

const rowFio = (data) => {
  if (!data || typeof data !== 'object') return '—';
  const last = data.lastName ?? data.last_name;
  const first = data.firstName ?? data.first_name;
  const a = [last, first].filter(Boolean).join(' ').trim();
  return a || '—';
};

const AdminUsersImportModal = ({ isOpen, onClose, onImported }) => {
  const [step, setStep] = useState('pick');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [mode, setMode] = useState('strict');
  const [sendCredentials, setSendCredentials] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setStep('pick');
    setFile(null);
    setPreview(null);
    setPreviewLoading(false);
    setImportLoading(false);
    setErrorMessage(null);
    setMode('strict');
    setSendCredentials(true);
  }, [isOpen]);

  const summary = preview?.summary;
  const errorRowCount = summary?.errorRows ?? 0;
  const validRowCount = summary?.validRows ?? 0;

  const canImport = validRowCount > 0 && (mode === 'partial' || errorRowCount === 0);

  const handleDownloadExample = useCallback(() => {
    const body = `${CSV_TEMPLATE_HEADER}\nivanov@example.ru,Иванов,Иван,student,ИСП-0001\n`;
    const blob = new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_import_example.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

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
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/admin/users/import/preview', fd);
      setPreview(data);
      setStep('review');
    } catch (err) {
      setErrorMessage(firstApiErrorMessage(err.response?.data) || 'Не удалось разобрать файл');
    } finally {
      setPreviewLoading(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    if (!canImport) return;
    setImportLoading(true);
    setErrorMessage(null);
    try {
      const { data } = await api.post('/admin/users/import', {
        rows: buildImportRowsPayload(preview),
        mode,
        sendCredentials,
      });
      const created = data?.summary?.created ?? 0;
      onImported?.(data, created);
      onClose();
    } catch (err) {
      setErrorMessage(firstApiErrorMessage(err.response?.data) || 'Импорт не выполнен');
    } finally {
      setImportLoading(false);
    }
  };

  const tableRows = useMemo(() => preview?.rows ?? [], [preview]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Импорт пользователей"
      subtitle="Загрузка из CSV-файла"
      size="large"
      className="admin-users-import-modal"
      contentClassName="admin-users-import-modal__body"
      footer={(
        <div className="admin-users-import-modal__actions">
          {step === 'pick' && (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Отмена
              </Button>
              <Button type="button" variant="primary" loading={previewLoading} onClick={() => void runPreview()}>
                Проверить файл
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button type="button" variant="secondary" onClick={() => setStep('pick')} disabled={importLoading}>
                Другой файл
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} disabled={importLoading}>
                Отмена
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
              <div className="admin-users-import-modal__error" role="alert">
                <span className="admin-users-import-modal__error-icon">!</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {step === 'pick' && (
              <>
                <ModalSection title="Формат файла" variant="soft">
                  <div className="info-card__content">
                    <p>
                      Первая строка — заголовки. Разделитель — запятая или точка с запятой.
                    </p>
                    <p>
                      В каждой строке достаточно <strong>фамилии, имени, email</strong> и <strong>роли</strong> (
                      <code>student</code>, <code>teacher</code> или <code>admin</code>).
                    </p>
                    <p>
                      Для студентов добавьте колонку <code>group</code> (название) или <code>group_id</code>.
                    </p>
                    <p>
                      Логин и пароль создаются автоматически; если отмечена отправка письма, данные для входа уйдут на указанный email.
                    </p>
                  </div>
                </ModalSection>

                <ModalSection title="Файл для проверки">
                <div className="file-upload">
                  <label className="file-upload__label">
                    <input
                      type="file"
                      accept=".csv,.txt,text/csv,text/plain"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    <span className="file-upload__text">
                      {file ? file.name : 'Выберите CSV-файл'}
                    </span>
                  </label>
                  <Button type="button" size="small" variant="outline" onClick={handleDownloadExample}>
                    Скачать пример
                  </Button>
                </div>
                </ModalSection>
              </>
            )}

            {step === 'review' && preview && (
              <>
                <ModalSection title="Результат проверки" variant="soft">
                <div className="stats-cards">
                  <div className="stat-card">
                    <div className="stat-card__value">{summary?.totalRows ?? 0}</div>
                    <div className="stat-card__label">Всего строк</div>
                  </div>
                  <div className="stat-card stat-card--success">
                    <div className="stat-card__value">{validRowCount}</div>
                    <div className="stat-card__label">Без ошибок</div>
                  </div>
                  <div className="stat-card stat-card--danger">
                    <div className="stat-card__value">{errorRowCount}</div>
                    <div className="stat-card__label">С ошибками</div>
                  </div>
                </div>
                </ModalSection>

                <ModalSection title="Настройки импорта">
                  <div className="options-group">
                  <div className="radio-group" role="radiogroup" aria-label="Режим импорта">
                    <label className="radio-label">
                      <input type="radio" name="import-mode" checked={mode === 'strict'} onChange={() => setMode('strict')} />
                      <span className="radio-label__text">
                        <strong>Строгий</strong>
                        <span className="radio-label__hint">— только если все строки корректны</span>
                      </span>
                    </label>
                    <label className="radio-label">
                      <input type="radio" name="import-mode" checked={mode === 'partial'} onChange={() => setMode('partial')} />
                      <span className="radio-label__text">
                        <strong>Частичный</strong>
                        <span className="radio-label__hint">— импортировать только корректные строки</span>
                      </span>
                    </label>
                  </div>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={sendCredentials} onChange={(e) => setSendCredentials(e.target.checked)} />
                    <span className="checkbox-label__text">
                      Отправить логин и пароль на email
                      <span className="checkbox-label__hint">(для строк без своего пароля)</span>
                    </span>
                  </label>
                </div>
                </ModalSection>

                {mode === 'strict' && errorRowCount > 0 && (
                  <div className="warning-message">
                    <span>В строгом режиме импорт недоступен, пока есть ошибки. Исправьте файл или включите частичный режим.</span>
                  </div>
                )}

                <ModalSection title="Строки файла">
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="data-table__th data-table__th--number">#</th>
                        <th className="data-table__th">Статус</th>
                        <th className="data-table__th">ФИО</th>
                        <th className="data-table__th">Логин</th>
                        <th className="data-table__th">Ошибки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((r, idx) => (
                        <tr key={`${r.row}-${idx}`} className={r.status === 'valid' ? 'data-table__row--valid' : 'data-table__row--invalid'}>
                          <td className="data-table__td data-table__td--number">{r.row}</td>
                          <td className="data-table__td">
                            <StatusBadge tone={r.status === 'valid' ? 'success' : 'danger'}>
                              {r.status === 'valid' ? 'Ок' : 'Ошибка'}
                            </StatusBadge>
                          </td>
                          <td className="data-table__td">{rowFio(r.data)}</td>
                          <td className="data-table__td">{r.data?.login || '—'}</td>
                          <td className="data-table__td">
                            {Array.isArray(r.errors) && r.errors.length > 0 ? (
                              <ul className="error-list">
                                {r.errors.map((t, i) => (
                                  <li key={i}>{t}</li>
                                ))}
                              </ul>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </ModalSection>
              </>
            )}
    </Modal>
  );
};

export default AdminUsersImportModal;