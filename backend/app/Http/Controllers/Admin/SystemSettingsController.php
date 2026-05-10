<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemLog;
use App\Services\SystemSettingsService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Админ: чтение и сохранение глобальных настроек платформы (баннер, политика паролей и т.д.).
 */
class SystemSettingsController extends Controller
{
    public function systemSettings()
    {
        return response()->json([
            'success' => true,
            'data' => SystemSettingsService::merged(),
        ]);
    }

    public function updateSystemSettings(Request $request)
    {
        $validated = $request->validate([
            'global_banner' => ['required', 'array'],
            'global_banner.enabled' => ['boolean'],
            'global_banner.text' => ['nullable', 'string', 'max:2000'],
            'global_banner.color' => ['required', Rule::in(['yellow', 'red', 'blue', 'green'])],
            'global_banner.starts_at' => ['nullable', 'date'],
            'global_banner.ends_at' => ['nullable', 'date'],
            'global_banner.indefinite' => ['boolean'],

            'password_policy' => ['required', 'array'],
            'password_policy.min_length' => ['required', 'integer', 'min:8', 'max:128'],
            'password_policy.require_lowercase' => ['boolean'],
            'password_policy.require_uppercase' => ['boolean'],
            'password_policy.require_digits' => ['boolean'],
            'password_policy.require_special' => ['boolean'],
            'password_policy.exclude_similar' => ['boolean'],
            'password_policy.expiry_days' => ['nullable', 'integer', 'min:1', 'max:3650'],

            'email_template' => ['required', 'array'],
            'email_template.from_name' => ['required', 'string', 'max:120'],
            'email_template.subject' => ['required', 'string', 'max:255'],
            'email_template.body' => ['required', 'string', 'max:10000'],

            'security' => ['required', 'array'],
            'security.session_lifetime_hours' => ['required', 'integer', 'min:1', 'max:720'],
            'security.max_login_attempts' => ['required', 'integer', 'min:1', 'max:20'],
            'security.lockout_minutes' => ['required', 'integer', 'min:5', 'max:1440'],
            'security.notify_admin_on_lockout' => ['boolean'],
        ]);

        if (! empty($validated['global_banner']['starts_at']) && ! empty($validated['global_banner']['ends_at'])) {
            if (strtotime((string) $validated['global_banner']['ends_at']) < strtotime((string) $validated['global_banner']['starts_at'])) {
                throw ValidationException::withMessages([
                    'global_banner.ends_at' => 'Дата окончания не может быть раньше даты начала.',
                ]);
            }
        }

        SystemSettingsService::saveData($validated);

        SystemLog::create([
            'user_id' => $request->user()->id,
            'action' => 'system_settings_updated',
            'details' => 'Сохранены системные настройки',
        ]);

        return response()->json([
            'success' => true,
            'data' => SystemSettingsService::merged(),
        ]);
    }
}
