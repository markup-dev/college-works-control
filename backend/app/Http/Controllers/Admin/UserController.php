<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\LogsAdminActions;
use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\Submission;
use App\Models\User;
use App\Services\Admin\AdminCsvImportService;
use App\Services\UserLoginAllocator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Админ: список пользователей, создание/редактирование, блокировка, массовый импорт CSV, выдача учётных данных.
 */
class UserController extends Controller
{
    use LogsAdminActions;

    private const USERS_PER_PAGE = 20;

    public function __construct(
        private readonly UserLoginAllocator $loginAllocator,
        private readonly AdminCsvImportService $csvImport,
    ) {}

    public function users()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'in:student,teacher,admin'],
            'status' => ['nullable', 'in:active,inactive'],
            'account_status' => ['nullable', 'in:active,must_change_password,blocked'],
            'without_group' => ['nullable', 'boolean'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'sort' => ['nullable', 'in:newest,oldest,name_asc,name_desc,last_login_desc,last_login_asc'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::with([
            'studentGroup:id,name',
            'teachingLoads' => fn ($q) => $q->where('status', 'active')->with('group:id,name'),
        ])
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

        if (!empty($validated['account_status'])) {
            match ($validated['account_status']) {
                'active' => $query->where('is_active', true)->where('must_change_password', false),
                'must_change_password' => $query->where('is_active', true)->where('must_change_password', true),
                'blocked' => $query->where('is_active', false),
                default => null,
            };
        } elseif (!empty($validated['status'])) {
            $query->where('is_active', $validated['status'] === 'active');
        }

        if (!empty($validated['without_group'])) {
            $query->whereNull('group_id');
        } elseif (!empty($validated['group_id'])) {
            $query->where('group_id', (int) $validated['group_id']);
        }

        if (!empty($validated['subject_id'])) {
            $subjectId = (int) $validated['subject_id'];
            $query->where(function ($builder) use ($subjectId) {
                $builder
                    ->where(function ($students) use ($subjectId) {
                        $students->where('role', 'student')
                            ->whereIn('group_id', function ($sub) use ($subjectId) {
                                $sub->select('group_id')
                                    ->from('teaching_loads')
                                    ->where('subject_id', $subjectId)
                                    ->where('status', 'active');
                            });
                    })
                    ->orWhere(function ($teachers) use ($subjectId) {
                        $teachers->where('role', 'teacher')
                            ->whereHas('teachingLoads', fn ($loadQuery) => $loadQuery
                                ->where('subject_id', $subjectId)
                                ->where('status', 'active'));
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

        $items = $users->getCollection();
        $warnings = $this->adminUserCardWarningsForPage($items);

        $items->each(function (User $user) use ($warnings) {
            if ($user->role === 'teacher') {
                $names = $user->teachingLoads
                    ->pluck('group.name')
                    ->filter()
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();
                $user->setAttribute('teacher_groups', $names);
            } else {
                $user->setAttribute('teacher_groups', []);
            }
            $user->setAttribute('admin_warnings', $warnings[$user->id] ?? []);
            $user->unsetRelation('teachingLoads');
        });

        return response()->json([
            'data' => $items->values()->all(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * Предупреждения для карточек админки (страница списка пользователей).
     *
     * @param  \Illuminate\Support\Collection<int, User>  $users
     * @return array<int, list<array{key: string, text: string}>>
     */
    private function adminUserCardWarningsForPage($users): array
    {
        $byUser = [];
        $students = $users->where('role', 'student');
        $teachers = $users->where('role', 'teacher');
        $studentIds = $students->pluck('id')->all();
        $teacherIds = $teachers->pluck('id')->all();

        if ($studentIds !== []) {
            $recent = Submission::query()
                ->whereIn('student_id', $studentIds)
                ->whereNotNull('submitted_at')
                ->where('submitted_at', '>=', now()->subDays(7))
                ->selectRaw('student_id, count(*) as c')
                ->groupBy('student_id')
                ->pluck('c', 'student_id');

            foreach ($studentIds as $sid) {
                $student = $students->firstWhere('id', $sid);
                if (! $student || ! $student->group_id) {
                    continue;
                }
                if ((int) ($recent[$sid] ?? 0) === 0) {
                    $byUser[$sid][] = ['key' => 'no_submissions_week', 'text' => '0 сдач (7 дн.)'];
                }
            }

            $overdueRows = DB::table('users as u')
                ->join('assignment_group as ag', 'u.group_id', '=', 'ag.group_id')
                ->join('assignments as a', function ($join) {
                    $join->on('a.id', '=', 'ag.assignment_id')
                        ->where('a.status', '=', 'active')
                        ->whereDate('a.deadline', '<', now()->toDateString());
                })
                ->leftJoin('submissions as s', function ($join) {
                    $join->on('s.assignment_id', '=', 'a.id')
                        ->on('s.student_id', '=', 'u.id')
                        ->where('s.status', '=', 'graded');
                })
                ->whereIn('u.id', $studentIds)
                ->where('u.role', '=', 'student')
                ->whereNull('s.id')
                ->groupBy('u.id')
                ->selectRaw('u.id as student_id, COUNT(DISTINCT a.id) as c')
                ->get();

            foreach ($overdueRows as $row) {
                $c = (int) $row->c;
                if ($c > 0) {
                    $sid = (int) $row->student_id;
                    $byUser[$sid][] = [
                        'key' => 'overdue_assignments',
                        'text' => $c === 1 ? '1 дедлайн просрочен' : "{$c} дедлайнов просрочено",
                    ];
                }
            }
        }

        if ($teacherIds !== []) {
            $stale = Submission::query()
                ->join('assignments', 'submissions.assignment_id', '=', 'assignments.id')
                ->whereIn('assignments.teacher_id', $teacherIds)
                ->where('submissions.status', 'submitted')
                ->whereNotNull('submissions.submitted_at')
                ->where('submissions.submitted_at', '<=', now()->subDays(3))
                ->selectRaw('assignments.teacher_id as teacher_id, COUNT(*) as c')
                ->groupBy('assignments.teacher_id')
                ->pluck('c', 'teacher_id');

            foreach ($teacherIds as $tid) {
                $c = (int) ($stale[$tid] ?? 0);
                if ($c > 0) {
                    $byUser[$tid][] = [
                        'key' => 'stale_reviews',
                        'text' => $c === 1
                            ? '1 работа без проверки > 3 дн.'
                            : "{$c} работ без проверки > 3 дн.",
                    ];
                }
            }
        }

        return $byUser;
    }

    public function createUser(Request $request)
    {
        if ($request->filled('patronymic') && !$request->has('middle_name')) {
            $request->merge(['middle_name' => $request->input('patronymic')]);
        }

        $validated = $request->validate(
            [
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

        if ($validated['role'] === 'student' && empty($validated['group_id']) && empty($validated['group'])) {
            throw ValidationException::withMessages([
                'group_id' => ['Выберите группу для студента.'],
            ]);
        }

        $login = $this->loginAllocator->allocateFromNames(
            trim($validated['last_name']),
            trim($validated['first_name']),
            !empty($validated['middle_name']) ? trim($validated['middle_name']) : '',
        );

        // Для ручного создания админом: временный пароль; отправка на почту по флагу.
        $sendCredentials = (bool) $request->boolean('send_credentials', true);
        $plainPassword = $this->generateTemporaryPassword();
        $isTemporaryPassword = true;

        $groupId = null;
        if ($validated['role'] === 'student' && !empty($validated['group_id'])) {
            $groupId = (int) $validated['group_id'];
        } elseif ($validated['role'] === 'student' && !empty($validated['group'])) {
            $group = Group::firstOrCreate(
                ['name' => trim($validated['group'])],
                ['status' => 'active']
            );
            $groupId = $group->id;
        }

        unset($validated['group']);
        unset($validated['generate_password'], $validated['send_credentials'], $validated['password']);

        $user = User::create([
            ...$validated,
            'login' => $login,
            'password' => $plainPassword,
            'last_name' => trim($validated['last_name']),
            'first_name' => trim($validated['first_name']),
            'middle_name' => !empty($validated['middle_name']) ? trim($validated['middle_name']) : null,
            'group_id' => $groupId,
            'is_active' => true,
            'must_change_password' => $isTemporaryPassword,
            'email_notifications_enabled' => true,
        ]);
        $user->unsetRelation('studentGroup');

        $this->log($request, 'create_user', "Создан пользователь {$user->full_name}");

        if ($sendCredentials && !empty($user->email)) {
            $this->sendCredentialsEmail($user, $plainPassword, true);
        }

        return response()->json([
            'success' => true,
            'user' => $user->load(['studentGroup']),
            'plain_password' => $plainPassword,
            'credentials_sent' => $sendCredentials && !empty($user->email),
        ], 201);
    }

    public function resetUserCredentials(Request $request, User $user)
    {
        $validated = $request->validate([
            'send_credentials' => ['nullable', 'boolean'],
        ]);

        $sendCredentials = (bool) ($validated['send_credentials'] ?? true);
        $plainPassword = $this->generateTemporaryPassword();

        $user->password = $plainPassword;
        $user->must_change_password = true;
        $user->save();
        $user->unsetRelation('studentGroup');

        $this->log($request, 'reset_user_credentials', "Сброшен пароль пользователя {$user->full_name}");

        if ($sendCredentials && !empty($user->email)) {
            $this->sendCredentialsEmail($user, $plainPassword, true);
        }

        return response()->json([
            'success' => true,
            'user' => $user->fresh()->load(['studentGroup']),
            'plain_password' => $plainPassword,
            'credentials_sent' => $sendCredentials && !empty($user->email),
        ]);
    }

    public function updateUser(Request $request, User $user)
    {
        if ($request->filled('patronymic') && !$request->has('middle_name')) {
            $request->merge(['middle_name' => $request->input('patronymic')]);
        }

        $validated = $request->validate(
            [
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
                'is_active' => ['sometimes', 'boolean'],
            ],
            [
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
                    $existing = Group::where('name', $groupName)->orderBy('id')->first();
                    $group = $existing ?? Group::firstOrCreate(
                        ['name' => $groupName],
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

        $roleAfter = $validated['role'] ?? $user->role;
        $groupIdAfter = array_key_exists('group_id', $validated)
            ? $validated['group_id']
            : $user->group_id;
        if ($roleAfter === 'student' && empty($groupIdAfter)) {
            throw ValidationException::withMessages([
                'group_id' => ['Выберите группу для студента.'],
            ]);
        }

        $user->update($validated);

        $this->log($request, 'update_user', "Изменены данные пользователя {$user->full_name}");

        return response()->json(['success' => true, 'user' => $user->fresh()->load(['studentGroup'])]);
    }

    public function deleteUser(Request $request, User $user)
    {
        if ((int) $request->user()->id === (int) $user->id) {
            return response()->json([
                'message' => 'Нельзя удалить собственную учётную запись.',
            ], 422);
        }

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

        $rows = $this->csvImport->parseFile($request->file('file')->getRealPath());
        $analysis = $this->csvImport->analyzeUserImportRows($rows, $this->loginAllocator);

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

        $analysis = $this->csvImport->analyzeUserImportRows($rows, $this->loginAllocator);
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
                        ['name' => trim($prepared['group'])],
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
                'email_notifications_enabled' => true,
            ]);

            if ($sendCredentials && !empty($user->email)) {
                $this->sendCredentialsEmail($user, $plainPassword, true);
            }

            $created++;
            $createdUsers[] = $user->load(['studentGroup']);
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

    private function generateTemporaryPassword(int $length = 12): string
    {
        $length = max(8, $length);
        $random = Str::random($length - 3);
        return 'Aa1' . $random;
    }

    private function sendCredentialsEmail(User $user, string $plainPassword, bool $temporary = true): void
    {
        try {
            $user->loadMissing('studentGroup:id,name');
            $mailData = SystemSettingsService::renderCredentialsMail($user, $plainPassword, $temporary);
            $subject = $mailData['subject'];
            $body = $mailData['body'];
            $fromName = $mailData['from_name'];
            $addr = config('mail.from.address');

            Mail::raw($body, function ($mail) use ($user, $subject, $fromName, $addr) {
                $mail->to($user->email)->subject($subject ?? 'Доступ к платформе');
                if ($addr && $fromName) {
                    $mail->from($addr, $fromName);
                }
            });
        } catch (Throwable) {
            // Ошибки почты не должны прерывать создание пользователя.
        }
    }
}
