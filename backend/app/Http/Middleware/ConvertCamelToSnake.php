<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ConvertCamelToSnake
{
    public function handle(Request $request, Closure $next)
    {
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
