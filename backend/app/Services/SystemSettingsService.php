<?php

namespace App\Services;

use App\Models\SystemSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Arr;

/**
 * Глобальные настройки в одной строке БД: значения по умолчанию, слияние с сохранёнными, баннер для публичного API, шаблон письма с учётными данными и срез политики паролей.
 */
class SystemSettingsService
{
    public static function defaults(): array
    {
        return [
            'global_banner' => [
                'enabled' => false,
                'text' => '',
                'color' => 'yellow',
                'starts_at' => null,
                'ends_at' => null,
                'indefinite' => true,
            ],
            'password_policy' => [
                'min_length' => 12,
                'require_lowercase' => true,
                'require_uppercase' => true,
                'require_digits' => true,
                'require_special' => false,
                'exclude_similar' => true,
                'expiry_days' => null,
            ],
            'email_template' => [
                'from_name' => 'College Works Control',
                'subject' => 'Доступ к платформе College Works Control',
                'body' => "Здравствуйте, {{fullName}}!\n\n"
                    ."Вы зарегистрированы в системе College Works Control.\n\n"
                    ."Данные для входа:\n"
                    ."Логин: {{login}}\n"
                    ."Пароль: {{password}}\n"
                    ."Ссылка для входа: {{loginUrl}}\n\n"
                    ."При первом входе нужно сменить пароль.\n\n"
                    .'С уважением, администрация.',
            ],
            'security' => [
                'session_lifetime_hours' => 24,
                'max_login_attempts' => 5,
                'lockout_minutes' => 30,
                'notify_admin_on_lockout' => true,
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function merged(): array
    {
        $row = SystemSetting::query()->first();

        return array_replace_recursive(self::defaults(), $row?->data ?? []);
    }

    /** @param  array<string, mixed>  $data */
    public static function saveData(array $data): void
    {
        $merged = array_replace_recursive(self::defaults(), $data);
        $model = SystemSetting::query()->first() ?? new SystemSetting;
        $model->data = $merged;
        $model->save();
    }

    /** @return array{active: false}|array{active: true, text: string, color: string} */
    public static function activeBannerPayload(): array
    {
        $b = self::merged()['global_banner'];
        if (empty($b['enabled'])) {
            return ['active' => false];
        }
        $text = trim((string) ($b['text'] ?? ''));
        if ($text === '') {
            return ['active' => false];
        }
        $color = in_array(($b['color'] ?? ''), ['yellow', 'red', 'blue', 'green'], true)
            ? $b['color']
            : 'yellow';

        if (! empty($b['indefinite'])) {
            return ['active' => true, 'text' => $text, 'color' => $color];
        }

        try {
            $start = isset($b['starts_at']) ? Carbon::parse($b['starts_at'])->startOfDay() : null;
            $end = isset($b['ends_at']) ? Carbon::parse($b['ends_at'])->endOfDay() : null;
        } catch (\Throwable) {
            return ['active' => false];
        }

        $now = now();
        if ($start && $now->lt($start)) {
            return ['active' => false];
        }
        if ($end && $now->gt($end)) {
            return ['active' => false];
        }

        return ['active' => true, 'text' => $text, 'color' => $color];
    }

    /** @return array{subject: string, body: string, from_name: string} */
    public static function renderCredentialsMail(User $user, string $plainPassword, bool $temporary): array
    {
        $settings = self::merged();
        $tpl = $settings['email_template'];
        $roleLabel = match ($user->role) {
            'student' => 'Студент',
            'teacher' => 'Преподаватель',
            'admin' => 'Администратор',
            default => $user->role,
        };
        $groupName = $user->studentGroup?->name ?? '—';
        $loginUrl = rtrim((string) config('app.frontend_url'), '/').'/login';

        $repl = [
            '{{fullName}}' => $user->full_name,
            '{{login}}' => $user->login,
            '{{password}}' => $plainPassword,
            '{{loginUrl}}' => $loginUrl,
            '{{role}}' => $roleLabel,
            '{{group}}' => $groupName,
        ];
        $body = strtr((string) ($tpl['body'] ?? ''), $repl);
        if ($temporary) {
            $body .= "\n\nЭто временный пароль — после входа смените его в профиле.";
        }

        return [
            'subject' => (string) ($tpl['subject'] ?? 'Доступ к платформе'),
            'body' => $body,
            'from_name' => (string) ($tpl['from_name'] ?? config('app.name')),
        ];
    }

    /** @return array<string, mixed> */
    public static function passwordPolicySlice(): array
    {
        return Arr::get(self::merged(), 'password_policy', self::defaults()['password_policy']);
    }
}
