import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { firstApiErrorMessage } from '../../../utils/adminApiErrors';
import Button from '../../UI/Button/Button';
import ErrorBanner from '../../UI/ErrorBanner/ErrorBanner';
import InfoCard from '../../UI/InfoCard/InfoCard';
import LoadingState from '../../UI/LoadingState/LoadingState';
import Modal from '../../UI/Modal/Modal';
import ModalSection from '../../UI/Modal/ModalSection';
import './AdminSettingsManagement.scss';

const defaultForm = () => ({
  globalBanner: {
    enabled: false,
    text: '',
    color: 'yellow',
    startsAt: '',
    endsAt: '',
    indefinite: true,
  },
  passwordPolicy: {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSpecial: false,
    excludeSimilar: true,
    expiryDays: '',
  },
  emailTemplate: {
    fromName: 'College Works Control',
    subject: 'Доступ к платформе College Works Control',
    body:
      'Здравствуйте, {{fullName}}!\n\nВы зарегистрированы в системе College Works Control.\n\nДанные для входа:\nЛогин: {{login}}\nПароль: {{password}}\nСсылка для входа: {{loginUrl}}\n\nПри первом входе нужно сменить пароль.\n\nС уважением, администрация.',
  },
  security: {
    sessionLifetimeHours: 24,
    maxLoginAttempts: 5,
    lockoutMinutes: 30,
    notifyAdminOnLockout: true,
  },
});

const toDatetimeLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromDatetimeLocal = (value) => {
  if (!value || !String(value).trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const AdminSettingsManagement = () => {
  const { showSuccess, showError } = useNotification();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/settings');
      const raw = data?.data ?? data;
      if (raw && typeof raw === 'object') {
        setForm({
          globalBanner: {
            enabled: !!raw.globalBanner?.enabled,
            text: raw.globalBanner?.text ?? '',
            color: raw.globalBanner?.color ?? 'yellow',
            startsAt: toDatetimeLocal(raw.globalBanner?.startsAt),
            endsAt: toDatetimeLocal(raw.globalBanner?.endsAt),
            indefinite: raw.globalBanner?.indefinite !== false,
          },
          passwordPolicy: {
            minLength: raw.passwordPolicy?.minLength ?? 12,
            requireLowercase: raw.passwordPolicy?.requireLowercase !== false,
            requireUppercase: raw.passwordPolicy?.requireUppercase !== false,
            requireDigits: raw.passwordPolicy?.requireDigits !== false,
            requireSpecial: !!raw.passwordPolicy?.requireSpecial,
            excludeSimilar: raw.passwordPolicy?.excludeSimilar !== false,
            expiryDays:
              raw.passwordPolicy?.expiryDays != null ? String(raw.passwordPolicy.expiryDays) : '',
          },
          emailTemplate: {
            fromName: raw.emailTemplate?.fromName ?? defaultForm().emailTemplate.fromName,
            subject: raw.emailTemplate?.subject ?? defaultForm().emailTemplate.subject,
            body: raw.emailTemplate?.body ?? defaultForm().emailTemplate.body,
          },
          security: {
            sessionLifetimeHours: raw.security?.sessionLifetimeHours ?? 24,
            maxLoginAttempts: raw.security?.maxLoginAttempts ?? 5,
            lockoutMinutes: raw.security?.lockoutMinutes ?? 30,
            notifyAdminOnLockout: raw.security?.notifyAdminOnLockout !== false,
          },
        });
      }
    } catch (e) {
      setError(firstApiErrorMessage(e.response?.data) || 'Не удалось загрузить настройки');
      setForm(defaultForm());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewBody = useMemo(() => {
    const repl = {
      '{{fullName}}': 'Иванов Иван Иванович',
      '{{login}}': 'i.ivanov',
      '{{password}}': 'Aa1XxYyZz99',
      '{{loginUrl}}': `${window.location.origin}/login`,
      '{{role}}': 'Студент',
      '{{group}}': 'ИС-31',
    };
    let t = form.emailTemplate.body;
    Object.entries(repl).forEach(([k, v]) => {
      t = t.split(k).join(v);
    });
    return t;
  }, [form.emailTemplate.body]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        globalBanner: {
          enabled: form.globalBanner.enabled,
          text: form.globalBanner.text,
          color: form.globalBanner.color,
          indefinite: form.globalBanner.indefinite,
          startsAt: form.globalBanner.indefinite ? null : fromDatetimeLocal(form.globalBanner.startsAt),
          endsAt: form.globalBanner.indefinite ? null : fromDatetimeLocal(form.globalBanner.endsAt),
        },
        passwordPolicy: {
          minLength: Number(form.passwordPolicy.minLength) || 12,
          requireLowercase: form.passwordPolicy.requireLowercase,
          requireUppercase: form.passwordPolicy.requireUppercase,
          requireDigits: form.passwordPolicy.requireDigits,
          requireSpecial: form.passwordPolicy.requireSpecial,
          excludeSimilar: form.passwordPolicy.excludeSimilar,
          expiryDays:
            form.passwordPolicy.expiryDays === '' || form.passwordPolicy.expiryDays == null
              ? null
              : Number(form.passwordPolicy.expiryDays),
        },
        emailTemplate: { ...form.emailTemplate },
        security: {
          sessionLifetimeHours: Number(form.security.sessionLifetimeHours),
          maxLoginAttempts: Number(form.security.maxLoginAttempts),
          lockoutMinutes: Number(form.security.lockoutMinutes),
          notifyAdminOnLockout: form.security.notifyAdminOnLockout,
        },
      };
      const { data } = await api.put('/admin/settings', payload);
      if (data?.data) {
        showSuccess('Настройки сохранены');
        window.dispatchEvent(new CustomEvent('app:platform-banner-refresh'));
        await load();
      }
    } catch (e) {
      showError(firstApiErrorMessage(e.response?.data) || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Загрузка настроек..." className="admin-settings-management__state" />;
  }

  return (
    <form className="admin-settings-management" onSubmit={(ev) => void handleSave(ev)}>
      <div>
        <h1 className="admin-settings-management__title">Настройки системы</h1>
        <p className="admin-settings-management__hint">
          Параметры применяются к письмам с доступом для новых пользователей, проверке смены пароля и
          глобальному баннеру над шапкой сайта. Часть параметров безопасности хранится для учёта и
          дальнейшего подключения (ограничения входа, длительность сессии).
        </p>
      </div>

      {error && (
        <ErrorBanner
          className="admin-settings-management__error"
          title="Ошибка загрузки настроек"
          message={error}
          actionLabel="Повторить"
          onAction={() => void load()}
        />
      )}

      <InfoCard className="admin-settings-management__section">
        <h2 className="admin-settings-management__section-title">Глобальное уведомление</h2>
        <label className="admin-settings-management__checkbox">
          <input
            type="checkbox"
            checked={form.globalBanner.enabled}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                globalBanner: { ...f.globalBanner, enabled: e.target.checked },
              }))
            }
          />
          Показывать баннер на всех страницах (для всех авторизованных пользователей)
        </label>
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-banner-text">
            Текст уведомления
          </label>
          <textarea
            id="set-banner-text"
            className="admin-settings-management__textarea"
            value={form.globalBanner.text}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                globalBanner: { ...f.globalBanner, text: e.target.value },
              }))
            }
          />
        </div>
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-banner-color">
            Цвет фона
          </label>
          <select
            id="set-banner-color"
            className="admin-settings-management__select"
            value={form.globalBanner.color}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                globalBanner: { ...f.globalBanner, color: e.target.value },
              }))
            }
          >
            <option value="yellow">Жёлтый (предупреждение)</option>
            <option value="red">Красный (срочное)</option>
            <option value="blue">Синий (информация)</option>
            <option value="green">Зелёный</option>
          </select>
        </div>
        <label className="admin-settings-management__checkbox">
          <input
            type="checkbox"
            checked={form.globalBanner.indefinite}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                globalBanner: { ...f.globalBanner, indefinite: e.target.checked },
              }))
            }
          />
          Бессрочно (без ограничения дат)
        </label>
        {!form.globalBanner.indefinite && (
          <div className="admin-settings-management__grid-2">
            <div className="admin-settings-management__field">
              <label className="admin-settings-management__label" htmlFor="set-banner-start">
                Начало показа
              </label>
              <input
                id="set-banner-start"
                type="datetime-local"
                className="admin-settings-management__input"
                value={form.globalBanner.startsAt}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    globalBanner: { ...f.globalBanner, startsAt: e.target.value },
                  }))
                }
              />
            </div>
            <div className="admin-settings-management__field">
              <label className="admin-settings-management__label" htmlFor="set-banner-end">
                Окончание
              </label>
              <input
                id="set-banner-end"
                type="datetime-local"
                className="admin-settings-management__input"
                value={form.globalBanner.endsAt}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    globalBanner: { ...f.globalBanner, endsAt: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        )}
      </InfoCard>

      <InfoCard className="admin-settings-management__section">
        <h2 className="admin-settings-management__section-title">Требования к паролю</h2>
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-pw-len">
            Минимальная длина
          </label>
          <input
            id="set-pw-len"
            type="number"
            min={8}
            max={128}
            className="admin-settings-management__input"
            style={{ maxWidth: '8rem' }}
            value={form.passwordPolicy.minLength}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                passwordPolicy: { ...f.passwordPolicy, minLength: e.target.value },
              }))
            }
          />
        </div>
        {[
          ['requireLowercase', 'Строчные буквы (a-z)'],
          ['requireUppercase', 'Заглавные буквы (A-Z)'],
          ['requireDigits', 'Цифры (0-9)'],
          ['requireSpecial', 'Специальные символы'],
          ['excludeSimilar', 'Исключить похожие символы (0, O, 1, l, I, 5, S)'],
        ].map(([key, label]) => (
          <label key={key} className="admin-settings-management__checkbox">
            <input
              type="checkbox"
              checked={!!form.passwordPolicy[key]}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  passwordPolicy: { ...f.passwordPolicy, [key]: e.target.checked },
                }))
              }
            />
            {label}
          </label>
        ))}
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-pw-expiry">
            Срок действия пароля
          </label>
          <select
            id="set-pw-expiry"
            className="admin-settings-management__select"
            value={form.passwordPolicy.expiryDays}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                passwordPolicy: { ...f.passwordPolicy, expiryDays: e.target.value },
              }))
            }
          >
            <option value="">Никогда (не отслеживается в этой версии)</option>
            <option value="30">30 дней</option>
            <option value="60">60 дней</option>
            <option value="90">90 дней</option>
          </select>
        </div>
      </InfoCard>

      <InfoCard className="admin-settings-management__section">
        <h2 className="admin-settings-management__section-title">Шаблон письма для новых пользователей</h2>
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-mail-from">
            Имя отправителя
          </label>
          <input
            id="set-mail-from"
            className="admin-settings-management__input"
            value={form.emailTemplate.fromName}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                emailTemplate: { ...f.emailTemplate, fromName: e.target.value },
              }))
            }
          />
        </div>
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-mail-subj">
            Тема письма
          </label>
          <input
            id="set-mail-subj"
            className="admin-settings-management__input"
            value={form.emailTemplate.subject}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                emailTemplate: { ...f.emailTemplate, subject: e.target.value },
              }))
            }
          />
        </div>
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-mail-body">
            Текст письма
          </label>
          <textarea
            id="set-mail-body"
            className="admin-settings-management__textarea"
            value={form.emailTemplate.body}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                emailTemplate: { ...f.emailTemplate, body: e.target.value },
              }))
            }
          />
        </div>
        <p className="admin-settings-management__muted">
          Переменные: {'{{fullName}}'} {'{{login}}'} {'{{password}}'} {'{{loginUrl}}'} {'{{role}}'}{' '}
          {'{{group}}'}
        </p>
        <Button type="button" variant="outline" size="small" onClick={() => setPreviewOpen(true)}>
          Предпросмотр текста
        </Button>
      </InfoCard>

      <InfoCard className="admin-settings-management__section">
        <h2 className="admin-settings-management__section-title">Безопасность</h2>
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-session">
            Время жизни сессии (часы)
          </label>
          <select
            id="set-session"
            className="admin-settings-management__select"
            value={String(form.security.sessionLifetimeHours)}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                security: { ...f.security, sessionLifetimeHours: Number(e.target.value) },
              }))
            }
          >
            <option value="1">1 час</option>
            <option value="8">8 часов</option>
            <option value="24">24 часа</option>
            <option value="168">7 дней</option>
            <option value="720">30 дней</option>
          </select>
        </div>
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-attempts">
            Максимум попыток входа
          </label>
          <input
            id="set-attempts"
            type="number"
            min={1}
            max={20}
            className="admin-settings-management__input"
            style={{ maxWidth: '8rem' }}
            value={form.security.maxLoginAttempts}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                security: { ...f.security, maxLoginAttempts: e.target.value },
              }))
            }
          />
        </div>
        <div className="admin-settings-management__field">
          <label className="admin-settings-management__label" htmlFor="set-lockout">
            Блокировка после неудачных попыток
          </label>
          <select
            id="set-lockout"
            className="admin-settings-management__select"
            value={String(form.security.lockoutMinutes)}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                security: { ...f.security, lockoutMinutes: Number(e.target.value) },
              }))
            }
          >
            <option value="15">15 минут</option>
            <option value="30">30 минут</option>
            <option value="60">1 час</option>
            <option value="1440">24 часа</option>
          </select>
        </div>
        <label className="admin-settings-management__checkbox">
          <input
            type="checkbox"
            checked={form.security.notifyAdminOnLockout}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                security: { ...f.security, notifyAdminOnLockout: e.target.checked },
              }))
            }
          />
          Уведомлять администратора о блокировках входа
        </label>
      </InfoCard>

      <div className="admin-settings-management__actions">
        <Button type="submit" loading={saving}>
          Сохранить все настройки
        </Button>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={saving}>
          Сбросить с сервера
        </Button>
      </div>

      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Предпросмотр письма"
        size="large"
        contentClassName="admin-settings-management__preview-modal"
      >
        <ModalSection title="Тема" variant="soft">
          <p className="admin-settings-management__muted">{form.emailTemplate.subject}</p>
        </ModalSection>
        <ModalSection title="Текст письма">
          <pre className="admin-settings-management__preview-sample">{previewBody}</pre>
        </ModalSection>
      </Modal>
    </form>
  );
};

export default AdminSettingsManagement;
