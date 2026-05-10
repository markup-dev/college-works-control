<?php

namespace App\Http\Controllers;

use App\Services\SystemSettingsService;
use Illuminate\Http\Request;

/**
 * Публичный (для авторизованных) эндпоинт информационного баннера с главной страницы.
 * Текст и сроки берутся из системных настроек (глобальный баннер).
 */
class PlatformBannerController extends Controller
{
    public function show(Request $request)
    {
        return response()->json(SystemSettingsService::activeBannerPayload());
    }
}
