import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import Modal from '../../UI/Modal/Modal';
import Button from '../../UI/Button/Button';
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Импорт пользователей (CSV)" size="large">
      <div className="admin-users-import">
        {errorMessage && (
          <p className="admin-users-import__error" role="alert">
            {errorMessage}
          </p>
        )}

        {step === 'pick' && (
          <>
            <p className="admin-users-import__hint">
              Первая строка — заголовки (на сервере приводятся к <code>snake_case</code>). Разделитель — запятая или точка с запятой.
              В каждой строке достаточно <strong>фамилии, имени, email</strong> и <strong>роли</strong> (
              <code>student</code>, <code>teacher</code> или <code>admin</code>). Для студентов добавьте колонку{' '}
              <code>group</code> (название) или <code>group_id</code>. Логин и пароль создаются автоматически; если
              отмечена отправка письма, данные для входа уйдут на указанный email.
            </p>
            <div className="admin-users-import__file-row">
              <input
                className="admin-users-import__file-input"
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" size="small" variant="outline" onClick={handleDownloadExample}>
                Пример CSV
              </Button>
            </div>
            <div className="admin-users-import__actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                Отмена
              </Button>
              <Button type="button" variant="primary" loading={previewLoading} onClick={() => void runPreview()}>
                Проверить файл
              </Button>
            </div>
          </>
        )}

        {step === 'review' && preview && (
          <>
            <div className="admin-users-import__summary">
              <div className="admin-users-import__summary-item">
                <span>Всего строк</span>
                {summary?.totalRows ?? 0}
              </div>
              <div className="admin-users-import__summary-item">
                <span>Без ошибок</span>
                {validRowCount}
              </div>
              <div className="admin-users-import__summary-item">
                <span>С ошибками</span>
                {errorRowCount}
              </div>
            </div>

            <div className="admin-users-import__options">
              <div className="admin-users-import__radio-row" role="radiogroup" aria-label="Режим импорта">
                <label>
                  <input type="radio" name="import-mode" checked={mode === 'strict'} onChange={() => setMode('strict')} />
                  Строгий — только если все строки корректны
                </label>
                <label>
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === 'partial'}
                    onChange={() => setMode('partial')}
                  />
                  Частичный — импортировать только корректные строки
                </label>
              </div>
              <label className="admin-users-import__checkbox-row">
                <input type="checkbox" checked={sendCredentials} onChange={(e) => setSendCredentials(e.target.checked)} />
                <span>Отправить логин и пароль на email (для строк без своего пароля)</span>
              </label>
            </div>

            {mode === 'strict' && errorRowCount > 0 ? (
              <p className="admin-users-import__hint">
                В строгом режиме импорт недоступен, пока есть ошибки. Исправьте файл или включите частичный режим.
              </p>
            ) : null}

            <div className="admin-users-import__table-wrap">
              <table className="admin-users-import__table">
                <thead>
                  <tr>
                    <th className="admin-users-import__th">#</th>
                    <th className="admin-users-import__th">Статус</th>
                    <th className="admin-users-import__th">ФИО</th>
                    <th className="admin-users-import__th">Логин</th>
                    <th className="admin-users-import__th">Ошибки</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, idx) => (
                    <tr key={`${r.row}-${idx}`}>
                      <td className="admin-users-import__td">{r.row}</td>
                      <td className="admin-users-import__td">
                        <span
                          className={`admin-users-import__status admin-users-import__status--${
                            r.status === 'valid' ? 'ok' : 'err'
                          }`}
                        >
                          <span className="admin-users-import__status-dot" aria-hidden />
                          {r.status === 'valid' ? 'Ок' : 'Ошибка'}
                        </span>
                      </td>
                      <td className="admin-users-import__td">{rowFio(r.data)}</td>
                      <td className="admin-users-import__td">{r.data?.login || '—'}</td>
                      <td className="admin-users-import__td">
                        {Array.isArray(r.errors) && r.errors.length > 0 ? (
                          <ul className="admin-users-import__err-list">
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

            <div className="admin-users-import__actions">
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
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default AdminUsersImportModal;
