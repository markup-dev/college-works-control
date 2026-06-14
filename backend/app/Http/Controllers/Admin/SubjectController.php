<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\LogsAdminActions;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Submission;
use App\Models\Subject;
use App\Models\TeacherSubject;
use App\Models\TeachingLoad;
use App\Models\User;
use App\Services\Admin\AdminCsvImportService;
use App\Services\AdminActionNotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Админ: дисциплины (справочник дисциплин, активность, импорт из CSV для массового заведения).
 */
class SubjectController extends Controller
{
    use LogsAdminActions;

    private const SUBJECTS_PER_PAGE = 18;

    public function __construct(
        private readonly AdminCsvImportService $csvImport,
    ) {}

    public function subjects()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
            'sort' => ['nullable', 'in:name_asc,name_desc,newest,oldest'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Subject::query();

        if (!empty($validated['search'])) {
            $term = '%' . trim((string) $validated['search']) . '%';
            $query->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('code', 'like', $term));
        }

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
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

        $ids = $subjects->getCollection()->pluck('id');
        if ($ids->isNotEmpty()) {
            $teacherCounts = TeacherSubject::query()
                ->selectRaw('subject_id, COUNT(DISTINCT teacher_id) as cnt')
                ->where('status', 'active')
                ->whereIn('subject_id', $ids)
                ->groupBy('subject_id')
                ->pluck('cnt', 'subject_id');
            $groupCounts = TeachingLoad::query()
                ->selectRaw('subject_id, COUNT(DISTINCT group_id) as cnt')
                ->where('status', 'active')
                ->whereIn('subject_id', $ids)
                ->groupBy('subject_id')
                ->pluck('cnt', 'subject_id');
            $assignmentCounts = Assignment::query()
                ->selectRaw('subject_id, COUNT(*) as cnt')
                ->whereIn('subject_id', $ids)
                ->groupBy('subject_id')
                ->pluck('cnt', 'subject_id');
            foreach ($subjects->items() as $subject) {
                $subject->teachers_count = (int) ($teacherCounts[$subject->id] ?? 0);
                $subject->groups_count = (int) ($groupCounts[$subject->id] ?? 0);
                $subject->assignments_count = (int) ($assignmentCounts[$subject->id] ?? 0);
            }
        }

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

    public function showSubject(Subject $subject)
    {
        $loads = TeachingLoad::query()
            ->where('subject_id', $subject->id)
            ->where('status', 'active')
            ->with(['teacher', 'group'])
            ->get()
            ->sortBy(fn (TeachingLoad $tl) => ($tl->teacher?->last_name ?? '') . ($tl->teacher?->first_name ?? ''))
            ->values();

        $teachingPayload = $loads->map(function (TeachingLoad $tl) use ($subject) {
            $activeCount = Assignment::query()
                ->where('teacher_id', $tl->teacher_id)
                ->where('subject_id', $subject->id)
                ->where('status', 'active')
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $tl->group_id))
                ->count();

            return [
                'teaching_load_id' => $tl->id,
                'teacher' => $tl->teacher
                    ? [
                        'id' => $tl->teacher->id,
                        'last_name' => $tl->teacher->last_name,
                        'first_name' => $tl->teacher->first_name,
                        'middle_name' => $tl->teacher->middle_name,
                    ]
                    : null,
                'group' => $tl->group
                    ? ['id' => $tl->group->id, 'name' => $tl->group->name]
                    : null,
                'active_assignments_count' => $activeCount,
            ];
        })->all();

        $allowances = TeacherSubject::query()
            ->where('subject_id', $subject->id)
            ->where('status', 'active')
            ->with(['teacher:id,last_name,first_name,middle_name,department,login,email,is_active'])
            ->get()
            ->sortBy(fn (TeacherSubject $item) => ($item->teacher?->last_name ?? '').($item->teacher?->first_name ?? ''))
            ->values();

        $loadsByTeacher = TeachingLoad::query()
            ->where('subject_id', $subject->id)
            ->where('status', 'active')
            ->selectRaw('teacher_id, COUNT(*) as cnt')
            ->groupBy('teacher_id')
            ->pluck('cnt', 'teacher_id');

        $teacherAllowancesPayload = $allowances->map(function (TeacherSubject $item) use ($loadsByTeacher) {
            $teacher = $item->teacher;

            return [
                'id' => $item->id,
                'teacher' => $teacher
                    ? [
                        'id' => $teacher->id,
                        'last_name' => $teacher->last_name,
                        'first_name' => $teacher->first_name,
                        'middle_name' => $teacher->middle_name,
                        'department' => $teacher->department,
                        'login' => $teacher->login,
                        'email' => $teacher->email,
                    ]
                    : null,
                'loads_count' => (int) ($loadsByTeacher[$item->teacher_id] ?? 0),
            ];
        })->all();

        $allowedTeacherIds = $allowances->pluck('teacher_id')->filter()->all();
        $availableTeachers = User::query()
            ->where('role', 'teacher')
            ->where('is_active', true)
            ->when($allowedTeacherIds !== [], fn ($query) => $query->whereNotIn('id', $allowedTeacherIds))
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->orderBy('middle_name')
            ->get(['id', 'last_name', 'first_name', 'middle_name', 'department', 'login', 'email']);

        $allowancesCount = count($teacherAllowancesPayload);

        $teachersWithLoadsCount = (int) TeachingLoad::query()
            ->where('subject_id', $subject->id)
            ->where('status', 'active')
            ->distinct()
            ->count('teacher_id');

        $groupsCount = (int) TeachingLoad::query()
            ->where('subject_id', $subject->id)
            ->where('status', 'active')
            ->distinct()
            ->count('group_id');

        $teachingLoadsCount = (int) TeachingLoad::query()
            ->where('subject_id', $subject->id)
            ->where('status', 'active')
            ->count();

        $assignmentsCount = (int) Assignment::where('subject_id', $subject->id)->count();
        $activeAssignmentsCount = (int) Assignment::where('subject_id', $subject->id)->where('status', 'active')->count();
        $submissionsCount = (int) Submission::whereHas(
            'assignment',
            fn ($q) => $q->where('subject_id', $subject->id)
        )->count();

        return response()->json([
            'subject' => [
                'id' => $subject->id,
                'name' => $subject->name,
                'code' => $subject->code,
                'status' => $subject->status,
                'created_at' => optional($subject->created_at)->toISOString(),
            ],
            'stats' => [
                'allowances_count' => $allowancesCount,
                'teachers_count' => $allowancesCount,
                'teachers_with_loads_count' => $teachersWithLoadsCount,
                'groups_count' => $groupsCount,
                'teaching_loads_count' => $teachingLoadsCount,
                'assignments_count' => $assignmentsCount,
                'active_assignments_count' => $activeAssignmentsCount,
                'submissions_count' => $submissionsCount,
            ],
            'teacher_allowances' => $teacherAllowancesPayload,
            'available_teachers' => $availableTeachers->map(fn (User $teacher) => [
                'id' => $teacher->id,
                'last_name' => $teacher->last_name,
                'first_name' => $teacher->first_name,
                'middle_name' => $teacher->middle_name,
                'department' => $teacher->department,
                'login' => $teacher->login,
                'email' => $teacher->email,
            ])->all(),
            'teaching_loads' => $teachingPayload,
        ]);
    }

    public function createSubject(Request $request)
    {
        $validated = $request->validate(
            [
                'name' => ['required', 'string', 'min:2', 'max:255', Rule::unique('subjects', 'name')],
                'code' => ['required', 'string', 'max:32', 'regex:/^[А-ЯЁA-Za-z0-9_.-]+$/u', Rule::unique('subjects', 'code')],
                'status' => ['nullable', 'in:active,inactive'],
            ],
            [
                'name.required' => 'Введите название дисциплины.',
                'name.min' => 'Название дисциплины должно содержать минимум 2 символа.',
                'name.unique' => 'Дисциплина с таким названием уже существует.',
                'code.required' => 'Введите код дисциплины.',
                'code.unique' => 'Дисциплина с таким кодом уже существует.',
                'code.regex' => 'Код может содержать буквы, цифры, точку и дефис.',
            ]
        );

        $subject = Subject::create([
            'name' => trim((string) $validated['name']),
            'code' => trim((string) $validated['code']),
            'status' => $validated['status'] ?? 'active',
        ]);

        $this->log($request, 'create_subject', "Создан дисциплина {$subject->name} ({$subject->code})");

        return response()->json(['success' => true, 'subject' => $this->appendSubjectCardCounts($subject->fresh())], 201);
    }

    public function updateSubject(Request $request, Subject $subject)
    {
        $validated = $request->validate(
            [
                'name' => ['sometimes', 'required', 'string', 'min:2', 'max:255', Rule::unique('subjects', 'name')->ignore($subject->id)],
                'code' => ['sometimes', 'required', 'string', 'max:32', 'regex:/^[А-ЯЁA-Za-z0-9_.-]+$/u', Rule::unique('subjects', 'code')->ignore($subject->id)],
                'status' => ['nullable', 'in:active,inactive'],
            ],
            [
                'name.required' => 'Введите название дисциплины.',
                'name.min' => 'Название дисциплины должно содержать минимум 2 символа.',
                'name.unique' => 'Дисциплина с таким названием уже существует.',
                'code.required' => 'Введите код дисциплины.',
                'code.unique' => 'Дисциплина с таким кодом уже существует.',
                'code.regex' => 'Код может содержать буквы, цифры, точку и дефис.',
            ]
        );

        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim((string) $validated['name']);
        }
        if (array_key_exists('code', $validated)) {
            $validated['code'] = trim((string) $validated['code']);
        }

        $activeLoadsBeforeDeactivation = collect();
        $activeTeacherSubjectsBeforeDeactivation = collect();
        if (($validated['status'] ?? null) === 'inactive') {
            $activeLoadsBeforeDeactivation = TeachingLoad::query()
                ->where('subject_id', $subject->id)
                ->where('status', 'active')
                ->with(['teacher', 'subject', 'group'])
                ->get();
            $activeTeacherSubjectsBeforeDeactivation = TeacherSubject::query()
                ->where('subject_id', $subject->id)
                ->where('status', 'active')
                ->with(['teacher', 'subject'])
                ->get();
        }

        $subject->update($validated);

        if (($validated['status'] ?? null) === 'inactive') {
            TeachingLoad::query()
                ->where('subject_id', $subject->id)
                ->where('status', 'active')
                ->update(['status' => 'inactive']);

            TeacherSubject::query()
                ->where('subject_id', $subject->id)
                ->where('status', 'active')
                ->update(['status' => 'inactive']);

            foreach ($activeLoadsBeforeDeactivation as $load) {
                if ($load->teacher) {
                    app(AdminActionNotificationService::class)->notify(
                        $load->teacher,
                        $request->user(),
                        'Назначение приостановлено',
                        'Администратор деактивировал дисциплину «'.$subject->name.'», поэтому назначение для группы '.($load->group?->name ?? '—').' приостановлено.',
                        [
                            'action' => 'subject_deactivated_teaching_load',
                            'subject_id' => $subject->id,
                            'group_id' => $load->group_id,
                            'teaching_load_id' => $load->id,
                        ],
                    );
                }
            }

            foreach ($activeTeacherSubjectsBeforeDeactivation as $teacherSubject) {
                if ($teacherSubject->teacher) {
                    app(AdminActionNotificationService::class)->notify(
                        $teacherSubject->teacher,
                        $request->user(),
                        'Допуск к дисциплине приостановлен',
                        'Администратор деактивировал дисциплину «'.$subject->name.'», поэтому ваш допуск к ней приостановлен.',
                        [
                            'action' => 'subject_deactivated_teacher_subject',
                            'subject_id' => $subject->id,
                        ],
                    );
                }
            }
        }

        $fresh = $subject->fresh();
        $this->log($request, 'update_subject', "Изменен дисциплина {$fresh->name} ({$fresh->code})");

        return response()->json(['success' => true, 'subject' => $this->appendSubjectCardCounts($fresh)]);
    }

    public function deleteSubject(Request $request, Subject $subject)
    {
        $name = $subject->name;
        $subject->delete();

        $this->log($request, 'delete_subject', "Удален дисциплина {$name}");

        return response()->json(['success' => true]);
    }

    public function previewSubjectsImport(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $rows = $this->csvImport->parseFile($request->file('file')->getRealPath());
        $analysis = $this->csvImport->analyzeSubjectRows($rows);

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
        $analysis = $this->csvImport->analyzeSubjectRows($validated['rows']);
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
            Subject::updateOrCreate(
                ['code' => $row['code']],
                [
                    'name' => trim((string) $row['name']),
                    'status' => $row['status'] ?? 'active',
                ]
            );
            $created++;
        }

        $this->log($request, 'import_subjects', "Массовый импорт дисциплин: создано {$created}");

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

    private function appendSubjectCardCounts(Subject $subject): Subject
    {
        $id = $subject->id;
        $subject->teachers_count = (int) TeachingLoad::query()
            ->where('subject_id', $id)
            ->where('status', 'active')
            ->distinct()
            ->count('teacher_id');
        $subject->groups_count = (int) TeachingLoad::query()
            ->where('subject_id', $id)
            ->where('status', 'active')
            ->distinct()
            ->count('group_id');
        $subject->assignments_count = (int) Assignment::where('subject_id', $id)->count();

        return $subject;
    }
}
