<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\LogsAdminActions;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Group;
use App\Models\Submission;
use App\Models\TeachingLoad;
use App\Models\User;
use App\Services\Admin\AdminCsvImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Админ: группы (CRUD, статусы, привязка куратора и студентов, импорт состава из CSV).
 */
class GroupController extends Controller
{
    use LogsAdminActions;

    private const GROUPS_PER_PAGE = 20;

    public function __construct(
        private readonly AdminCsvImportService $csvImport,
    ) {}

    public function groups()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
            'specialty' => ['nullable', 'string', 'max:150'],
            'sort' => ['nullable', 'in:name_asc,name_desc,students_desc,students_asc,newest,oldest'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Group::withCount(['students']);

        if (!empty($validated['search'])) {
            $query->where('name', 'like', '%' . trim((string) $validated['search']) . '%');
        }

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (array_key_exists('specialty', $validated) && $validated['specialty'] !== null && $validated['specialty'] !== '') {
            $query->where('specialty', trim((string) $validated['specialty']));
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

        $ids = $groups->getCollection()->pluck('id');
        $teacherCounts = TeachingLoad::query()
            ->selectRaw('group_id, COUNT(DISTINCT teacher_id) as cnt')
            ->where('status', 'active')
            ->whereIn('group_id', $ids)
            ->groupBy('group_id')
            ->pluck('cnt', 'group_id');

        foreach ($groups->items() as $group) {
            $group->teachers_count = (int) ($teacherCounts[$group->id] ?? 0);
        }

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

    public function showGroup(Group $group)
    {
        $group->loadCount(['students']);

        $teachersCount = (int) TeachingLoad::query()
            ->where('group_id', $group->id)
            ->where('status', 'active')
            ->distinct()
            ->count('teacher_id');

        $students = User::query()
            ->where('group_id', $group->id)
            ->where('role', 'student')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'last_name', 'first_name', 'middle_name']);

        $studentIds = $students->pluck('id');

        $avgScores = $studentIds->isEmpty()
            ? collect()
            : Submission::query()
                ->selectRaw('student_id, AVG(score) as avg_score')
                ->whereIn('student_id', $studentIds)
                ->where('status', 'graded')
                ->whereNotNull('score')
                ->groupBy('student_id')
                ->pluck('avg_score', 'student_id');

        $overdueAssignmentIds = Assignment::query()
            ->where('status', 'active')
            ->whereDate('deadline', '<', now()->toDateString())
            ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id))
            ->pluck('id');

        $latestStatusByKey = [];
        if ($overdueAssignmentIds->isNotEmpty() && $studentIds->isNotEmpty()) {
            $rows = Submission::query()
                ->whereIn('assignment_id', $overdueAssignmentIds)
                ->whereIn('student_id', $studentIds)
                ->orderByDesc('submitted_at')
                ->orderByDesc('id')
                ->get(['assignment_id', 'student_id', 'status']);
            foreach ($rows as $row) {
                $key = $row->assignment_id . ':' . $row->student_id;
                if (!array_key_exists($key, $latestStatusByKey)) {
                    $latestStatusByKey[$key] = $row->status;
                }
            }
        }

        $studentPayload = $students->map(function (User $u) use ($avgScores, $overdueAssignmentIds, $latestStatusByKey) {
            $overdue = 0;
            foreach ($overdueAssignmentIds as $aid) {
                $key = $aid . ':' . $u->id;
                $st = $latestStatusByKey[$key] ?? null;
                if ($st !== 'graded') {
                    $overdue++;
                }
            }
            $avg = $avgScores[$u->id] ?? null;

            return [
                'id' => $u->id,
                'last_name' => $u->last_name,
                'first_name' => $u->first_name,
                'middle_name' => $u->middle_name,
                'avg_score' => $avg !== null ? round((float) $avg, 1) : null,
                'overdue_assignments' => $overdue,
            ];
        })->values()->all();

        $loads = TeachingLoad::query()
            ->where('group_id', $group->id)
            ->where('status', 'active')
            ->with(['teacher', 'subject'])
            ->get();

        $subjectBlocks = $loads->map(function (TeachingLoad $tl) use ($group) {
            $activeCount = Assignment::query()
                ->where('teacher_id', $tl->teacher_id)
                ->where('subject_id', $tl->subject_id)
                ->where('status', 'active')
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id))
                ->count();

            return [
                'subject' => $tl->subject
                    ? [
                        'id' => $tl->subject->id,
                        'name' => $tl->subject->name,
                    ]
                    : null,
                'teacher' => $tl->teacher
                    ? [
                        'id' => $tl->teacher->id,
                        'last_name' => $tl->teacher->last_name,
                        'first_name' => $tl->teacher->first_name,
                        'middle_name' => $tl->teacher->middle_name,
                    ]
                    : null,
                'active_assignments_count' => $activeCount,
            ];
        })->values()->all();

        return response()->json([
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
                'specialty' => $group->specialty,
                'status' => $group->status,
                'created_at' => optional($group->created_at)->toISOString(),
                'students_count' => (int) $group->students_count,
                'teachers_count' => (int) $teachersCount,
            ],
            'students' => $studentPayload,
            'subject_blocks' => $subjectBlocks,
        ]);
    }

    public function updateGroup(Request $request, Group $group)
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
            'specialty' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', 'in:active,inactive'],
        ], [
            'name.regex' => 'Группа может содержать только буквы, цифры и дефис.',
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

        if (array_key_exists('specialty', $validated) && $validated['specialty'] !== null) {
            $validated['specialty'] = trim((string) $validated['specialty']) ?: null;
        }

        $statusClosing = array_key_exists('status', $validated) && $validated['status'] === 'inactive';

        $group->update($validated);

        if ($statusClosing) {
            TeachingLoad::where('group_id', $group->id)->update(['status' => 'inactive']);
        }

        $freshGroup = $group->fresh()->loadCount('students');
        $freshGroup->teachers_count = (int) TeachingLoad::query()
            ->where('group_id', $freshGroup->id)
            ->where('status', 'active')
            ->distinct()
            ->count('teacher_id');

        $this->log($request, 'update_group', "Группа {$freshGroup->name}: статус {$freshGroup->status}");

        return response()->json([
            'success' => true,
            'group' => $freshGroup,
        ]);
    }

    public function createGroup(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
            'specialty' => ['required', 'string', 'max:150'],
            'status' => ['nullable', 'in:active,inactive'],
        ], [
            'name.required' => 'Введите название группы.',
            'name.regex' => 'Группа может содержать только буквы, цифры и дефис.',
            'specialty.required' => 'Укажите специальность.',
            'status.in' => 'Некорректный статус группы.',
        ]);

        $name = trim((string) $validated['name']);
        $specialty = trim((string) $validated['specialty']);
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
            'specialty' => $specialty,
            'status' => $status,
        ]);

        $this->log($request, 'create_group', "Создана группа {$group->name}");

        $out = $group->loadCount('students');
        $out->teachers_count = 0;

        return response()->json([
            'success' => true,
            'group' => $out,
        ], 201);
    }

    public function createGroupWithStudents(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
            'specialty' => ['required', 'string', 'max:150'],
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
        $specialty = trim((string) $validated['specialty']);
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
        $group = DB::transaction(function () use ($name, $specialty, $status, $students, $sendCredentials, &$createdStudents) {
            $group = Group::create([
                'name' => $name,
                'specialty' => $specialty,
                'status' => $status,
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
                    'email_notifications_enabled' => true,
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
                    'email_notifications_enabled' => true,
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

        $rows = $this->csvImport->parseFile($request->file('file')->getRealPath());
        $analysis = $this->csvImport->analyzeGroupRows($rows);

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
        $analysis = $this->csvImport->analyzeGroupRows($validated['rows']);
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
                    'status' => $row['status'] ?? 'active',
                    'specialty' => $row['specialty'] ?? null,
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
}
