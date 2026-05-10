<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Нормализация тела запроса: ключи JSON/form с фронта в camelCase приводятся к snake_case для валидации Laravel.
 */
class ConvertCamelToSnake
{
    public function handle(Request $request, Closure $next)
    {
        // Query string уже в snake_case с фронта; для GET/HEAD не трогаем input — меньше сюрпризов и конфликтов.
        if (in_array($request->getRealMethod(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        $input = $request->all();
        $request->replace($this->convertKeys($input));

        return $next($request);
    }

    private function convertKeys(array $data): array
    {
        $result = [];
        foreach ($data as $key => $value) {
            $snakeKey = Str::snake($key);
            $result[$snakeKey] = is_array($value) ? $this->convertKeys($value) : $value;
        }
        return $result;
    }
}
