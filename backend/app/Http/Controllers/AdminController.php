<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Subject;
use App\Models\Group;
use App\Models\Assignment;
use App\Models\Submission;
use App\Models\SystemLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Throwable;

class AdminController extends Controller
{
    private const USERS_PER_PAGE = 20;
    private const GROUPS_PER_PAGE = 20;
    private const SUBJECTS_PER_PAGE = 20;
    private const LOGS_PER_PAGE = 20;

    public function stats()
    {
        $usersByRole = User::selectRaw('role, COUNT(*) as total')
            ->groupBy('role')
            ->pluck('total', 'role');

        return response()->json([
            'total_users' => User::count(),
            'active_users' => User::where('is_active', true)->count(),
            'student_users' => (int) ($usersByRole['student'] ?? 0),
            'teacher_users' => (int) ($usersByRole['teacher'] ?? 0),
            'admin_users' => (int) ($usersByRole['admin'] ?? 0),
            'total_groups' => Group::count(),
            'total_subjects' => Subject::count(),
            'active_subjects' => Subject::where('status', 'active')->count(),
            'total_assignments' => Assignment::count(),
            'total_submissions' => Submission::count(),
            'pending_submissions' => Submission::where('status', 'submitted')->count(),
            'graded_submissions' => Submission::where('status', 'graded')->count(),
            'returned_submissions' => Submission::where('status', 'returned')->count(),
            'system_uptime' => '99.8%',
        ]);
    }

    // --- Users ---

    public function users()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'in:student,teacher,admin'],
            'status' => ['nullable', 'in:active,inactive'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'sort' => ['nullable', 'in:newest,oldest,name_asc,name_desc,last_login_desc,last_login_asc'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::with(['studentGroup:id,name', 'notificationSettings'])
            ->select([
                'id',
                'login',
                'email',
                'last_name',
                'first_name',
                'middle_name',
                'role',
                'group_id',
                'department',
                'phone',
                'is_active',
                'must_change_password',
                'last_login',
                'created_at',
            ]);

        if (!empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(function ($builder) use ($term) {
                $builder
                    ->where('login', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%")
                    ->orWhere('last_name', 'like', "%{$term}%")
                    ->orWhere('first_name', 'like', "%{$term}%")
                    ->orWhere('middle_name', 'like', "%{$term}%");
            });
        }

        if (!empty($validated['role'])) {
            $query->where('role', $validated['role']);
        }

        if (!empty($validated['status'])) {
            $query->where('is_active', $validated['status'] === 'active');
        }

        if (!empty($validated['group_id'])) {
            $query->where('group_id', (int) $validated['group_id']);
        }

        if (!empty($validated['subject_id'])) {
            $subjectId = (int) $validated['subject_id'];
            $query->where(function ($builder) use ($subjectId) {
                $builder
                    ->where(function ($students) use ($subjectId) {
                        $students->where('role', 'student')
                            ->whereIn('group_id', function ($sub) use ($subjectId) {
                                $sub->select('id')
                                    ->from('groups')
                                    ->whereIn('teacher_id', function ($subjectSub) use ($subjectId) {
                                        $subjectSub->select('teacher_id')
                                            ->from('subjects')
                                            ->where('id', $subjectId)
                                            ->whereNotNull('teacher_id');
                                    });
                            });
                    })
                    ->orWhere(function ($teachers) use ($subjectId) {
                        $teachers->where('role', 'teacher')
                            ->whereHas('subjects', fn ($subjectQuery) => $subjectQuery->where('subjects.id', $subjectId));
                    });
            });
        }

        $sort = $validated['sort'] ?? 'newest';
        switch ($sort) {
            case 'oldest':
                $query->orderBy('created_at');
                break;
            case 'name_asc':
                $query->orderBy('last_name')->orderBy('first_name')->orderBy('middle_name');
                break;
            case 'name_desc':
                $query->orderByDesc('last_name')->orderByDesc('first_name')->orderByDesc('middle_name');
                break;
            case 'last_login_asc':
                $query->orderBy('last_login');
                break;
            case 'last_login_desc':
                $query->orderByDesc('last_login');
                break;
            case 'newest':
            default:
                $query->orderByDesc('created_at');
                break;
        }

        $perPage = (int) ($validated['per_page'] ?? self::USERS_PER_PAGE);
        $users = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => $users->items(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function createUser(Request $request)
    {
        if ($request->filled('patronymic') && !$request->has('middle_name')) {
            $request->merge(['middle_name' => $request->input('patronymic')]);
        }

        $validated = $request->validate(
            [
                'login' => ['required', 'string', 'min:6', 'max:30', 'regex:/^[a-zA-Z0-9_]+$/', 'unique:users,login'],
                'email' => ['required', 'email', 'max:255', 'unique:users,email'],
                'password' => ['nullable', 'string', 'min:8', 'max:128', 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/'],
                'generate_password' => ['nullable', 'boolean'],
                'send_credentials' => ['nullable', 'boolean'],
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
                'login.required' => 'Введите логин.',
                'login.min' => 'Логин должен содержать минимум 6 символов.',
                'login.regex' => 'Логин может содержать только латинские буквы, цифры и подчеркивание.',
                'login.unique' => 'Пользователь с таким логином уже существует.',
                'email.required' => 'Введите email.',
                'email.email' => 'Введите корректный email.',
                'email.unique' => 'Пользователь с таким email уже существует.',
                'password.required' => 'Введите пароль.',
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

        // Для ручного создания админом всегда используем временный пароль:
        // он не вводится вручную и должен быть отправлен пользователю на email.
        $sendCredentials = true;
        $plainPassword = $this->generateTemporaryPassword();
        $isTemporaryPassword = true;

        $groupId = null;
        if ($validated['role'] === 'student' && !empty($validated['group_id'])) {
            $groupId = (int) $validated['group_id'];
        } elseif ($validated['role'] === 'student' && !empty($validated['group'])) {
            $group = Group::firstOrCreate(
                [
                    'name' => trim($validated['group']),
                    'teacher_id' => null,
                ],
                ['status' => 'active']
            );
            $groupId = $group->id;
        }

        unset($validated['group']);
        unset($validated['generate_password'], $validated['send_credentials']);

        $user = User::create([
            ...$validated,
            'password' => $plainPassword,
            'last_name' => trim($validated['last_name']),
            'first_name' => trim($validated['first_name']),
            'middle_name' => !empty($validated['middle_name']) ? trim($validated['middle_name']) : null,
            'group_id' => $groupId,
            'is_active' => true,
            'must_change_password' => $isTemporaryPassword,
            'theme' => 'system',
        ]);
        $this->syncNotificationSettings($user, [
            'email' => true,
            'push' => true,
            'sms' => false,
        ]);
        $user->unsetRelation('studentGroup');

        $this->log($request, 'create_user', "Создан пользователь {$user->full_name}");

        if ($sendCredentials && !empty($user->email)) {
            $this->sendCredentialsEmail($user, $plainPassword, true);
        }

        return response()->json(['success' => true, 'user' => $user->load(['studentGroup.teacher', 'notificationSettings'])], 201);
    }

    public function updateUser(Request $request, User $user)
    {
        if ($request->filled('patronymic') && !$request->has('middle_name')) {
            $request->merge(['middle_name' => $request->input('patronymic')]);
        }

        $validated = $request->validate(
            [
                'login' => ['sometimes', 'required', 'string', 'min:6', 'max:30', 'regex:/^[a-zA-Z0-9_]+$/', Rule::unique('users', 'login')->ignore($user->id)],
                'last_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
                'first_name' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
                'middle_name' => ['nullable', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
                'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
                'password' => ['nullable', 'string', 'min:8', 'max:128', 'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/'],
                'role' => ['sometimes', 'in:student,teacher,admin'],
                'group' => ['nullable', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
                'group_id' => ['nullable', 'exists:groups,id'],
                'department' => ['nullable', 'string', 'max:100'],
                'phone' => ['nullable', 'string', 'regex:/^(\+7\s?\(?\d{3}\)?\s?\d{3}[- ]?\d{2}[- ]?\d{2}|8\(\d{3}\)\d{3}-\d{2}-\d{2})$/'],
                'bio' => ['nullable', 'string', 'max:500'],
                'is_active' => ['sometimes', 'boolean'],
            ],
            [
                'login.min' => 'Логин должен содержать минимум 6 символов.',
                'login.regex' => 'Логин может содержать только латинские буквы, цифры и подчеркивание.',
                'login.unique' => 'Пользователь с таким логином уже существует.',
                'email.email' => 'Введите корректный email.',
                'email.unique' => 'Пользователь с таким email уже существует.',
                'password.min' => 'Пароль должен содержать минимум 8 символов.',
                'password.regex' => 'Пароль должен содержать заглавную, строчную букву и цифру.',
                'last_name.regex' => 'Фамилия может содержать только кириллические буквы и дефис.',
                'first_name.regex' => 'Имя может содержать только кириллические буквы и дефис.',
                'middle_name.regex' => 'Отчество может содержать только кириллические буквы и дефис.',
                'group.regex' => 'Группа может содержать только буквы, цифры и дефис.',
                'group_id.exists' => 'Выбранная группа не найдена.',
                'phone.regex' => 'Телефон должен быть в формате 8(XXX)XXX-XX-XX или +7 (XXX) XXX-XX-XX.',
            ]
        );

        if (
            ($validated['role'] ?? $user->role) === 'student' &&
            (array_key_exists('group', $validated) || array_key_exists('group_id', $validated))
        ) {
            if (!empty($validated['group_id'])) {
                $validated['group_id'] = (int) $validated['group_id'];
            } else {
                $groupName = trim((string) ($validated['group'] ?? ''));
                if ($groupName !== '') {
                    $group = Group::firstOrCreate(
                        [
                            'name' => $groupName,
                            'teacher_id' => $user->studentGroup?->teacher_id,
                        ],
                        ['status' => 'active']
                    );
                    $validated['group_id'] = $group->id;
                } else {
                    $validated['group_id'] = null;
                }
            }
        }

        if (($validated['role'] ?? $user->role) !== 'student') {
            $validated['group_id'] = null;
        }

        unset($validated['group']);
        if (array_key_exists('password', $validated) && empty($validated['password'])) {
            unset($validated['password']);
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
        $user->update($validated);

        $this->log($request, 'update_user', "Изменены данные пользователя {$user->full_name}");

        return response()->json(['success' => true, 'user' => $user->fresh()->load(['studentGroup.teacher', 'notificationSettings'])]);
    }

    public function deleteUser(Request $request, User $user)
    {
        $name = $user->full_name;
        $user->delete();

        $this->log($request, 'delete_user', "Удален пользователь {$name}");

        return response()->json(['success' => true]);
    }

    public function previewUsersImport(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ], [
            'file.required' => 'Выберите CSV файл для импорта.',
            'file.mimes' => 'Поддерживаются только CSV/TXT файлы.',
            'file.max' => 'Размер файла не должен превышать 5 МБ.',
        ]);

        $rows = $this->parseUsersCsv($request->file('file')->getRealPath());
        $analysis = $this->analyzeImportRows($rows);

        return response()->json([
            'success' => true,
            'summary' => [
                'total_rows' => count($rows),
                'valid_rows' => count($analysis['valid_rows']),
                'error_rows' => count($analysis['errors']),
            ],
            'rows' => $analysis['rows'],
            'valid_rows' => $analysis['valid_rows'],
        ]);
    }

    public function importUsers(Request $request)
    {
        set_time_limit(300);

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['array'],
            'mode' => ['nullable', 'in:strict,partial'],
            'send_credentials' => ['nullable', 'boolean'],
        ], [
            'rows.required' => 'Нет данных для импорта.',
            'rows.min' => 'Файл не содержит строк для импорта.',
            'mode.in' => 'Режим импорта должен быть strict или partial.',
        ]);

        $mode = $validated['mode'] ?? 'strict';
        $sendCredentials = (bool) ($validated['send_credentials'] ?? true);
        $rows = $validated['rows'];

        $analysis = $this->analyzeImportRows($rows);
        $hasErrors = count($analysis['errors']) > 0;

        if ($mode === 'strict' && $hasErrors) {
            return response()->json([
                'success' => false,
                'message' => 'Импорт остановлен: в файле есть ошибки. Исправьте их или используйте partial-режим.',
                'summary' => [
                    'total_rows' => count($rows),
                    'valid_rows' => count($analysis['valid_rows']),
                    'error_rows' => count($analysis['errors']),
                ],
                'rows' => $analysis['rows'],
            ], 422);
        }

        $created = 0;
        $createdUsers = [];

        foreach ($analysis['valid_rows'] as $prepared) {
            $plainPassword = !empty($prepared['password']) ? (string) $prepared['password'] : $this->generateTemporaryPassword();
            $isTemporaryPassword = empty($prepared['password']);

            $groupId = null;
            if (($prepared['role'] ?? null) === 'student') {
                if (!empty($prepared['group_id'])) {
                    $groupId = (int) $prepared['group_id'];
                } elseif (!empty($prepared['group'])) {
                    $group = Group::firstOrCreate(
                        ['name' => trim($prepared['group']), 'teacher_id' => null],
                        ['status' => 'active']
                    );
                    $groupId = $group->id;
                }
            }

            $user = User::create([
                'login' => trim((string) $prepared['login']),
                'email' => trim((string) $prepared['email']),
                'password' => $plainPassword,
                'last_name' => trim((string) $prepared['last_name']),
                'first_name' => trim((string) $prepared['first_name']),
                'middle_name' => !empty($prepared['middle_name']) ? trim((string) $prepared['middle_name']) : null,
                'role' => $prepared['role'],
                'group_id' => $groupId,
                'department' => !empty($prepared['department']) ? trim((string) $prepared['department']) : null,
                'phone' => !empty($prepared['phone']) ? trim((string) $prepared['phone']) : null,
                'is_active' => true,
                'must_change_password' => $isTemporaryPassword,
                'theme' => 'system',
            ]);

            $this->syncNotificationSettings($user, [
                'email' => true,
                'push' => true,
                'sms' => false,
            ]);

            if ($sendCredentials && !empty($user->email)) {
                $this->sendCredentialsEmail($user, $plainPassword, true);
            }

            $created++;
            $createdUsers[] = $user->load(['studentGroup.teacher', 'notificationSettings']);
        }

        $this->log($request, 'import_users', "Массовый импорт пользователей: создано {$created}");

        return response()->json([
            'success' => true,
            'summary' => [
                'total_rows' => count($rows),
                'created' => $created,
                'skipped' => count($rows) - $created,
                'error_rows' => count($analysis['errors']),
            ],
            'rows' => $analysis['rows'],
            'users' => $createdUsers,
        ]);
    }

    public function groups()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
            'sort' => ['nullable', 'in:name_asc,name_desc,students_desc,students_asc,newest,oldest'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Group::with(['teacher:id,login,last_name,first_name,middle_name'])
            ->withCount('students');

        if (!empty($validated['search'])) {
            $query->where('name', 'like', '%' . trim((string) $validated['search']) . '%');
        }

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $sort = $validated['sort'] ?? 'name_asc';
        switch ($sort) {
            case 'name_desc':
                $query->orderByDesc('name');
                break;
            case 'students_desc':
                $query->orderByDesc('students_count')->orderBy('name');
                break;
            case 'students_asc':
                $query->orderBy('students_count')->orderBy('name');
                break;
            case 'newest':
                $query->orderByDesc('created_at');
                break;
            case 'oldest':
                $query->orderBy('created_at');
                break;
            case 'name_asc':
            default:
                $query->orderBy('name');
                break;
        }

        $perPage = (int) ($validated['per_page'] ?? self::GROUPS_PER_PAGE);
        $groups = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => $groups->items(),
            'meta' => [
                'current_page' => $groups->currentPage(),
                'last_page' => $groups->lastPage(),
                'per_page' => $groups->perPage(),
                'total' => $groups->total(),
            ],
        ]);
    }

    public function updateGroup(Request $request, Group $group)
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
            'teacher_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'status' => ['nullable', 'in:active,inactive'],
        ], [
            'name.regex' => 'Группа может содержать только буквы, цифры и дефис.',
            'teacher_id.exists' => 'Выбранный преподаватель не найден.',
            'status.in' => 'Некорректный статус группы.',
        ]);

        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim((string) $validated['name']);

            $duplicateExists = Group::whereRaw('LOWER(name) = ?', [mb_strtolower($validated['name'])])
                ->where('id', '!=', $group->id)
                ->exists();

            if ($duplicateExists) {
                return response()->json([
                    'success' => false,
                    'message' => 'Группа с таким названием уже существует.',
                ], 422);
            }
        }

        if (array_key_exists('teacher_id', $validated)) {
            $validated['teacher_id'] = !empty($validated['teacher_id']) ? (int) $validated['teacher_id'] : null;
        }

        $group->update($validated);

        $freshGroup = $group->fresh(['teacher:id,login,last_name,first_name,middle_name'])->loadCount('students');
        $teacherName = $freshGroup->teacher?->full_name ?: 'не назначен';
        $this->log($request, 'update_group', "Группа {$group->name}: статус {$group->status}, преподаватель {$teacherName}");

        return response()->json([
            'success' => true,
            'group' => $freshGroup,
        ]);
    }

    public function createGroup(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
            'teacher_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'status' => ['nullable', 'in:active,inactive'],
        ], [
            'name.required' => 'Введите название группы.',
            'name.regex' => 'Группа может содержать только буквы, цифры и дефис.',
            'teacher_id.exists' => 'Выбранный преподаватель не найден.',
            'status.in' => 'Некорректный статус группы.',
        ]);

        $name = trim((string) $validated['name']);
        $teacherId = !empty($validated['teacher_id']) ? (int) $validated['teacher_id'] : null;
        $status = $validated['status'] ?? 'active';

        $existingGroup = Group::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
        if ($existingGroup !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Группа с таким названием уже существует.',
            ], 422);
        }

        $group = Group::create([
            'name' => $name,
            'teacher_id' => $teacherId,
            'status' => $status,
        ]);

        $this->log($request, 'create_group', "Создана группа {$group->name}");

        return response()->json([
            'success' => true,
            'group' => $group->load(['teacher:id,login,last_name,first_name,middle_name'])->loadCount('students'),
        ], 201);
    }

    public function createGroupWithStudents(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
            'status' => ['nullable', 'in:active,inactive'],
            'send_credentials' => ['nullable', 'boolean'],
            'students' => ['required', 'array', 'min:1'],
            'students.*.login' => ['required', 'string', 'min:6', 'max:30', 'regex:/^[a-zA-Z0-9_]+$/'],
            'students.*.email' => ['required', 'email', 'max:255'],
            'students.*.last_name' => ['required', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
            'students.*.first_name' => ['required', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
            'students.*.middle_name' => ['nullable', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
            'students.*.phone' => ['nullable', 'string', 'regex:/^(\+7\s?\(?\d{3}\)?\s?\d{3}[- ]?\d{2}[- ]?\d{2}|8\(\d{3}\)\d{3}-\d{2}-\d{2})$/'],
        ]);

        $name = trim((string) $validated['name']);
        $status = $validated['status'] ?? 'active';
        $sendCredentials = (bool) ($validated['send_credentials'] ?? true);

        $existingGroup = Group::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
        if ($existingGroup !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Группа с таким названием уже существует.',
            ], 422);
        }

        $students = $validated['students'];
        $duplicateLogins = [];
        $duplicateEmails = [];
        $seenLogins = [];
        $seenEmails = [];

        foreach ($students as $index => $student) {
            $login = mb_strtolower(trim((string) ($student['login'] ?? '')));
            $email = mb_strtolower(trim((string) ($student['email'] ?? '')));
            if (in_array($login, $seenLogins, true)) {
                $duplicateLogins[] = $index + 1;
            } else {
                $seenLogins[] = $login;
            }
            if (in_array($email, $seenEmails, true)) {
                $duplicateEmails[] = $index + 1;
            } else {
                $seenEmails[] = $email;
            }
        }

        if (!empty($duplicateLogins) || !empty($duplicateEmails)) {
            return response()->json([
                'success' => false,
                'message' => 'В списке студентов есть дубли логинов или email.',
            ], 422);
        }

        $existingLogins = User::whereIn('login', array_map('strtolower', $seenLogins))->pluck('login')->map(fn ($v) => mb_strtolower($v))->all();
        $existingEmails = User::whereIn('email', array_map('strtolower', $seenEmails))->pluck('email')->map(fn ($v) => mb_strtolower($v))->all();
        if (!empty($existingLogins) || !empty($existingEmails)) {
            return response()->json([
                'success' => false,
                'message' => 'Некоторые логины или email уже существуют в системе.',
                'conflicts' => [
                    'logins' => $existingLogins,
                    'emails' => $existingEmails,
                ],
            ], 422);
        }

        $createdStudents = [];
        $group = DB::transaction(function () use ($name, $status, $students, $sendCredentials, &$createdStudents) {
            $group = Group::create([
                'name' => $name,
                'status' => $status,
                'teacher_id' => null,
            ]);

            foreach ($students as $studentData) {
                $plainPassword = $this->generateTemporaryPassword();
                $student = User::create([
                    'login' => trim((string) $studentData['login']),
                    'email' => trim((string) $studentData['email']),
                    'password' => $plainPassword,
                    'last_name' => trim((string) $studentData['last_name']),
                    'first_name' => trim((string) $studentData['first_name']),
                    'middle_name' => !empty($studentData['middle_name']) ? trim((string) $studentData['middle_name']) : null,
                    'role' => 'student',
                    'group_id' => $group->id,
                    'department' => null,
                    'phone' => !empty($studentData['phone']) ? trim((string) $studentData['phone']) : null,
                    'is_active' => true,
                    'must_change_password' => true,
                    'theme' => 'system',
                ]);

                $this->syncNotificationSettings($student, [
                    'email' => true,
                    'push' => true,
                    'sms' => false,
                ]);

                if ($sendCredentials && !empty($student->email)) {
                    $this->sendCredentialsEmail($student, $plainPassword, true);
                }

                $createdStudents[] = $student->load(['studentGroup:id,name']);
            }

            return $group;
        });

        $this->log($request, 'create_group_with_students', "Создана группа {$group->name} и добавлено студентов: " . count($createdStudents));

        return response()->json([
            'success' => true,
            'group' => $group->loadCount('students'),
            'students' => $createdStudents,
        ], 201);
    }

    public function bulkAttachStudentsToGroup(Request $request, Group $group)
    {
        $validated = $request->validate([
            'student_ids' => ['nullable', 'array'],
            'student_ids.*' => ['integer', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'student'))],
            'students' => ['nullable', 'array'],
            'students.*.login' => ['required_with:students', 'string', 'min:6', 'max:30', 'regex:/^[a-zA-Z0-9_]+$/'],
            'students.*.email' => ['required_with:students', 'email', 'max:255'],
            'students.*.last_name' => ['required_with:students', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
            'students.*.first_name' => ['required_with:students', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
            'students.*.middle_name' => ['nullable', 'string', 'max:100', 'regex:/^[А-Яа-яЁё-]+$/u'],
            'students.*.phone' => ['nullable', 'string', 'regex:/^(\+7\s?\(?\d{3}\)?\s?\d{3}[- ]?\d{2}[- ]?\d{2}|8\(\d{3}\)\d{3}-\d{2}-\d{2})$/'],
            'send_credentials' => ['nullable', 'boolean'],
        ]);

        $studentIds = $validated['student_ids'] ?? [];
        $students = $validated['students'] ?? [];
        if (count($studentIds) === 0 && count($students) === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Передайте student_ids или students для добавления.',
            ], 422);
        }

        $sendCredentials = (bool) ($validated['send_credentials'] ?? true);
        $movedCount = 0;
        $createdStudents = [];

        DB::transaction(function () use ($group, $studentIds, $students, $sendCredentials, &$movedCount, &$createdStudents) {
            if (!empty($studentIds)) {
                $movedCount = User::where('role', 'student')
                    ->whereIn('id', $studentIds)
                    ->update(['group_id' => $group->id]);
            }

            foreach ($students as $studentData) {
                $plainPassword = $this->generateTemporaryPassword();
                $student = User::create([
                    'login' => trim((string) $studentData['login']),
                    'email' => trim((string) $studentData['email']),
                    'password' => $plainPassword,
                    'last_name' => trim((string) $studentData['last_name']),
                    'first_name' => trim((string) $studentData['first_name']),
                    'middle_name' => !empty($studentData['middle_name']) ? trim((string) $studentData['middle_name']) : null,
                    'role' => 'student',
                    'group_id' => $group->id,
                    'phone' => !empty($studentData['phone']) ? trim((string) $studentData['phone']) : null,
                    'is_active' => true,
                    'must_change_password' => true,
                    'theme' => 'system',
                ]);
                $this->syncNotificationSettings($student, [
                    'email' => true,
                    'push' => true,
                    'sms' => false,
                ]);
                if ($sendCredentials && !empty($student->email)) {
                    $this->sendCredentialsEmail($student, $plainPassword, true);
                }
                $createdStudents[] = $student->load(['studentGroup:id,name']);
            }
        });

        $this->log(
            $request,
            'bulk_attach_students_to_group',
            "В группу {$group->name} добавлено студентов: " . ($movedCount + count($createdStudents))
        );

        return response()->json([
            'success' => true,
            'moved_count' => $movedCount,
            'created_count' => count($createdStudents),
            'group' => $group->fresh()->loadCount('students'),
            'created_students' => $createdStudents,
        ]);
    }

    public function previewGroupsImport(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $rows = $this->parseCsvRows($request->file('file')->getRealPath());
        $analysis = $this->analyzeGroupRows($rows);

        return response()->json([
            'success' => true,
            'summary' => [
                'total_rows' => count($rows),
                'valid_rows' => count($analysis['valid_rows']),
                'error_rows' => count($analysis['errors']),
            ],
            'rows' => $analysis['rows'],
            'valid_rows' => $analysis['valid_rows'],
        ]);
    }

    public function importGroups(Request $request)
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['array'],
            'mode' => ['nullable', 'in:strict,partial'],
        ]);

        $mode = $validated['mode'] ?? 'strict';
        $analysis = $this->analyzeGroupRows($validated['rows']);
        if ($mode === 'strict' && count($analysis['errors']) > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Импорт остановлен: в файле есть ошибки.',
                'summary' => [
                    'total_rows' => count($validated['rows']),
                    'valid_rows' => count($analysis['valid_rows']),
                    'error_rows' => count($analysis['errors']),
                ],
                'rows' => $analysis['rows'],
            ], 422);
        }

        $created = 0;
        foreach ($analysis['valid_rows'] as $row) {
            Group::firstOrCreate(
                ['name' => trim((string) $row['name'])],
                [
                    'teacher_id' => null,
                    'status' => $row['status'] ?? 'active',
                ]
            );
            $created++;
        }

        $this->log($request, 'import_groups', "Массовый импорт групп: создано {$created}");

        return response()->json([
            'success' => true,
            'summary' => [
                'total_rows' => count($validated['rows']),
                'created' => $created,
                'error_rows' => count($analysis['errors']),
            ],
            'rows' => $analysis['rows'],
        ]);
    }

    public function deleteGroup(Request $request, Group $group)
    {
        $group = $group->loadCount(['students', 'assignments']);

        if ($group->students_count > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Нельзя удалить группу, пока в ней есть студенты.',
            ], 422);
        }

        if ($group->assignments_count > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Нельзя удалить группу, пока она привязана к заданиям.',
            ], 422);
        }

        $groupName = $group->name;
        $group->delete();

        $this->log($request, 'delete_group', "Удалена группа {$groupName}");

        return response()->json(['success' => true]);
    }

    // --- Subjects ---

    public function subjects()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
            'teacher_id' => ['nullable', 'integer', 'exists:users,id'],
            'sort' => ['nullable', 'in:name_asc,name_desc,newest,oldest'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Subject::with('teacher:id,login,last_name,first_name,middle_name');

        if (!empty($validated['search'])) {
            $query->where('name', 'like', '%' . trim((string) $validated['search']) . '%');
        }

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (!empty($validated['teacher_id'])) {
            $query->where('teacher_id', (int) $validated['teacher_id']);
        }

        $sort = $validated['sort'] ?? 'name_asc';
        switch ($sort) {
            case 'name_desc':
                $query->orderByDesc('name');
                break;
            case 'newest':
                $query->orderByDesc('created_at');
                break;
            case 'oldest':
                $query->orderBy('created_at');
                break;
            case 'name_asc':
            default:
                $query->orderBy('name');
                break;
        }

        $perPage = (int) ($validated['per_page'] ?? self::SUBJECTS_PER_PAGE);
        $subjects = $query->paginate($perPage)->withQueryString();

        return response()->json([
            'data' => $subjects->items(),
            'meta' => [
                'current_page' => $subjects->currentPage(),
                'last_page' => $subjects->lastPage(),
                'per_page' => $subjects->perPage(),
                'total' => $subjects->total(),
            ],
        ]);
    }

    public function createSubject(Request $request)
    {
        $validated = $request->validate(
            [
                'name' => ['required', 'string', 'min:2', 'max:255'],
                'teacher_id' => ['nullable', 'exists:users,id'],
                'status' => ['nullable', 'in:active,inactive'],
            ],
            [
                'name.required' => 'Введите название предмета.',
                'name.min' => 'Название предмета должно содержать минимум 2 символа.',
                'teacher_id.exists' => 'Выбранный преподаватель не найден.',
            ]
        );

        $subject = Subject::create([
            ...$validated,
            'status' => $validated['status'] ?? 'active',
        ]);

        $this->log($request, 'create_subject', "Создан предмет {$subject->name}");

        return response()->json(['success' => true, 'subject' => $subject->load('teacher:id,login,last_name,first_name,middle_name')], 201);
    }

    public function updateSubject(Request $request, Subject $subject)
    {
        $validated = $request->validate(
            [
                'name' => ['sometimes', 'required', 'string', 'min:2', 'max:255'],
                'teacher_id' => ['nullable', 'exists:users,id'],
                'status' => ['nullable', 'in:active,inactive'],
            ],
            [
                'name.required' => 'Введите название предмета.',
                'name.min' => 'Название предмета должно содержать минимум 2 символа.',
                'teacher_id.exists' => 'Выбранный преподаватель не найден.',
            ]
        );

        $subject->update($validated);

        $this->log($request, 'update_subject', "Изменен предмет {$subject->name}");

        return response()->json(['success' => true, 'subject' => $subject->fresh()->load('teacher:id,login,last_name,first_name,middle_name')]);
    }

    public function deleteSubject(Request $request, Subject $subject)
    {
        $name = $subject->name;
        $subject->delete();

        $this->log($request, 'delete_subject', "Удален предмет {$name}");

        return response()->json(['success' => true]);
    }

    public function previewSubjectsImport(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $rows = $this->parseCsvRows($request->file('file')->getRealPath());
        $analysis = $this->analyzeSubjectRows($rows);

        return response()->json([
            'success' => true,
            'summary' => [
                'total_rows' => count($rows),
                'valid_rows' => count($analysis['valid_rows']),
                'error_rows' => count($analysis['errors']),
            ],
            'rows' => $analysis['rows'],
            'valid_rows' => $analysis['valid_rows'],
        ]);
    }

    public function importSubjects(Request $request)
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['array'],
            'mode' => ['nullable', 'in:strict,partial'],
        ]);

        $mode = $validated['mode'] ?? 'strict';
        $analysis = $this->analyzeSubjectRows($validated['rows']);
        if ($mode === 'strict' && count($analysis['errors']) > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Импорт остановлен: в файле есть ошибки.',
                'summary' => [
                    'total_rows' => count($validated['rows']),
                    'valid_rows' => count($analysis['valid_rows']),
                    'error_rows' => count($analysis['errors']),
                ],
                'rows' => $analysis['rows'],
            ], 422);
        }

        $created = 0;
        foreach ($analysis['valid_rows'] as $row) {
            $teacherId = null;
            if (!empty($row['teacher_id'])) {
                $teacherId = (int) $row['teacher_id'];
            } elseif (!empty($row['teacher_login'])) {
                $teacherId = User::where('role', 'teacher')
                    ->whereRaw('LOWER(login) = ?', [mb_strtolower(trim((string) $row['teacher_login']))])
                    ->value('id');
            } elseif (!empty($row['teacher_email'])) {
                $teacherId = User::where('role', 'teacher')
                    ->whereRaw('LOWER(email) = ?', [mb_strtolower(trim((string) $row['teacher_email']))])
                    ->value('id');
            }

            Subject::firstOrCreate(
                ['name' => trim((string) $row['name'])],
                [
                    'teacher_id' => $teacherId,
                    'status' => $row['status'] ?? 'active',
                ]
            );
            $created++;
        }

        $this->log($request, 'import_subjects', "Массовый импорт предметов: создано {$created}");

        return response()->json([
            'success' => true,
            'summary' => [
                'total_rows' => count($validated['rows']),
                'created' => $created,
                'error_rows' => count($analysis['errors']),
            ],
            'rows' => $analysis['rows'],
        ]);
    }

    // --- Logs ---

    public function logs()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'action' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'in:student,teacher,admin,system'],
            'period' => ['nullable', 'in:all,today,week,month'],
            'sort' => ['nullable', 'in:newest,oldest'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = SystemLog::with('user:id,login,role,last_name,first_name,middle_name');

        if (!empty($validated['action']) && $validated['action'] !== 'all') {
            $query->where('action', 'like', '%' . trim((string) $validated['action']) . '%');
        }

        if (!empty($validated['role']) && $validated['role'] !== 'system') {
            $query->whereHas('user', fn ($userQuery) => $userQuery->where('role', $validated['role']));
        } elseif (($validated['role'] ?? null) === 'system') {
            $query->whereNull('user_id');
        }

        if (!empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(function ($builder) use ($term) {
                $builder
                    ->where('action', 'like', "%{$term}%")
                    ->orWhere('details', 'like', "%{$term}%")
                    ->orWhereHas('user', function ($userQuery) use ($term) {
                        $userQuery
                            ->where('login', 'like', "%{$term}%")
                            ->orWhere('last_name', 'like', "%{$term}%")
                            ->orWhere('first_name', 'like', "%{$term}%")
                            ->orWhere('middle_name', 'like', "%{$term}%");
                    });
            });
        }

        $period = $validated['period'] ?? 'all';
        if ($period !== 'all') {
            $from = now();
            if ($period === 'today') {
                $from = now()->startOfDay();
            } elseif ($period === 'week') {
                $from = now()->subDays(7);
            } elseif ($period === 'month') {
                $from = now()->subMonth();
            }
            $query->where('created_at', '>=', $from);
        }

        if (($validated['sort'] ?? 'newest') === 'oldest') {
            $query->oldest('created_at');
        } else {
            $query->latest('created_at');
        }

        $perPage = (int) ($validated['per_page'] ?? self::LOGS_PER_PAGE);
        $logs = $query->paginate($perPage)->withQueryString();

        $items = collect($logs->items())
            ->map(fn($log) => [
                'id' => $log->id,
                'timestamp' => $log->created_at,
                'user' => $log->user?->full_name ?: ($log->user?->login ?? 'Система'),
                'user_role' => $log->user?->role ?? 'system',
                'action' => $log->action,
                'details' => $log->details,
            ]);

        return response()->json([
            'data' => $items->values(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    private function log(Request $request, string $action, string $details): void
    {
        $user = $request->user();
        SystemLog::create([
            'user_id' => $user->id,
            'action' => $action,
            'details' => $details,
        ]);
    }

    private function syncNotificationSettings(User $user, array $notifications): void
    {
        $channels = ['email', 'push', 'sms'];
        foreach ($channels as $channel) {
            $user->notificationSettings()->updateOrCreate(
                ['channel' => $channel],
                ['enabled' => (bool) ($notifications[$channel] ?? false)]
            );
        }
    }

    private function parseCsvRows(string $path): array
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

        $delimiter = substr_count($firstLine, ';') > substr_count($firstLine, ',') ? ';' : ',';
        rewind($handle);

        $headers = fgetcsv($handle, 0, $delimiter) ?: [];
        $headers = array_map(function ($header) {
            $normalized = trim((string) $header);
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

    private function analyzeGroupRows(array $rows): array
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
            $rowErrors = [];

            if ($name === '') {
                $rowErrors[] = 'Введите название группы.';
            } elseif (!preg_match('/^[А-ЯЁA-Z0-9-]+$/iu', $name)) {
                $rowErrors[] = 'Группа может содержать только буквы, цифры и дефис.';
            }

            if (!in_array($status, ['active', 'inactive'], true)) {
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

    private function analyzeSubjectRows(array $rows): array
    {
        $preparedRows = [];
        $validRows = [];
        $errors = [];
        $seenNames = [];

        foreach ($rows as $entry) {
            $rowNumber = (int) ($entry['row'] ?? 0);
            $data = is_array($entry['data'] ?? null) ? $entry['data'] : (is_array($entry) ? $entry : []);
            $name = trim((string) ($data['name'] ?? ''));
            $status = trim((string) ($data['status'] ?? 'active'));
            $teacherLogin = trim((string) ($data['teacher_login'] ?? ''));
            $teacherEmail = trim((string) ($data['teacher_email'] ?? ''));
            $teacherId = trim((string) ($data['teacher_id'] ?? ''));
            $rowErrors = [];

            if ($name === '') {
                $rowErrors[] = 'Введите название предмета.';
            } elseif (mb_strlen($name) < 2) {
                $rowErrors[] = 'Название предмета должно содержать минимум 2 символа.';
            }

            if (!in_array($status, ['active', 'inactive'], true)) {
                $rowErrors[] = 'Статус предмета должен быть active или inactive.';
            }

            if ($name !== '') {
                if (in_array(mb_strtolower($name), $seenNames, true)) {
                    $rowErrors[] = 'Название предмета дублируется в импортируемом файле.';
                } else {
                    $seenNames[] = mb_strtolower($name);
                }

                $exists = Subject::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->exists();
                if ($exists) {
                    $rowErrors[] = 'Предмет с таким названием уже существует.';
                }
            }

            if ($teacherId !== '' && !ctype_digit($teacherId)) {
                $rowErrors[] = 'teacher_id должен быть числом.';
            }

            if ($teacherId !== '') {
                $teacherExists = User::where('role', 'teacher')->where('id', (int) $teacherId)->exists();
                if (!$teacherExists) {
                    $rowErrors[] = 'Преподаватель с таким teacher_id не найден.';
                }
            } elseif ($teacherLogin !== '') {
                $teacherExists = User::where('role', 'teacher')
                    ->whereRaw('LOWER(login) = ?', [mb_strtolower($teacherLogin)])
                    ->exists();
                if (!$teacherExists) {
                    $rowErrors[] = 'Преподаватель с таким teacher_login не найден.';
                }
            } elseif ($teacherEmail !== '') {
                $teacherExists = User::where('role', 'teacher')
                    ->whereRaw('LOWER(email) = ?', [mb_strtolower($teacherEmail)])
                    ->exists();
                if (!$teacherExists) {
                    $rowErrors[] = 'Преподаватель с таким teacher_email не найден.';
                }
            }

            $normalized = [
                'name' => $name,
                'status' => $status ?: 'active',
                'teacher_id' => $teacherId !== '' ? (int) $teacherId : null,
                'teacher_login' => $teacherLogin !== '' ? $teacherLogin : null,
                'teacher_email' => $teacherEmail !== '' ? $teacherEmail : null,
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

    private function parseUsersCsv(string $path): array
    {
        return $this->parseCsvRows($path);
    }

    private function analyzeImportRows(array $rows): array
    {
        $preparedRows = [];
        $validRows = [];
        $errors = [];
        $seenLogins = [];
        $seenEmails = [];

        foreach ($rows as $entry) {
            $rowNumber = (int) ($entry['row'] ?? 0);
            $data = is_array($entry['data'] ?? null) ? $entry['data'] : (is_array($entry) ? $entry : []);

            if (array_key_exists('patronymic', $data) && !array_key_exists('middle_name', $data)) {
                $data['middle_name'] = $data['patronymic'];
            }

            $validator = Validator::make(
                $data,
                [
                    'login' => ['required', 'string', 'min:6', 'max:30', 'regex:/^[a-zA-Z0-9_]+$/', 'unique:users,login'],
                    'email' => ['required', 'email', 'max:255', 'unique:users,email'],
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
                    'login.required' => 'Введите логин.',
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

            $normalizedLogin = mb_strtolower(trim((string) ($data['login'] ?? '')));
            $normalizedEmail = mb_strtolower(trim((string) ($data['email'] ?? '')));

            if (($data['role'] ?? null) === 'student' && empty($data['group']) && empty($data['group_id'])) {
                $rowErrors[] = 'Для роли "student" укажите учебную группу.';
            }

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

    private function generateTemporaryPassword(int $length = 12): string
    {
        $length = max(8, $length);
        $random = Str::random($length - 3);
        return 'Aa1' . $random;
    }

    private function sendCredentialsEmail(User $user, string $plainPassword, bool $temporary = true): void
    {
        try {
            $subject = 'Доступ к системе контроля учебных работ';
            $temporaryLine = $temporary
                ? "Это временный пароль, после входа обязательно смените его в профиле.\n"
                : '';

            $message = "Здравствуйте, {$user->full_name}!\n\n"
                . "Для вас создан аккаунт в системе.\n"
                . "Логин: {$user->login}\n"
                . "Пароль: {$plainPassword}\n\n"
                . $temporaryLine
                . "Вход: " . config('app.url') . "\n";

            Mail::raw($message, function ($mail) use ($user, $subject) {
                $mail->to($user->email)->subject($subject);
            });
        } catch (Throwable) {
            // Ошибки почты не должны прерывать создание пользователя.
        }
    }

}
