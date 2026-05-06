<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $validated = $request->validate(
            [
                'login' => [
                    'required',
                    'string',
                    'max:255',
                    function (string $attribute, mixed $value, \Closure $fail): void {
                        $login = trim((string) $value);
                        if (filter_var($login, FILTER_VALIDATE_EMAIL)) {
                            return;
                        }
                        if (!preg_match('/^[a-zA-Z0-9_]{6,30}$/', $login)) {
                            $fail('Логин может содержать только латинские буквы, цифры и подчеркивание (6-30 символов) либо корректный email.');
                        }
                    },
                ],
                'password' => ['required', 'string', 'min:8', 'max:128'],
                'role' => ['nullable', 'in:student,teacher,admin'],
            ],
            [
                'login.required' => 'Введите логин или email.',
                'password.required' => 'Введите пароль.',
                'password.min' => 'Пароль должен содержать минимум 8 символов.',
                'password.max' => 'Пароль не должен превышать 128 символов.',
                'role.in' => 'Выберите корректную роль.',
            ]
        );

        $user = User::where('login', $validated['login'])
            ->orWhere('email', $validated['login'])
            ->first();

        if (!$user || !$user->is_active) {
            throw ValidationException::withMessages([
                'login' => ['Неверный логин/email или пароль'],
            ]);
        }

        if (!empty($validated['role']) && $user->role !== $validated['role']) {
            throw ValidationException::withMessages([
                'role' => ["Этот аккаунт не является {$validated['role']}"],
            ]);
        }

        if (!Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['Неверный логин/email или пароль'],
            ]);
        }

        $user->update(['last_login' => now()]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'user' => $user->load(['studentGroup']),
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['success' => true]);
    }

    public function profile(Request $request)
    {
        return response()->json($request->user()->load(['studentGroup']));
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        if ($request->filled('patronymic') && !$request->has('middle_name')) {
            $request->merge(['middle_name' => $request->input('patronymic')]);
        }

        $validated = $request->validate(
            [
                'login' => [
                    'sometimes',
                    'required',
                    'string',
                    'min:6',
                    'max:30',
                    'regex:/^[a-zA-Z0-9_]+$/',
                    Rule::unique('users', 'login')->ignore($user->id),
                ],
                'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
                'last_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
                'first_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
                'middle_name' => ['nullable', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
                'phone' => ['nullable', 'string', 'regex:/^(\+7\s?\(?\d{3}\)?\s?\d{3}[- ]?\d{2}[- ]?\d{2}|8\(\d{3}\)\d{3}-\d{2}-\d{2})$/'],
                'notifications' => ['nullable', 'array'],
                'notifications.email' => ['nullable', 'boolean'],
                'grade_scale' => ['nullable', 'array', 'max:20'],
                'grade_scale.*.label' => ['required_with:grade_scale', 'string', 'max:3', 'regex:/^[1-5][+-]?$/u'],
                'grade_scale.*.min_score' => ['required_with:grade_scale', 'integer', 'min:0', 'max:100'],
                'department' => ['nullable', 'string', 'max:100'],
            ],
            [
                'login.required' => 'Введите логин.',
                'login.min' => 'Логин должен содержать минимум 6 символов.',
                'login.regex' => 'Логин может содержать только латинские буквы, цифры и подчеркивание.',
                'login.unique' => 'Пользователь с таким логином уже существует.',
                'email.required' => 'Введите email.',
                'email.email' => 'Введите корректный email.',
                'email.unique' => 'Пользователь с таким email уже существует.',
                'last_name.required' => 'Введите фамилию.',
                'last_name.regex' => 'Фамилия может содержать только кириллические буквы и дефис.',
                'first_name.required' => 'Введите имя.',
                'first_name.regex' => 'Имя может содержать только кириллические буквы и дефис.',
                'middle_name.regex' => 'Отчество может содержать только кириллические буквы и дефис.',
                'phone.regex' => 'Телефон должен быть в формате 8(XXX)XXX-XX-XX или +7 (XXX) XXX-XX-XX.',
                'grade_scale.*.label.regex' => 'Оценка в шкале должна быть от 1 до 5, можно с плюсом или минусом.',
                'grade_scale.*.min_score.min' => 'Порог оценки не может быть ниже 0.',
                'grade_scale.*.min_score.max' => 'Порог оценки не может быть выше 100.',
                'department.max' => 'Поле "Кафедра/отделение" не должно превышать 100 символов.',
            ]
        );
        if (array_key_exists('notifications', $validated)) {
            if (array_key_exists('email', $validated['notifications'])) {
                $validated['email_notifications_enabled'] = (bool) $validated['notifications']['email'];
            }
            unset($validated['notifications']);
        }
        if (array_key_exists('last_name', $validated)) {
            $validated['last_name'] = trim($validated['last_name']);
        }
        if (array_key_exists('first_name', $validated)) {
            $validated['first_name'] = trim($validated['first_name']);
        }
        if (array_key_exists('middle_name', $validated)) {
            $validated['middle_name'] = !empty($validated['middle_name']) ? trim($validated['middle_name']) : null;
        }
        if (array_key_exists('grade_scale', $validated)) {
            if ($user->role !== 'teacher') {
                unset($validated['grade_scale']);
            } else {
                $validated['grade_scale'] = User::normalizeGradeScale($validated['grade_scale']);
            }
        }
        $user->update($validated);

        return response()->json([
            'success' => true,
            'user' => $user->fresh()->load(['studentGroup']),
        ]);
    }

    public function changePassword(Request $request)
    {
        $validated = $request->validate(
            [
                'current_password' => ['required', 'string'],
                'new_password' => ['required', 'string', 'min:8', 'max:128', 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/', 'different:current_password', 'confirmed'],
            ],
            [
                'current_password.required' => 'Введите текущий пароль.',
                'new_password.required' => 'Введите новый пароль.',
                'new_password.min' => 'Новый пароль должен содержать минимум 8 символов.',
                'new_password.regex' => 'Пароль должен содержать заглавную, строчную букву и цифру.',
                'new_password.different' => 'Новый пароль не должен совпадать с текущим.',
                'new_password.confirmed' => 'Подтверждение пароля не совпадает.',
            ]
        );

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Текущий пароль указан неверно'],
            ]);
        }

        $user->update([
            'password' => $validated['new_password'],
            'must_change_password' => false,
        ]);

        return response()->json([
            'success' => true,
            'user' => $user->fresh()->load(['studentGroup']),
        ]);
    }
}
