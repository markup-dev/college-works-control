<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * Регистрация и bootstrap приложения: здесь задаются именованные лимиты запросов для тяжёлых и массовых операций API.
 */
class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Доп. биндинги контейнера при необходимости — пока пусто.
    }

    public function boot(): void
    {
        // Обычные API-запросы: лимит на пользователя (или IP для гостя), защита от перегрузки.
        RateLimiter::for('api_user', function (Request $request) {
            $key = (string) ($request->user()?->id ?? $request->ip());

            return Limit::perMinute(180)->by($key);
        });

        // Импорт CSV и прочие массовые админ-операции — более жёсткий лимит, отдельный ключ.
        RateLimiter::for('admin_bulk', function (Request $request) {
            $key = (string) ($request->user()?->id ?? $request->ip());

            return Limit::perMinute(24)->by('admin_bulk:'.$key);
        });

        // Рассылка преподавателя по группам — ограничение частоты и объёма исходящих действий.
        RateLimiter::for('teacher_broadcast', function (Request $request) {
            $key = (string) ($request->user()?->id ?? $request->ip());

            return Limit::perMinute(12)->by('broadcast:'.$key);
        });
    }
}
