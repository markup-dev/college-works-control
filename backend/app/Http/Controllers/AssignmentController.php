<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\AssignmentMaterial;
use App\Models\Group;
use App\Models\Subject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class AssignmentController extends Controller
{
    public function meta(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'teacher') {
            return response()->json([
                'subjects' => [],
                'groups' => [],
            ]);
        }

        $subjects = Subject::where('teacher_id', $user->id)
            ->orderBy('name')
            ->get(['id', 'name']);

        $groupNames = Group::where('teacher_id', $user->id)
            ->orWhereHas('assignments', fn($query) => $query->where('teacher_id', $user->id))
            ->orderBy('name')
            ->pluck('name');

        return response()->json([
            'subjects' => $subjects
                ->filter(fn($subject) => !empty($subject->name))
                ->map(fn($subject) => [
                    'id' => (int) $subject->id,
                    'name' => (string) $subject->name,
                ])
                ->values()
                ->all(),
            'groups' => $groupNames->filter()->unique()->values()->all(),
        ]);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive,archived,not_submitted,submitted,graded,returned,urgent'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'teacher_id' => ['nullable', 'integer', 'exists:users,id'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'group' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:priority,deadline,deadline_desc,newest,oldest,title,subject,pending_desc,pending_asc'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $requestedPage = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 0);
        $shouldPaginate = $perPage > 0 || array_key_exists('page', $validated);
        if ($shouldPaginate && $perPage <= 0) {
            $perPage = 24;
        }

        if ($user->role === 'student') {
            if (!$user->group_id) {
                if ($shouldPaginate) {
                    return response()->json([
                        'data' => [],
                        'meta' => [
                            'current_page' => $requestedPage,
                            'last_page' => 1,
                            'per_page' => $perPage,
                            'total' => 0,
                        ],
                    ]);
                }
                return response()->json([]);
            }

            $query = Assignment::with([
                'teacher:id,login,last_name,first_name,middle_name',
                'subjectRelation:id,name',
                'groups:id,name,teacher_id',
                'criteriaItems:id,assignment_id,position,text,max_points',
                'allowedFormatItems:id,assignment_id,format',
                'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
            ])
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $user->group_id))
                ->withCount([
                    'submissions',
                    'submissions as pending_count' => fn ($q) => $q->where('status', 'submitted'),
                ]);

            if (!empty($validated['search'])) {
                $term = trim((string) $validated['search']);
                $query->where(function ($builder) use ($term) {
                    $builder
                        ->where('title', 'like', "%{$term}%")
                        ->orWhereHas('subjectRelation', fn ($subjectQuery) => $subjectQuery->where('name', 'like', "%{$term}%"))
                        ->orWhereHas('teacher', function ($teacherQuery) use ($term) {
                            $teacherQuery
                                ->where('last_name', 'like', "%{$term}%")
                                ->orWhere('first_name', 'like', "%{$term}%")
                                ->orWhere('middle_name', 'like', "%{$term}%")
                                ->orWhere('login', 'like', "%{$term}%");
                        });
                });
            }

            if (!empty($validated['subject_id'])) {
                $query->where('subject_id', (int) $validated['subject_id']);
            }

            if (!empty($validated['teacher_id'])) {
                $query->where('teacher_id', (int) $validated['teacher_id']);
            }

            if (!empty($validated['group_id'])) {
                $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.id', (int) $validated['group_id']));
            }
            if (!empty($validated['group'])) {
                $groupName = trim((string) $validated['group']);
                $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.name', $groupName));
            }

            $sort = $validated['sort'] ?? 'priority';
            switch ($sort) {
                case 'deadline':
                    $query->orderBy('deadline');
                    break;
                case 'deadline_desc':
                    $query->orderByDesc('deadline');
                    break;
                case 'newest':
                    $query->orderByDesc('created_at');
                    break;
                case 'oldest':
                    $query->orderBy('created_at');
                    break;
                case 'title':
                    $query->orderBy('title');
                    break;
                case 'subject':
                    $query->orderBy('subject_id');
                    break;
                case 'pending_asc':
                    $query->orderBy('pending_count');
                    break;
                case 'pending_desc':
                    $query->orderByDesc('pending_count');
                    break;
                case 'priority':
                default:
                    $query->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
                        ->orderBy('deadline');
                    break;
            }

            $assignments = $query->get();

            $transformed = $assignments->map(function ($assignment) use ($user) {
                $studentSubmissions = $assignment->submissions()
                    ->where('student_id', $user->id)
                    ->orderByDesc('submitted_at')
                    ->orderByDesc('id')
                    ->get(['id', 'status', 'score', 'teacher_comment', 'criterion_scores', 'submitted_at', 'is_resubmission']);

                $submission = $studentSubmissions->first();
                $retakeUsed = $studentSubmissions->contains(fn($item) => (bool) $item->is_resubmission);
                $canSubmitFirstAttempt = !$submission;
                $canSubmitRetake = (bool) ($submission && $submission->status === 'returned' && !$retakeUsed);

                $data = $assignment->toArray();
                unset($data['teacher']);
                $data['is_completed'] = $assignment->status === 'archived';
                $data['status'] = $submission ? $submission->status : 'not_submitted';
                $data['score'] = $submission?->score;
                $data['submitted_at'] = $submission?->submitted_at;
                $data['feedback'] = $submission?->teacher_comment;
                $data['criterion_scores'] = $submission?->criterion_scores;
                $data['retake_used'] = $retakeUsed;
                $data['can_submit_first_attempt'] = $canSubmitFirstAttempt;
                $data['can_submit_retake'] = $canSubmitRetake;
                $data['criteria'] = $this->mergeCriteriaWithScores(
                    is_array($data['criteria'] ?? null) ? $data['criteria'] : [],
                    is_array($submission?->criterion_scores ?? null) ? $submission->criterion_scores : []
                );
                $data['teacher'] = $assignment->teacher?->full_name ?? 'Не указан';

                return $data;
            });

            if (!empty($validated['status'])) {
                $status = $validated['status'];
                $transformed = $transformed->filter(function ($assignment) use ($status) {
                    if ($status === 'urgent') {
                        return $assignment['status'] === 'not_submitted'
                            && !empty($assignment['deadline'])
                            && now()->diffInDays($assignment['deadline'], false) <= 3;
                    }

                    return ($assignment['status'] ?? null) === $status;
                })->values();
            }

            if ($shouldPaginate) {
                $total = $transformed->count();
                $lastPage = max(1, (int) ceil($total / $perPage));
                $page = min(max(1, $requestedPage), $lastPage);
                $items = $transformed->forPage($page, $perPage)->values()->all();

                return response()->json([
                    'data' => $items,
                    'meta' => [
                        'current_page' => $page,
                        'last_page' => $lastPage,
                        'per_page' => $perPage,
                        'total' => $total,
                    ],
                ]);
            }

            return response()->json($transformed->values()->all());
        }

        if ($user->role === 'teacher') {
            $query = Assignment::where('teacher_id', $user->id);
        } else {
            $query = Assignment::query();
        }

        $query->with([
            'teacher:id,login,last_name,first_name,middle_name',
            'subjectRelation:id,name',
            'groups:id,name,teacher_id',
            'criteriaItems:id,assignment_id,position,text,max_points',
            'allowedFormatItems:id,assignment_id,format',
            'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
        ])
            ->withCount([
                'submissions',
                'submissions as pending_count' => fn($q) => $q->where('status', 'submitted'),
            ]);

        if (!empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(function ($builder) use ($term) {
                $builder
                    ->where('title', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%")
                    ->orWhereHas('subjectRelation', fn ($subjectQuery) => $subjectQuery->where('name', 'like', "%{$term}%"));
            });
        }

        if (!empty($validated['status']) && in_array($validated['status'], ['active', 'inactive', 'archived'], true)) {
            $query->where('status', $validated['status']);
        }

        if (!empty($validated['subject_id'])) {
            $query->where('subject_id', (int) $validated['subject_id']);
        }

        if (!empty($validated['teacher_id'])) {
            $query->where('teacher_id', (int) $validated['teacher_id']);
        }

        if (!empty($validated['group_id'])) {
            $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.id', (int) $validated['group_id']));
        }
        if (!empty($validated['group'])) {
            $groupName = trim((string) $validated['group']);
            $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.name', $groupName));
        }

        $sort = $validated['sort'] ?? 'priority';
        switch ($sort) {
            case 'deadline':
                $query->orderBy('deadline');
                break;
            case 'deadline_desc':
                $query->orderByDesc('deadline');
                break;
            case 'newest':
                $query->orderByDesc('created_at');
                break;
            case 'oldest':
                $query->orderBy('created_at');
                break;
            case 'title':
                $query->orderBy('title');
                break;
            case 'subject':
                $query->orderBy('subject_id');
                break;
            case 'pending_asc':
                $query->orderBy('pending_count');
                break;
            case 'pending_desc':
                $query->orderByDesc('pending_count');
                break;
            case 'priority':
            default:
                $query->orderByRaw("FIELD(priority, 'high', 'medium', 'low')")
                    ->orderBy('deadline');
                break;
        }

        $mapAssignment = function ($assignment) {
            $assignment->syncCompletionStatus();
            $data = $assignment->toArray();
            unset($data['teacher']);
            $data['teacher'] = $assignment->teacher?->full_name ?? 'Не указан';
            $data['is_completed'] = $assignment->status === 'archived';
            $data = [
                ...$data,
                ...$assignment->calculateCompletionMetrics(),
            ];
            return $data;
        };

        if ($shouldPaginate) {
            $paginated = $query->paginate($perPage, ['*'], 'page', $requestedPage);
            $paginated->getCollection()->transform($mapAssignment);
            return response()->json([
                'data' => $paginated->items(),
                'meta' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
            ]);
        }

        return response()->json($query->get()->map($mapAssignment));
    }

    public function store(Request $request)
    {
        $validated = $request->validate(
            [
                'title' => ['required', 'string', 'min:3', 'max:255'],
                'subject_id' => ['required', Rule::exists('subjects', 'id')->where(fn($query) => $query->where('teacher_id', $request->user()->id))],
                'description' => ['required', 'string', 'min:10', 'max:5000'],
                'deadline' => ['required', 'date', 'after_or_equal:today'],
                'max_score' => ['nullable', 'integer', 'min:1', 'max:1000'],
                'submission_type' => ['nullable', 'in:file,demo'],
                'criteria' => ['nullable', 'array', 'max:20'],
                'criteria.*.text' => ['nullable', 'string', 'max:500'],
                'criteria.*.max_points' => ['nullable', 'integer', 'min:0', 'max:1000'],
                'student_groups' => ['nullable', 'array', 'max:20'],
                'student_groups.*' => ['string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
                'priority' => ['nullable', 'in:low,medium,high'],
                'allowed_formats' => ['nullable', 'array', 'max:20'],
                'allowed_formats.*' => ['string', 'max:30'],
                'max_file_size' => ['nullable', 'integer', 'min:1', 'max:102400'],
            ],
            [
                'title.required' => 'Введите название задания.',
                'title.min' => 'Название задания должно содержать минимум 3 символа.',
                'subject_id.required' => 'Выберите дисциплину из назначенных.',
                'subject_id.exists' => 'Выберите корректную дисциплину из назначенных.',
                'description.required' => 'Введите описание задания.',
                'description.min' => 'Описание задания должно содержать минимум 10 символов.',
                'deadline.after_or_equal' => 'Срок сдачи не может быть в прошлом.',
                'max_score.max' => 'Максимальный балл не должен превышать 1000.',
                'student_groups.*.regex' => 'Название группы может содержать только буквы, цифры и дефис.',
            ]
        );

        $groupNames = $request->input('student_groups', []);
        $criteria = $request->input('criteria', []);
        $allowedFormats = $request->input('allowed_formats', []);
        unset($validated['student_groups'], $validated['criteria'], $validated['allowed_formats']);

        $assignment = Assignment::create([
            ...$validated,
            'max_score' => $validated['max_score'] ?? 100,
            'submission_type' => $validated['submission_type'] ?? 'file',
            'priority' => $validated['priority'] ?? 'medium',
            'status' => 'active',
            'teacher_id' => $request->user()->id,
        ]);

        $groupIds = collect($groupNames)
            ->filter(fn($name) => is_string($name) && trim($name) !== '')
            ->map(fn($name) => trim($name))
            ->unique()
            ->map(function ($groupName) use ($request) {
                return Group::firstOrCreate(
                    [
                        'name' => $groupName,
                        'teacher_id' => $request->user()->id,
                    ],
                    ['status' => 'active']
                )->id;
            })
            ->values()
            ->all();

        $assignment->groups()->sync($groupIds);

        $this->syncCriteria($assignment, is_array($criteria) ? $criteria : []);
        $this->syncAllowedFormats($assignment, is_array($allowedFormats) ? $allowedFormats : []);

        $assignment->load([
            'teacher:id,login,last_name,first_name,middle_name',
            'subjectRelation:id,name',
            'groups:id,name,teacher_id',
            'criteriaItems:id,assignment_id,position,text,max_points',
            'allowedFormatItems:id,assignment_id,format',
            'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
        ]);

        return response()->json([
            'success' => true,
            'assignment' => $assignment,
        ], 201);
    }

    public function show(Assignment $assignment)
    {
        $assignment->load([
            'teacher:id,login,last_name,first_name,middle_name',
            'subjectRelation:id,name',
            'groups:id,name,teacher_id',
            'criteriaItems:id,assignment_id,position,text,max_points',
            'allowedFormatItems:id,assignment_id,format',
            'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
        ]);
        $assignment->loadCount([
            'submissions',
            'submissions as pending_count' => fn($q) => $q->where('status', 'submitted'),
        ]);

        return response()->json($assignment);
    }

    public function update(Request $request, Assignment $assignment)
    {
        $validated = $request->validate(
            [
                'title' => ['sometimes', 'required', 'string', 'min:3', 'max:255'],
                'subject_id' => ['sometimes', 'required', Rule::exists('subjects', 'id')->where(fn($query) => $query->where('teacher_id', $request->user()->id))],
                'description' => ['nullable', 'string', 'min:10', 'max:5000'],
                'deadline' => ['sometimes', 'required', 'date', 'after_or_equal:today'],
                'status' => ['nullable', 'in:active,inactive,archived'],
                'max_score' => ['nullable', 'integer', 'min:1', 'max:1000'],
                'submission_type' => ['nullable', 'in:file,demo'],
                'criteria' => ['nullable', 'array', 'max:20'],
                'criteria.*.text' => ['nullable', 'string', 'max:500'],
                'criteria.*.max_points' => ['nullable', 'integer', 'min:0', 'max:1000'],
                'student_groups' => ['nullable', 'array', 'max:20'],
                'student_groups.*' => ['string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
                'priority' => ['nullable', 'in:low,medium,high'],
                'allowed_formats' => ['nullable', 'array', 'max:20'],
                'allowed_formats.*' => ['string', 'max:30'],
                'max_file_size' => ['nullable', 'integer', 'min:1', 'max:102400'],
            ],
            [
                'title.required' => 'Введите название задания.',
                'title.min' => 'Название задания должно содержать минимум 3 символа.',
                'subject_id.required' => 'Выберите дисциплину из назначенных.',
                'subject_id.exists' => 'Выберите корректную дисциплину из назначенных.',
                'description.min' => 'Описание задания должно содержать минимум 10 символов.',
                'deadline.after_or_equal' => 'Срок сдачи не может быть в прошлом.',
                'max_score.max' => 'Максимальный балл не должен превышать 1000.',
                'student_groups.*.regex' => 'Название группы может содержать только буквы, цифры и дефис.',
            ]
        );

        $newGroupIds = null;
        if ($request->has('student_groups')) {
            $newGroupIds = collect($request->input('student_groups', []))
                ->filter(fn($name) => is_string($name) && trim($name) !== '')
                ->map(fn($name) => trim($name))
                ->unique()
                ->map(function ($groupName) use ($assignment) {
                    return Group::firstOrCreate(
                        [
                            'name' => $groupName,
                            'teacher_id' => $assignment->teacher_id,
                        ],
                        ['status' => 'active']
                    )->id;
                })
                ->values()
                ->all();
        }

        $newCriteria = $request->has('criteria') ? $request->input('criteria', []) : null;
        $newAllowedFormats = $request->has('allowed_formats') ? $request->input('allowed_formats', []) : null;

        unset($validated['student_groups'], $validated['criteria'], $validated['allowed_formats']);
        $assignment->update($validated);
        if (is_array($newGroupIds)) {
            $assignment->groups()->sync($newGroupIds);
        }
        if (is_array($newCriteria)) {
            $this->syncCriteria($assignment, $newCriteria);
        }
        if (is_array($newAllowedFormats)) {
            $this->syncAllowedFormats($assignment, $newAllowedFormats);
        }

        return response()->json([
            'success' => true,
            'assignment' => $assignment->fresh()->load([
                'teacher:id,login,last_name,first_name,middle_name',
                'subjectRelation:id,name',
                'groups:id,name,teacher_id',
                'criteriaItems:id,assignment_id,position,text,max_points',
                'allowedFormatItems:id,assignment_id,format',
                'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
            ]),
        ]);
    }

    public function destroy(Assignment $assignment)
    {
        $assignment->loadMissing('materialItems');
        foreach ($assignment->materialItems as $material) {
            if (!empty($material->file_path) && Storage::disk('public')->exists($material->file_path)) {
                Storage::disk('public')->delete($material->file_path);
            }
        }

        $assignment->delete();

        return response()->json(['success' => true]);
    }

    public function uploadMaterials(Request $request, Assignment $assignment)
    {
        if ((int) $assignment->teacher_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Недостаточно прав для изменения материалов этого задания.'], 403);
        }

        $validated = $request->validate(
            [
                'files' => ['nullable', 'array', 'max:10'],
                'files.*' => ['file', 'max:51200', 'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,zip,rar,txt,png,jpg,jpeg'],
                'remove_ids' => ['nullable', 'array', 'max:50'],
                'remove_ids.*' => ['integer'],
            ],
            [
                'files.max' => 'Можно прикрепить не более 10 файлов.',
                'files.*.max' => 'Размер каждого файла не должен превышать 50 МБ.',
                'files.*.mimes' => 'Недопустимый формат файла. Разрешены: pdf, doc, docx, xls, xlsx, ppt, pptx, zip, rar, txt, png, jpg, jpeg.',
            ]
        );

        $removeIds = collect($validated['remove_ids'] ?? [])
            ->map(fn($id) => (int) $id)
            ->unique()
            ->values();

        if ($removeIds->isNotEmpty()) {
            $materialsToDelete = $assignment->materialItems()
                ->whereIn('id', $removeIds->all())
                ->get();

            foreach ($materialsToDelete as $material) {
                if (!empty($material->file_path) && Storage::disk('public')->exists($material->file_path)) {
                    Storage::disk('public')->delete($material->file_path);
                }
                $material->delete();
            }
        }

        foreach ($request->file('files', []) as $file) {
            $storedPath = $file->store('assignment-materials', 'public');

            $assignment->materialItems()->create([
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $storedPath,
                'file_size' => $this->formatFileSize($file->getSize()),
                'file_type' => $file->getClientMimeType(),
            ]);
        }

        return response()->json([
            'success' => true,
            'assignment' => $assignment->fresh()->load([
                'teacher:id,login,last_name,first_name,middle_name',
                'subjectRelation:id,name',
                'groups:id,name,teacher_id',
                'criteriaItems:id,assignment_id,position,text,max_points',
                'allowedFormatItems:id,assignment_id,format',
                'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
            ]),
        ]);
    }

    public function downloadMaterial(Request $request, Assignment $assignment, AssignmentMaterial $material)
    {
        if ((int) $material->assignment_id !== (int) $assignment->id) {
            return response()->json(['message' => 'Материал не принадлежит заданию.'], 404);
        }

        $user = $request->user();
        $isStudentInGroup = $user->role === 'student'
            && $user->group_id
            && $assignment->groups()->where('groups.id', $user->group_id)->exists();

        $canDownload = $user->role === 'admin'
            || ($user->role === 'teacher' && (int) $assignment->teacher_id === (int) $user->id)
            || $isStudentInGroup;

        if (!$canDownload) {
            return response()->json(['message' => 'Недостаточно прав для скачивания материала.'], 403);
        }

        if (empty($material->file_path) || !Storage::disk('public')->exists($material->file_path)) {
            return response()->json(['message' => 'Файл не найден.'], 404);
        }

        return Storage::disk('public')->download(
            $material->file_path,
            $material->file_name ?: basename($material->file_path)
        );
    }

    private function formatFileSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }
        return round($bytes / 1024, 1) . ' KB';
    }

    private function syncCriteria(Assignment $assignment, array $criteria): void
    {
        $assignment->criteriaItems()->delete();

        $rows = collect($criteria)
            ->filter(fn($criterion) => is_array($criterion))
            ->map(function ($criterion, $index) {
                $text = trim((string) ($criterion['text'] ?? ''));
                if ($text === '') {
                    return null;
                }
                return [
                    'position' => (int) $index,
                    'text' => $text,
                    'max_points' => max(0, (int) ($criterion['max_points'] ?? 0)),
                ];
            })
            ->filter()
            ->values()
            ->all();

        if (!empty($rows)) {
            $assignment->criteriaItems()->createMany($rows);
        }
    }

    private function syncAllowedFormats(Assignment $assignment, array $allowedFormats): void
    {
        $assignment->allowedFormatItems()->delete();

        $rows = collect($allowedFormats)
            ->filter(fn($format) => is_string($format) && trim($format) !== '')
            ->map(fn($format) => ['format' => trim($format)])
            ->unique('format')
            ->values()
            ->all();

        if (!empty($rows)) {
            $assignment->allowedFormatItems()->createMany($rows);
        }
    }

    private function mergeCriteriaWithScores(array $criteria, array $criterionScores): array
    {
        if (empty($criteria)) {
            return collect($criterionScores)
                ->map(fn($item) => [
                    'text' => (string) ($item['text'] ?? ''),
                    'max_points' => (int) ($item['max_points'] ?? 0),
                    'received_points' => (int) ($item['received_points'] ?? 0),
                ])
                ->filter(fn($item) => $item['text'] !== '')
                ->values()
                ->all();
        }

        return collect($criteria)
            ->values()
            ->map(function ($criterion, $index) use ($criterionScores) {
                $score = $criterionScores[$index] ?? null;
                if (!is_array($score)) {
                    return $criterion;
                }

                $criterion['received_points'] = (int) ($score['received_points'] ?? 0);
                return $criterion;
            })
            ->all();
    }
}
