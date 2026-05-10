<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ограничение маршрута списком ролей (student | teacher | admin). Без совпадения — 403 JSON.
 */
class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        // Гость или роль не из переданного набора — не пускаем (защита API после Sanctum).
        if (! $request->user() || ! in_array($request->user()->role, $roles, true)) {
            return response()->json([
                'success' => false,
                'error' => 'Доступ запрещён',
            ], 403);
        }

        return $next($request);
    }
}
