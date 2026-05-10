<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Блокировка деактивированных учёток: авторизован, но is_active = false — 403 (админ отключил доступ).
 */
class CheckUserActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        // Для неаутентифицированных запросов user = null — пропускаем (роль проверит другой middleware).
        if ($user !== null && ! $user->is_active) {
            return response()->json([
                'success' => false,
                'error' => 'Учётная запись отключена',
            ], 403);
        }

        return $next($request);
    }
}
