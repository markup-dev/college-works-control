import React, { useState } from 'react';
import Card from '../../UI/Card/Card';
import Button from '../../UI/Button/Button';
import ConfirmModal from '../../UI/Modal/ConfirmModal';
import { useNotification } from '../../../context/NotificationContext';
import './SettingsSection.scss';

const SettingsSection = () => {
  const { showSuccess, showError } = useNotification();
  const [settings, setSettings] = useState({
    systemName: 'Система контроля учебных работ',
    maxFileSize: 10,
    allowedFileTypes: ['.pdf', '.doc', '.docx', '.zip', '.rar'],
    sessionTimeout: 30,
    enableNotifications: true,
    enableEmailNotifications: true,
    enableSystemMaintenance: false,
    backupEnabled: true,
    backupFrequency: 'daily',
    maxStorageSize: 100
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const validateSettings = () => {
    const errors = {};
    
    if (settings.maxFileSize <= 0 || settings.maxFileSize > 1000) {
      errors.maxFileSize = 'Размер файла должен быть от 1 до 1000 МБ';
    }
    
    if (settings.sessionTimeout < 5 || settings.sessionTimeout > 480) {
      errors.sessionTimeout = 'Таймаут сессии должен быть от 5 до 480 минут';
    }
    
    if (settings.maxStorageSize <= 0 || settings.maxStorageSize > 10000) {
      errors.maxStorageSize = 'Максимальный размер хранилища должен быть от 1 до 10000 МБ';
    }
    
    if (!Array.isArray(settings.allowedFileTypes) || settings.allowedFileTypes.length === 0) {
      errors.allowedFileTypes = 'Укажите хотя бы один допустимый формат файла';
    } else {
      const invalidFormats = settings.allowedFileTypes.filter(format => !/^\.[a-zA-Z0-9]+$/.test(format));
      if (invalidFormats.length > 0) {
        errors.allowedFileTypes = 'Форматы файлов должны начинаться с точки и содержать только буквы и цифры (например, .pdf, .docx)';
      }
    }
    
    const trimmedSystemName = (settings.systemName || '').trim();
    if (!trimmedSystemName) {
      errors.systemName = 'Название системы обязательно';
    } else if (trimmedSystemName.length > 100) {
      errors.systemName = 'Название системы не должно превышать 100 символов';
    }
    
    return errors;
  };

  const handleSaveSettings = async () => {
    const errors = validateSettings();
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      showError(firstError);
      return;
    }
    
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const trimmedSettings = {
        ...settings,
        systemName: (settings.systemName || '').trim()
      };
      localStorage.setItem('admin_settings', JSON.stringify(trimmedSettings));
      showSuccess('Настройки успешно сохранены');
    } catch (error) {
      showError('Ошибка при сохранении настроек');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    setShowResetConfirm(true);
  };

  const confirmResetSettings = () => {
    setSettings({
      systemName: 'Система контроля учебных работ',
      maxFileSize: 10,
      allowedFileTypes: ['.pdf', '.doc', '.docx', '.zip', '.rar'],
      sessionTimeout: 30,
      enableNotifications: true,
      enableEmailNotifications: true,
      enableSystemMaintenance: false,
      backupEnabled: true,
      backupFrequency: 'daily',
      maxStorageSize: 100
    });
    showSuccess('Настройки сброшены');
    setShowResetConfirm(false);
  };

  const handleClearCache = () => {
    setShowClearCacheConfirm(true);
  };

  const confirmClearCache = () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
      showSuccess('Кэш успешно очищен');
    } catch (error) {
      showError('Ошибка при очистке кэша');
    }
    setShowClearCacheConfirm(false);
  };

  const handleExportData = () => {
    try {
      const data = {
        settings: settings,
        exportDate: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `system-settings-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showSuccess('Настройки успешно экспортированы');
    } catch (error) {
      showError('Ошибка при экспорте настроек');
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-header">
        <div className="header-content">
          <h2>⚙️ Настройки системы</h2>
          <p>Управление системными параметрами и конфигурацией</p>
        </div>
        <div className="header-actions">
          <Button variant="outline" onClick={handleExportData} icon="📥">
            Экспорт настроек
          </Button>
          <Button variant="outline" onClick={handleResetSettings} icon="🔄">
            Сбросить
          </Button>
          <Button variant="primary" onClick={handleSaveSettings} disabled={isSaving} icon="💾">
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      <div className="settings-grid">
        <Card className="settings-card" title="📋 Общие настройки">
          <div className="setting-item">
            <label className="setting-label">
              Название системы
            </label>
            <input
              type="text"
              value={settings.systemName}
              onChange={(e) => handleSettingChange('systemName', e.target.value)}
              className="setting-input"
              placeholder="Название системы"
            />
          </div>

          <div className="setting-item">
            <label className="setting-label">
              Максимальный размер файла (МБ)
            </label>
            <input
              type="number"
              value={settings.maxFileSize}
              onChange={(e) => handleSettingChange('maxFileSize', parseInt(e.target.value) || 10)}
              className="setting-input"
              min="1"
              max="100"
            />
          </div>

          <div className="setting-item">
            <label className="setting-label">
              Разрешенные типы файлов
            </label>
            <input
              type="text"
              value={settings.allowedFileTypes.join(', ')}
              onChange={(e) => handleSettingChange('allowedFileTypes', e.target.value.split(',').map(t => t.trim()))}
              className="setting-input"
              placeholder=".pdf, .doc, .docx"
            />
          </div>

          <div className="setting-item">
            <label className="setting-label">
              Таймаут сессии (минут)
            </label>
            <input
              type="number"
              value={settings.sessionTimeout}
              onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value) || 30)}
              className="setting-input"
              min="5"
              max="120"
            />
          </div>
        </Card>

        <Card className="settings-card" title="🔔 Уведомления">
          <div className="setting-item">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.enableNotifications}
                onChange={(e) => handleSettingChange('enableNotifications', e.target.checked)}
              />
              <span>Включить уведомления</span>
            </label>
          </div>

          <div className="setting-item">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.enableEmailNotifications}
                onChange={(e) => handleSettingChange('enableEmailNotifications', e.target.checked)}
                disabled={!settings.enableNotifications}
              />
              <span>Email уведомления</span>
            </label>
          </div>
        </Card>

        <Card className="settings-card" title="💾 Резервное копирование">
          <div className="setting-item">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.backupEnabled}
                onChange={(e) => handleSettingChange('backupEnabled', e.target.checked)}
              />
              <span>Включить автоматическое резервное копирование</span>
            </label>
          </div>

          {settings.backupEnabled && (
            <div className="setting-item">
              <label className="setting-label">
                Частота резервного копирования
              </label>
              <select
                value={settings.backupFrequency}
                onChange={(e) => handleSettingChange('backupFrequency', e.target.value)}
                className="setting-select"
              >
                <option value="hourly">Каждый час</option>
                <option value="daily">Ежедневно</option>
                <option value="weekly">Еженедельно</option>
                <option value="monthly">Ежемесячно</option>
              </select>
            </div>
          )}

          <div className="setting-item">
            <label className="setting-label">
              Максимальный размер хранилища (ГБ)
            </label>
            <input
              type="number"
              value={settings.maxStorageSize}
              onChange={(e) => handleSettingChange('maxStorageSize', parseInt(e.target.value) || 100)}
              className="setting-input"
              min="10"
              max="1000"
            />
          </div>
        </Card>

        <Card className="settings-card" title="🔧 Системное обслуживание">
          <div className="setting-item">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={settings.enableSystemMaintenance}
                onChange={(e) => handleSettingChange('enableSystemMaintenance', e.target.checked)}
              />
              <span>Режим технического обслуживания</span>
            </label>
            {settings.enableSystemMaintenance && (
              <p className="setting-hint">
                В режиме обслуживания доступ к системе будет ограничен
              </p>
            )}
          </div>

          <div className="setting-item">
            <Button variant="outline" onClick={handleClearCache} icon="🧹">
              Очистить кэш системы
            </Button>
            <p className="setting-hint">
              Очистка кэша может улучшить производительность системы
            </p>
          </div>
        </Card>

        <Card className="settings-card" title="📊 Информация о системе">
          <div className="system-info">
            <div className="info-item">
              <span className="info-label">Версия системы:</span>
              <span className="info-value">1.0.0</span>
            </div>
            <div className="info-item">
              <span className="info-label">Дата обновления:</span>
              <span className="info-value">{new Date().toLocaleDateString('ru-RU')}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Использование хранилища:</span>
              <span className="info-value">
                {(() => {
                  let totalSize = 0;
                  for (let key in localStorage) {
                    if (localStorage.hasOwnProperty(key)) {
                      totalSize += localStorage[key].length + key.length;
                    }
                  }
                  return (totalSize / 1024 / 1024).toFixed(2) + ' МБ';
                })()}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={confirmResetSettings}
        title="Сбросить настройки?"
        message="Вы уверены, что хотите сбросить все настройки к значениям по умолчанию? Это действие нельзя отменить."
        confirmText="Сбросить"
        cancelText="Отмена"
        danger
      />

      <ConfirmModal
        isOpen={showClearCacheConfirm}
        onClose={() => setShowClearCacheConfirm(false)}
        onConfirm={confirmClearCache}
        title="Очистить кэш?"
        message="Вы уверены, что хотите очистить кэш системы? Это может временно замедлить работу системы."
        confirmText="Очистить"
        cancelText="Отмена"
      />
    </div>
  );
};

export default SettingsSection;

