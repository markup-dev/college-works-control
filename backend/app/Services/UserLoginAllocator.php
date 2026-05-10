<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;

/**
 * Генерация уникального логина по ФИО (латиница + подчёркивание) с устранением коллизий в БД и в рамках одного импорта.
 * Логин как в сидере: фамилия (ASCII) + "_" + первая буква имени + первая буква отчества.
 * При коллизии: суффиксы _2, _3, … (как при дублях в одном CSV).
 */
final class UserLoginAllocator
{
    /**
     * @param  list<string>  $reservedNormalized  Уже занятые логины (нижний регистр) в текущей операции
     */
    public function allocateFromNames(
        string $lastName,
        string $firstName,
        string $middleName = '',
        array $reservedNormalized = [],
    ): string {
        $lastName = trim($lastName);
        $firstName = trim($firstName);
        $middleName = trim($middleName);

        $fi = mb_substr($firstName, 0, 1) ?: 'x';
        $mi = mb_substr($middleName, 0, 1) ?: 'x';

        $combined = $lastName . '_' . $fi . $mi;
        $base = Str::lower(Str::ascii($combined));
        $base = preg_replace('/[^a-z0-9_]/', '', $base) ?? '';
        if ($base === '') {
            $base = 'user_' . Str::lower(Str::random(6));
        }
        if (strlen($base) < 6) {
            $base .= str_repeat('x', 6 - strlen($base));
        }

        $maxBaseLen = 26;
        $base = substr($base, 0, $maxBaseLen);

        $reserved = array_fill_keys(array_map('mb_strtolower', $reservedNormalized), true);

        $candidate = $base;
        $n = 2;
        while (User::where('login', $candidate)->exists() || isset($reserved[mb_strtolower($candidate)])) {
            $suffix = '_' . $n;
            $candidate = substr($base, 0, max(1, 30 - strlen($suffix))) . $suffix;
            $n++;
            if ($n > 10002) {
                $candidate = substr($base, 0, 18) . '_' . Str::lower(Str::random(8));
                $candidate = substr($candidate, 0, 30);
                if (! User::where('login', $candidate)->exists() && ! isset($reserved[mb_strtolower($candidate)])) {
                    break;
                }
            }
        }

        return substr($candidate, 0, 30);
    }
}
