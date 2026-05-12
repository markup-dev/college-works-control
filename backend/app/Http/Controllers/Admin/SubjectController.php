<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\LogsAdminActions;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Submission;
use App\Models\Subject;
use App\Models\TeachingLoad;
use App\Services\Admin\AdminCsvImportService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Админ: предметы (справочник дисциплин, активность, импорт из CSV для массового заведения).
 */
class SubjectController extends Controller
{
    use LogsAdminActions;

    private const SUBJECTS_PER_PAGE = 20;

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
            $teacherCounts = TeachingLoad::query()
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

        $teachersCount = (int) TeachingLoad::query()
            ->where('subject_id', $subject->id)
            ->where('status', 'active')
            ->distinct()
            ->count('teacher_id');

        $groupsCount = (int) TeachingLoad::query()
            ->where('subject_id', $subject->id)
            ->where('status', 'active')
            ->distinct()
            ->count('group_id');

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
                'teachers_count' => $teachersCount,
                'groups_count' => $groupsCount,
                'assignments_count' => $assignmentsCount,
                'active_assignments_count' => $activeAssignmentsCount,
                'submissions_count' => $submissionsCount,
            ],
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
                'name.required' => 'Введите название предмета.',
                'name.min' => 'Название предмета должно содержать минимум 2 символа.',
                'name.unique' => 'Предмет с таким названием уже существует.',
                'code.required' => 'Введите код предмета.',
                'code.unique' => 'Предмет с таким кодом уже существует.',
                'code.regex' => 'Код может содержать буквы, цифры, точку и дефис.',
            ]
        );

        $subject = Subject::create([
            'name' => trim((string) $validated['name']),
            'code' => trim((string) $validated['code']),
            'status' => $validated['status'] ?? 'active',
        ]);

        $this->log($request, 'create_subject', "Создан предмет {$subject->name} ({$subject->code})");

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
                'name.required' => 'Введите название предмета.',
                'name.min' => 'Название предмета должно содержать минимум 2 символа.',
                'name.unique' => 'Предмет с таким названием уже существует.',
                'code.required' => 'Введите код предмета.',
                'code.unique' => 'Предмет с таким кодом уже существует.',
                'code.regex' => 'Код может содержать буквы, цифры, точку и дефис.',
            ]
        );

        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim((string) $validated['name']);
        }
        if (array_key_exists('code', $validated)) {
            $validated['code'] = trim((string) $validated['code']);
        }

        $subject->update($validated);

        $fresh = $subject->fresh();
        $this->log($request, 'update_subject', "Изменен предмет {$fresh->name} ({$fresh->code})");

        return response()->json(['success' => true, 'subject' => $this->appendSubjectCardCounts($fresh)]);
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
