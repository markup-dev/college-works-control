<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api_user', function (Request $request) {
            $key = (string) ($request->user()?->id ?? $request->ip());

            return Limit::perMinute(180)->by($key);
        });

        RateLimiter::for('admin_bulk', function (Request $request) {
            return Limit::perMinute(24)->by('admin_bulk:'.$request->user()->id);
        });

        RateLimiter::for('teacher_broadcast', function (Request $request) {
            return Limit::perMinute(12)->by('broadcast:'.$request->user()->id);
        });
    }
}
