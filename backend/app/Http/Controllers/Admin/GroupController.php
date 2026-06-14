<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\LogsAdminActions;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Group;
use App\Models\GroupSubject;
use App\Models\Submission;
use App\Models\Specialty;
use App\Models\TeachingLoad;
use App\Models\User;
use App\Services\Admin\AdminCsvImportService;
use App\Services\AcademicProgramService;
use App\Services\AdminActionNotificationService;
use App\Support\AdminLogMessages;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Админ: группы (CRUD, статусы, привязка куратора и студентов, импорт состава из CSV).
 */
class GroupController extends Controller
{
    use LogsAdminActions;

    private const GROUPS_PER_PAGE = 18;

    public function __construct(
        private readonly AdminCsvImportService $csvImport,
        private readonly AcademicProgramService $programs,
    ) {}

    public function groups()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
            'specialty' => ['nullable', 'string', 'max:150'],
            'specialty_id' => ['nullable', 'integer', 'exists:specialties,id'],
            'course' => ['nullable', 'integer', 'min:1', 'max:6'],
            'sort' => ['nullable', 'in:name_asc,name_desc,students_desc,students_asc,newest,oldest'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Group::with(['specialtyRef:id,code,name,study_years,status'])->withCount(['students']);

        if (!empty($validated['search'])) {
            $query->where('name', 'like', '%' . trim((string) $validated['search']) . '%');
        }

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (array_key_exists('specialty', $validated) && $validated['specialty'] !== null && $validated['specialty'] !== '') {
            $query->whereRaw('TRIM(specialty) = ?', [trim((string) $validated['specialty'])]);
        }
        if (! empty($validated['specialty_id'])) {
            $query->where('specialty_id', (int) $validated['specialty_id']);
        }
        if (! empty($validated['course'])) {
            $query->where('current_course', (int) $validated['course']);
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

    public function specialties()
    {
        $specialties = Specialty::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'study_years']);

        return response()->json(['data' => $specialties]);
    }

    public function showGroup(Group $group)
    {
        $group->load(['specialtyRef:id,code,name,study_years']);
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

        $curriculum = GroupSubject::query()
            ->where('group_id', $group->id)
            ->with('subject:id,name,code,status')
            ->orderBy('course')
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->groupBy('course')
            ->map(fn ($items) => $items->values())
            ->values()
            ->all();

        $subjectBlocks = $loads->map(function (TeachingLoad $tl) use ($group) {
            $base = Assignment::query()
                ->where('teacher_id', $tl->teacher_id)
                ->where('subject_id', $tl->subject_id)
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id));

            $assignmentsTotal = (clone $base)->count();
            $activeCount = (clone $base)->where('status', 'active')->count();

            $submissionsCount = Submission::query()
                ->whereHas('assignment', function ($q) use ($tl, $group) {
                    $q->where('teacher_id', $tl->teacher_id)
                        ->where('subject_id', $tl->subject_id)
                        ->whereHas('groups', fn ($gq) => $gq->where('groups.id', $group->id));
                })
                ->count();

            return [
                'subject' => $tl->subject
                    ? [
                        'id' => $tl->subject->id,
                        'name' => $tl->subject->name,
                        'code' => $tl->subject->code,
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
                'assignments_total' => $assignmentsTotal,
                'submissions_count' => $submissionsCount,
            ];
        })->values()->all();

        return response()->json([
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
                'specialty' => $group->specialty,
                'specialty_id' => $group->specialty_id,
                'specialty_ref' => $group->specialtyRef,
                'admission_year' => $group->admission_year,
                'graduation_year' => $group->graduation_year,
                'study_years' => $group->study_years,
                'current_course' => $group->current_course,
                'status' => $group->status,
                'created_at' => optional($group->created_at)->toISOString(),
                'students_count' => (int) $group->students_count,
                'teachers_count' => (int) $teachersCount,
            ],
            'students' => $studentPayload,
            'subject_blocks' => $subjectBlocks,
            'curriculum' => $curriculum,
        ]);
    }

    public function updateGroup(Request $request, Group $group)
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
            'specialty_id' => ['nullable', 'integer', 'exists:specialties,id'],
            'specialty' => ['nullable', 'string', 'max:150'],
            'admission_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'graduation_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'study_years' => ['nullable', 'integer', 'min:1', 'max:6'],
            'current_course' => ['nullable', 'integer', 'min:1', 'max:6'],
            'status' => ['nullable', 'in:active,inactive,graduated'],
        ], [
            'name.regex' => 'Группа может содержать только буквы, цифры и дефис.',
            'status.in' => 'Некорректный статус группы.',
        ]);

        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim((string) $validated['name']);

            $admissionYear = (int) ($validated['admission_year'] ?? $group->admission_year);
            $duplicateExists = Group::whereRaw('LOWER(name) = ?', [mb_strtolower($validated['name'])])
                ->where('admission_year', $admissionYear ?: null)
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
        if (! empty($validated['specialty_id'])) {
            $specialty = Specialty::find((int) $validated['specialty_id']);
            $validated['specialty'] = $specialty?->name ?? $validated['specialty'] ?? null;
            $validated['study_years'] = $validated['study_years'] ?? $specialty?->study_years ?? $group->study_years;
        }

        $before = $group->only(['name', 'specialty', 'admission_year', 'graduation_year', 'study_years', 'current_course', 'status']);
        $statusClosing = array_key_exists('status', $validated) && $validated['status'] === 'inactive';
        $statusOpening = array_key_exists('status', $validated) && $validated['status'] === 'active' && $group->status !== 'active';

        if ($statusOpening && $group->students()->count() < 1) {
            return response()->json([
                'success' => false,
                'message' => 'Нельзя открыть группу без студентов. Добавьте хотя бы одного студента.',
            ], 422);
        }

        $group->update($validated);
        if (array_key_exists('specialty_id', $validated)) {
            $this->programs->copySpecialtyProgramToGroup($group->fresh());
        }

        if ($statusClosing) {
            TeachingLoad::where('group_id', $group->id)->update(['status' => 'inactive']);
        }

        $freshGroup = $group->fresh()->loadCount('students');
        $freshGroup->teachers_count = (int) TeachingLoad::query()
            ->where('group_id', $freshGroup->id)
            ->where('status', 'active')
            ->distinct()
            ->count('teacher_id');

        $this->log(
            $request,
            'update_group',
            "Группа {$freshGroup->name}: статус ".AdminLogMessages::groupStatus((string) $freshGroup->status),
        );

        if ($before !== $freshGroup->only(array_keys($before))) {
            app(AdminActionNotificationService::class)->notifyGroupChanged(
                $freshGroup,
                $request->user(),
                'Администратор изменил данные вашей группы: '.$freshGroup->name.'.',
            );
        }

        return response()->json([
            'success' => true,
            'group' => $freshGroup,
        ]);
    }

    public function createGroup(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
            'specialty_id' => ['required', 'integer', 'exists:specialties,id'],
            'graduation_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'status' => ['nullable', 'in:active,inactive,graduated'],
        ], [
            'name.required' => 'Введите название группы.',
            'name.regex' => 'Группа может содержать только буквы, цифры и дефис.',
            'specialty_id.required' => 'Укажите специальность.',
            'status.in' => 'Некорректный статус группы.',
        ]);

        $name = trim((string) $validated['name']);
        $specialty = Specialty::findOrFail((int) $validated['specialty_id']);
        $admissionYear = (int) now()->year;
        $studyYears = (int) $specialty->study_years;
        $graduationYear = (int) ($validated['graduation_year'] ?? ($admissionYear + $studyYears));

        $existingGroup = Group::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->where('admission_year', $admissionYear)
            ->first();
        if ($existingGroup !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Группа с таким названием уже существует.',
            ], 422);
        }

        $group = Group::create([
            'name' => $name,
            'specialty_id' => $specialty->id,
            'specialty' => $specialty->name,
            'admission_year' => $admissionYear,
            'graduation_year' => $graduationYear,
            'study_years' => $studyYears,
            'current_course' => 1,
            'status' => 'inactive',
        ]);
        $this->programs->copySpecialtyProgramToGroup($group);

        $this->log($request, 'create_group', "Создана группа {$group->name}");

        $out = $group->loadCount('students');
        $out->teachers_count = 0;

        return response()->json([
            'success' => true,
            'group' => $out,
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

        $movedStudents = collect();

        DB::transaction(function () use ($group, $studentIds, $students, $sendCredentials, &$movedCount, &$createdStudents, &$movedStudents) {
            if (!empty($studentIds)) {
                $movedStudents = User::where('role', 'student')
                    ->whereIn('id', $studentIds)
                    ->get();
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

        app(AdminActionNotificationService::class)->notifyStudentsMovedToGroup($movedStudents, $group, $request->user());

        return response()->json([
            'success' => true,
            'moved_count' => $movedCount,
            'created_count' => count($createdStudents),
            'group' => $group->fresh()->loadCount('students'),
            'created_students' => $createdStudents,
        ]);
    }

    public function detachStudentFromGroup(Request $request, Group $group, User $user)
    {
        if ($user->role !== 'student') {
            return response()->json([
                'success' => false,
                'message' => 'Пользователь не является студентом.',
            ], 422);
        }

        if ((int) $user->group_id !== (int) $group->id) {
            return response()->json([
                'success' => false,
                'message' => 'Студент не состоит в этой группе.',
            ], 422);
        }

        $user->update(['group_id' => null]);

        $this->log(
            $request,
            'detach_student_from_group',
            "Студент {$user->login} исключён из группы {$group->name}"
        );

        return response()->json([
            'success' => true,
            'group' => $group->fresh()->loadCount('students'),
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
                    'status' => $row['status'] ?? 'inactive',
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

    public function promoteBatch(Request $request)
    {
        if ((int) now()->month !== 8) {
            return response()->json([
                'success' => false,
                'message' => 'Перевод групп доступен только в августе перед новым учебным годом.',
            ], 422);
        }

        $validated = $request->validate([
            'group_ids' => ['nullable', 'array'],
            'group_ids.*' => ['integer', 'exists:groups,id'],
        ]);

        $query = Group::query()->where('status', 'active');
        if (! empty($validated['group_ids'])) {
            $query->whereIn('id', $validated['group_ids']);
        }

        $groups = $query->get();
        $updated = $groups->map(fn (Group $group) => $this->programs->promoteGroup($group))->values();
        foreach ($updated as $group) {
            app(AdminActionNotificationService::class)->notifyGroupChanged(
                $group,
                $request->user(),
                'Администратор перевёл вашу группу '.$group->name.' на '.$group->current_course.' курс.',
            );
        }

        $this->log($request, 'promote_groups_course_batch', 'Перевод групп на новый курс: '.$updated->count());

        return response()->json(['success' => true, 'groups' => $updated]);
    }
}
