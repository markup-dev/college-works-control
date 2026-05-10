<?php

namespace App\Services\Admin;

use App\Models\Group;
use App\Models\Subject;
use App\Services\UserLoginAllocator;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Импорт админки из CSV: разбор файла (разделитель, UTF-8 BOM, заголовки в snake_case),
 * валидация строк групп, предметов и пользователей с отчётом по ошибкам построчно.
 */
class AdminCsvImportService
{
    public function parseFile(string $path): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            return [];
        }

        $firstLine = fgets($handle);
        if ($firstLine === false) {
            fclose($handle);
            return [];
        }

        // Эвристика: чаще в РФ «;» в Excel, иначе запятая — от этого зависит fgetcsv.
        $delimiter = substr_count($firstLine, ';') > substr_count($firstLine, ',') ? ';' : ',';
        rewind($handle);

        $headers = fgetcsv($handle, 0, $delimiter) ?: [];
        $headers = array_map(function ($header) {
            $normalized = trim((string) $header);
            // Снять BOM у первой колонки, если файл сохранён как UTF-8 из Excel.
            $normalized = preg_replace('/^\xEF\xBB\xBF/u', '', $normalized);

            return Str::snake($normalized);
        }, $headers);

        $rows = [];
        $rowNumber = 1;
        while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
            $rowNumber++;
            if (count(array_filter($data, fn ($value) => trim((string) $value) !== '')) === 0) {
                continue;
            }

            $row = [];
            foreach ($headers as $index => $header) {
                if ($header === '') {
                    continue;
                }
                $value = $data[$index] ?? null;
                $row[$header] = $value !== null ? trim((string) $value) : null;
            }

            $rows[] = [
                'row' => $rowNumber,
                'data' => $row,
            ];
        }

        fclose($handle);

        return $rows;
    }

    public function analyzeGroupRows(array $rows): array
    {
        $preparedRows = [];
        $validRows = [];
        $errors = [];
        $seenNames = [];

        foreach ($rows as $entry) {
            $rowNumber = (int) ($entry['row'] ?? 0);
            $data = is_array($entry['data'] ?? null) ? $entry['data'] : (is_array($entry) ? $entry : []);
            $name = mb_strtoupper(trim((string) ($data['name'] ?? '')));
            $status = trim((string) ($data['status'] ?? 'active'));
            $specialtyRaw = $data['specialty'] ?? $data['специальность'] ?? null;
            $specialty = trim((string) $specialtyRaw);
            $rowErrors = [];

            if ($name === '') {
                $rowErrors[] = 'Введите название группы.';
            } elseif (! preg_match('/^[А-ЯЁA-Z0-9-]+$/iu', $name)) {
                $rowErrors[] = 'Группа может содержать только буквы, цифры и дефис.';
            }

            if ($specialty !== '' && mb_strlen($specialty) > 150) {
                $rowErrors[] = 'Название специальности не должно превышать 150 символов.';
            }

            if (! in_array($status, ['active', 'inactive'], true)) {
                $rowErrors[] = 'Статус группы должен быть active или inactive.';
            }

            if ($name !== '') {
                if (in_array(mb_strtolower($name), $seenNames, true)) {
                    $rowErrors[] = 'Название группы дублируется в импортируемом файле.';
                } else {
                    $seenNames[] = mb_strtolower($name);
                }

                $exists = Group::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->exists();
                if ($exists) {
                    $rowErrors[] = 'Группа с таким названием уже существует.';
                }
            }

            $normalized = [
                'name' => $name,
                'specialty' => $specialty !== '' ? $specialty : null,
                'status' => $status ?: 'active',
            ];

            $preparedRows[] = [
                'row' => $rowNumber,
                'status' => count($rowErrors) === 0 ? 'valid' : 'error',
                'errors' => $rowErrors,
                'data' => $normalized,
            ];

            if (count($rowErrors) === 0) {
                $validRows[] = $normalized;
            } else {
                $errors[] = ['row' => $rowNumber, 'errors' => $rowErrors];
            }
        }

        return [
            'rows' => $preparedRows,
            'valid_rows' => $validRows,
            'errors' => $errors,
        ];
    }

    public function analyzeSubjectRows(array $rows): array
    {
        $preparedRows = [];
        $validRows = [];
        $errors = [];
        $seenNames = [];
        $seenCodes = [];

        foreach ($rows as $entry) {
            $rowNumber = (int) ($entry['row'] ?? 0);
            $data = is_array($entry['data'] ?? null) ? $entry['data'] : (is_array($entry) ? $entry : []);
            $name = trim((string) ($data['name'] ?? ''));
            $code = trim((string) ($data['code'] ?? ''));
            $status = trim((string) ($data['status'] ?? 'active'));
            $rowErrors = [];

            if ($name === '') {
                $rowErrors[] = 'Введите название предмета.';
            } elseif (mb_strlen($name) < 2) {
                $rowErrors[] = 'Название предмета должно содержать минимум 2 символа.';
            }

            if ($code === '') {
                $rowErrors[] = 'Укажите код предмета.';
            } elseif (mb_strlen($code) > 32) {
                $rowErrors[] = 'Код предмета не длиннее 32 символов.';
            } elseif (! preg_match('/^[А-ЯЁA-Za-z0-9_.-]+$/u', $code)) {
                $rowErrors[] = 'Код может содержать буквы, цифры, точку и дефис.';
            }

            if (! in_array($status, ['active', 'inactive'], true)) {
                $rowErrors[] = 'Статус предмета должен быть active или inactive.';
            }

            if ($name !== '') {
                if (in_array(mb_strtolower($name), $seenNames, true)) {
                    $rowErrors[] = 'Название предмета дублируется в импортируемом файле.';
                } else {
                    $seenNames[] = mb_strtolower($name);
                }
            }

            if ($code !== '' && preg_match('/^[А-ЯЁA-Za-z0-9_.-]+$/u', $code)) {
                if (in_array(mb_strtolower($code), $seenCodes, true)) {
                    $rowErrors[] = 'Код предмета дублируется в импортируемом файле.';
                } else {
                    $seenCodes[] = mb_strtolower($code);
                }
                $existingByCode = Subject::whereRaw('LOWER(code) = ?', [mb_strtolower($code)])->first();
                $existingByName = $name !== ''
                    ? Subject::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first()
                    : null;
                if (
                    $existingByName
                    && (! $existingByCode || $existingByName->id !== $existingByCode->id)
                ) {
                    $rowErrors[] = 'Название предмета уже занято другой записью.';
                }
            }

            $normalized = [
                'name' => $name,
                'code' => $code,
                'status' => $status ?: 'active',
            ];

            $preparedRows[] = [
                'row' => $rowNumber,
                'status' => count($rowErrors) === 0 ? 'valid' : 'error',
                'errors' => $rowErrors,
                'data' => $normalized,
            ];

            if (count($rowErrors) === 0) {
                $validRows[] = $normalized;
            } else {
                $errors[] = ['row' => $rowNumber, 'errors' => $rowErrors];
            }
        }

        return [
            'rows' => $preparedRows,
            'valid_rows' => $validRows,
            'errors' => $errors,
        ];
    }

    public function analyzeUserImportRows(array $rows, UserLoginAllocator $loginAllocator): array
    {
        $preparedRows = [];
        $validRows = [];
        $errors = [];
        $seenLogins = [];
        $seenEmails = [];

        foreach ($rows as $entry) {
            $rowNumber = (int) ($entry['row'] ?? 0);
            $data = is_array($entry['data'] ?? null) ? $entry['data'] : (is_array($entry) ? $entry : []);

            if (array_key_exists('patronymic', $data) && ! array_key_exists('middle_name', $data)) {
                $data['middle_name'] = $data['patronymic'];
            }

            if (array_key_exists('login', $data)) {
                $loginTrim = trim((string) $data['login']);
                if ($loginTrim === '') {
                    unset($data['login']);
                } else {
                    $data['login'] = $loginTrim;
                }
            }

            $validator = Validator::make(
                $data,
                [
                    'login' => ['nullable', 'string', 'min:6', 'max:30', 'regex:/^[a-zA-Z0-9_]+$/', Rule::unique('users', 'login')],
                    'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
                    'password' => ['nullable', 'string', 'min:8', 'max:128', 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/'],
                    'last_name' => ['required', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
                    'first_name' => ['required', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
                    'middle_name' => ['nullable', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
                    'role' => ['required', 'in:student,teacher,admin'],
                    'group' => ['nullable', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
                    'group_id' => ['nullable', 'exists:groups,id'],
                    'department' => ['nullable', 'string', 'max:100'],
                    'phone' => ['nullable', 'string', 'regex:/^(\+7\s?\(?\d{3}\)?\s?\d{3}[- ]?\d{2}[- ]?\d{2}|8\(\d{3}\)\d{3}-\d{2}-\d{2})$/'],
                ],
                [
                    'login.min' => 'Логин должен содержать минимум 6 символов.',
                    'login.regex' => 'Логин может содержать только латинские буквы, цифры и подчеркивание.',
                    'login.unique' => 'Пользователь с таким логином уже существует.',
                    'email.required' => 'Введите email.',
                    'email.email' => 'Введите корректный email.',
                    'email.unique' => 'Пользователь с таким email уже существует.',
                    'password.min' => 'Пароль должен содержать минимум 8 символов.',
                    'password.regex' => 'Пароль должен содержать заглавную, строчную букву и цифру.',
                    'last_name.required' => 'Введите фамилию.',
                    'last_name.regex' => 'Фамилия может содержать только кириллические буквы и дефис.',
                    'first_name.required' => 'Введите имя.',
                    'first_name.regex' => 'Имя может содержать только кириллические буквы и дефис.',
                    'middle_name.regex' => 'Отчество может содержать только кириллические буквы и дефис.',
                    'group.regex' => 'Группа может содержать только буквы, цифры и дефис.',
                    'group_id.exists' => 'Выбранная группа не найдена.',
                    'phone.regex' => 'Телефон должен быть в формате 8(XXX)XXX-XX-XX или +7 (XXX) XXX-XX-XX.',
                ]
            );

            $rowErrors = $validator->errors()->all();

            if (($data['role'] ?? null) === 'student' && empty($data['group']) && empty($data['group_id'])) {
                $rowErrors[] = 'Для роли "student" укажите учебную группу.';
            }

            if (count($rowErrors) === 0 && ! isset($data['login'])) {
                $data['login'] = $loginAllocator->allocateFromNames(
                    trim((string) ($data['last_name'] ?? '')),
                    trim((string) ($data['first_name'] ?? '')),
                    trim((string) ($data['middle_name'] ?? '')),
                    $seenLogins,
                );
            }

            $normalizedLogin = mb_strtolower(trim((string) ($data['login'] ?? '')));
            $normalizedEmail = mb_strtolower(trim((string) ($data['email'] ?? '')));

            if ($normalizedLogin !== '') {
                if (in_array($normalizedLogin, $seenLogins, true)) {
                    $rowErrors[] = 'Логин дублируется в импортируемом файле.';
                } else {
                    $seenLogins[] = $normalizedLogin;
                }
            }

            if ($normalizedEmail !== '') {
                if (in_array($normalizedEmail, $seenEmails, true)) {
                    $rowErrors[] = 'Email дублируется в импортируемом файле.';
                } else {
                    $seenEmails[] = $normalizedEmail;
                }
            }

            if (($data['role'] ?? null) !== 'student') {
                $data['group'] = null;
                $data['group_id'] = null;
            }

            $preparedRows[] = [
                'row' => $rowNumber,
                'status' => count($rowErrors) === 0 ? 'valid' : 'error',
                'errors' => $rowErrors,
                'data' => $data,
                'generated_password' => empty($data['password']),
            ];

            if (count($rowErrors) === 0) {
                $validRows[] = $data;
            } else {
                $errors[] = [
                    'row' => $rowNumber,
                    'errors' => $rowErrors,
                ];
            }
        }

        return [
            'rows' => $preparedRows,
            'valid_rows' => $validRows,
            'errors' => $errors,
        ];
    }
}
