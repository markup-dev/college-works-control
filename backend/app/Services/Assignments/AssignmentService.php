<?php

namespace App\Services\Assignments;

use App\Models\Assignment;
use App\Models\Group;
use App\Models\Subject;
use App\Models\TeachingLoad;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Бизнес-логика списков заданий: метаданные для форм преподавателя, фильтры и пагинация для студента/преподавателя/админа.
 * Тяжёлые выборки и подсчёты статусов сдач — здесь, чтобы контроллеры оставались тонкими.
 */
class AssignmentService
{
    public const DEFAULT_PER_PAGE = 9;

    /** @return array<string, mixed> */
    public function metaPayload(User $user): array
    {
        if ($user->role !== 'teacher') {
            return [
                'subjects' => [],
                'groups' => [],
            ];
        }

        $subjects = Subject::whereHas('teachingLoads', fn ($loadQuery) => $loadQuery
                ->where('teacher_id', $user->id)
                ->where('status', 'active'))
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name']);

        $groups = Group::query()
            ->whereIn('id', $user->attachedTeachingGroupIds())
            ->orderBy('name')
            ->get(['id', 'name']);

        $assignments = Assignment::where('teacher_id', $user->id)
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'status']);

        return [
            'subjects' => $subjects
                ->filter(fn ($subject) => ! empty($subject->name))
                ->map(fn ($subject) => [
                    'id' => (int) $subject->id,
                    'name' => (string) $subject->name,
                ])
                ->values()
                ->all(),
            'groups' => $groups
                ->filter(fn ($group) => ! empty($group->name))
                ->map(fn ($group) => [
                    'id' => (int) $group->id,
                    'name' => (string) $group->name,
                ])
                ->values()
                ->all(),
            'assignments' => $assignments
                ->filter(fn ($assignment) => ! empty($assignment->title))
                ->map(fn ($assignment) => [
                    'id' => (int) $assignment->id,
                    'title' => (string) $assignment->title,
                    'status' => (string) ($assignment->status ?? 'active'),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<int|string, mixed>|list<mixed>
     */
    public function indexPayload(User $user, array $validated, int $requestedPage, int $perPage, bool $shouldPaginate): array
    {
        if ($user->role === 'student') {
            if (! $user->group_id) {
                if ($shouldPaginate) {
                    return [
                        'data' => [],
                        'meta' => [
                            'current_page' => $requestedPage,
                            'last_page' => 1,
                            'per_page' => $perPage,
                            'total' => 0,
                            'counts' => [
                                'all' => 0,
                                'not_submitted' => 0,
                                'submitted' => 0,
                                'graded' => 0,
                                'returned' => 0,
                                'urgent' => 0,
                            ],
                        ],
                    ];
                }

                return [];
            }

            $query = Assignment::with([
                'teacher:id,login,last_name,first_name,middle_name,grade_scale',
                'subject:id,name',
                'groups:id,name',
                'submissions' => fn ($submissionQuery) => $submissionQuery
                    ->where('student_id', $user->id)
                    ->orderByDesc('submitted_at')
                    ->orderByDesc('id')
                    ->select(['id', 'assignment_id', 'student_id', 'status', 'score', 'teacher_comment', 'criterion_scores', 'submitted_at', 'is_resubmission']),
                'criteriaItems:id,assignment_id,position,text,max_points',
                'allowedFormatItems:id,assignment_id,format',
                'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
            ])
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $user->group_id))
                ->withCount([
                    'submissions',
                    'submissions as pending_count' => fn ($q) => $q->where('status', 'submitted'),
                ]);

            if (! empty($validated['search'])) {
                $term = trim((string) $validated['search']);
                $query->where(function ($builder) use ($term) {
                    $builder
                        ->where('title', 'like', "%{$term}%")
                        ->orWhereHas('subject', fn ($subjectQuery) => $subjectQuery->where('name', 'like', "%{$term}%"))
                        ->orWhereHas('teacher', function ($teacherQuery) use ($term) {
                            $teacherQuery
                                ->where('last_name', 'like', "%{$term}%")
                                ->orWhere('first_name', 'like', "%{$term}%")
                                ->orWhere('middle_name', 'like', "%{$term}%")
                                ->orWhere('login', 'like', "%{$term}%");
                        });
                });
            }

            if (! empty($validated['subject_id'])) {
                $query->where('subject_id', (int) $validated['subject_id']);
            }
            if (! empty($validated['subject'])) {
                $subjectName = trim((string) $validated['subject']);
                $query->whereHas('subject', fn ($subjectQuery) => $subjectQuery->where('name', $subjectName));
            }

            if (! empty($validated['teacher_id'])) {
                $query->where('teacher_id', (int) $validated['teacher_id']);
            }
            if (! empty($validated['teacher'])) {
                $this->applyTeacherTextFilter($query, (string) $validated['teacher']);
            }

            if (! empty($validated['group_id'])) {
                $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.id', (int) $validated['group_id']));
            }
            if (! empty($validated['group'])) {
                $groupName = trim((string) $validated['group']);
                $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.name', $groupName));
            }

            $query->orderBy('deadline');

            $assignments = $query->get();

            $transformed = $assignments->map(
                fn ($assignment) => $this->transformStudentAssignmentPayload($assignment, $user)
            );

            $counts = $this->buildStudentStatusCounts($transformed);

            if (! empty($validated['status'])) {
                $status = $validated['status'];
                $transformed = $transformed->filter(function ($assignment) use ($status) {
                    $assignmentStatus = (string) ($assignment['status'] ?? '');

                    if ($status === 'not_submitted') {
                        return $this->isStudentActionRequiredStatus($assignmentStatus);
                    }

                    if ($status === 'urgent') {
                        return $this->isStudentActionRequiredStatus($assignmentStatus)
                            && ! empty($assignment['deadline'])
                            && now()->diffInDays($assignment['deadline'], false) <= 3;
                    }

                    return $assignmentStatus === $status;
                })->values();
            }

            $transformed = $this->sortStudentAssignmentsByDefault($transformed);

            if ($shouldPaginate) {
                $total = $transformed->count();
                $lastPage = max(1, (int) ceil($total / $perPage));
                $page = min(max(1, $requestedPage), $lastPage);
                $items = $transformed->forPage($page, $perPage)->values()->all();

                return [
                    'data' => $items,
                    'meta' => [
                        'current_page' => $page,
                        'last_page' => $lastPage,
                        'per_page' => $perPage,
                        'total' => $total,
                        'counts' => $counts,
                    ],
                ];
            }

            return $transformed->values()->all();
        }

        if ($user->role === 'teacher') {
            $query = Assignment::where('teacher_id', $user->id);
        } else {
            $query = Assignment::query();
        }

        $query->with([
            'teacher:id,login,last_name,first_name,middle_name,grade_scale',
            'subject:id,name',
            'groups:id,name',
            'criteriaItems:id,assignment_id,position,text,max_points',
            'allowedFormatItems:id,assignment_id,format',
            'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
        ])
            ->withCount([
                'submissions',
                'submissions as pending_count' => fn ($q) => $q->where('status', 'submitted'),
            ]);

        if (! empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(function ($builder) use ($term) {
                $builder
                    ->where('title', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%")
                    ->orWhereHas('subject', fn ($subjectQuery) => $subjectQuery->where('name', 'like', "%{$term}%"));
            });
        }

        if (! empty($validated['status'])) {
            if ($validated['status'] === 'not_archived') {
                $query->whereIn('status', ['active', 'inactive']);
            } elseif (in_array($validated['status'], ['active', 'inactive', 'archived'], true)) {
                $query->where('status', $validated['status']);
            }
        }

        if (! empty($validated['subject_id'])) {
            $query->where('subject_id', (int) $validated['subject_id']);
        }
        if (! empty($validated['subject'])) {
            $subjectName = trim((string) $validated['subject']);
            $query->whereHas('subject', fn ($subjectQuery) => $subjectQuery->where('name', $subjectName));
        }

        if (! empty($validated['teacher_id'])) {
            $query->where('teacher_id', (int) $validated['teacher_id']);
        }
        if (! empty($validated['teacher'])) {
            $this->applyTeacherTextFilter($query, (string) $validated['teacher']);
        }

        if (! empty($validated['group_id'])) {
            $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.id', (int) $validated['group_id']));
        }
        if (! empty($validated['group'])) {
            $groupName = trim((string) $validated['group']);
            $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.name', $groupName));
        }

        if (! empty($validated['work_filter'])) {
            match ($validated['work_filter']) {
                'needs_review' => $query->whereHas('submissions', fn ($submissionQuery) => $submissionQuery->where('status', 'submitted')),
                'no_submissions' => $query->whereDoesntHave('submissions'),
                'all_reviewed' => $query
                    ->whereHas('submissions')
                    ->whereDoesntHave('submissions', fn ($submissionQuery) => $submissionQuery->where('status', 'submitted')),
                default => null,
            };
        }

        if (! empty($validated['deadline_filter'])) {
            $today = now()->startOfDay();
            match ($validated['deadline_filter']) {
                'overdue' => $query->whereNotNull('deadline')->whereDate('deadline', '<', $today->toDateString()),
                'due_3d' => $query->whereNotNull('deadline')
                    ->whereDate('deadline', '>=', $today->toDateString())
                    ->whereDate('deadline', '<=', $today->copy()->addDays(3)->toDateString()),
                'due_week' => $query->whereNotNull('deadline')
                    ->whereDate('deadline', '>=', $today->toDateString())
                    ->whereDate('deadline', '<=', $today->copy()->addDays(7)->toDateString()),
                'not_urgent' => $query->whereNotNull('deadline')
                    ->whereDate('deadline', '>', $today->copy()->addDays(7)->toDateString()),
                default => null,
            };
        }

        $sort = $validated['sort'] ?? 'deadline';
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
            default:
                $query->orderBy('deadline');
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

            return [
                'data' => $paginated->items(),
                'meta' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
            ];
        }

        return $query->get()->map($mapAssignment)->values()->all();
    }

    public function formatFileSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }

        return round($bytes / 1024, 1) . ' KB';
    }

    public function syncCriteria(Assignment $assignment, array $criteria): void
    {
        $assignment->criteriaItems()->delete();

        $rows = collect($criteria)
            ->filter(fn ($criterion) => is_array($criterion))
            ->map(function ($criterion, $index) {
                $text = trim((string) ($criterion['text'] ?? ''));
                if ($text === '') {
                    return null;
                }

                return [
                    'position' => (int) $index,
                    'text' => $text,
                    'max_points' => max(1, (int) ($criterion['max_points'] ?? 0)),
                ];
            })
            ->filter()
            ->values()
            ->all();

        if (! empty($rows)) {
            $assignment->criteriaItems()->createMany($rows);
        }
    }

    public function normalizeCriteriaInput(array $criteria): array
    {
        $rows = collect($criteria)
            ->filter(fn ($criterion) => is_array($criterion))
            ->map(function ($criterion, $index) {
                $text = trim((string) ($criterion['text'] ?? ''));
                if ($text === '') {
                    return null;
                }

                return [
                    'position' => (int) $index,
                    'text' => $text,
                    'max_points' => (int) ($criterion['max_points'] ?? $criterion['maxPoints'] ?? 0),
                ];
            })
            ->filter()
            ->values();

        if ($rows->isEmpty()) {
            return [];
        }

        if ($rows->contains(fn ($criterion) => $criterion['max_points'] < 1)) {
            throw ValidationException::withMessages([
                'criteria' => ['У каждого критерия должно быть минимум 1 балл.'],
            ]);
        }

        $total = $rows->sum('max_points');
        if ($total !== 100) {
            throw ValidationException::withMessages([
                'criteria' => ["Сумма баллов по критериям должна быть 100, сейчас {$total}."],
            ]);
        }

        return $rows->all();
    }

    public function syncAllowedFormats(Assignment $assignment, array $allowedFormats): void
    {
        $assignment->allowedFormatItems()->delete();

        $rows = collect($allowedFormats)
            ->filter(fn ($format) => is_string($format) && trim($format) !== '')
            ->map(fn ($format) => ['format' => trim($format)])
            ->unique('format')
            ->values()
            ->all();

        if (! empty($rows)) {
            $assignment->allowedFormatItems()->createMany($rows);
        }
    }

    /** @return array<string, mixed> */
    public function transformStudentAssignmentPayload(Assignment $assignment, User $student): array
    {
        if ($assignment->status === 'archived') {
            $assignment->syncCompletionStatus();
        }

        $studentSubmissions = $assignment->relationLoaded('submissions')
            ? $assignment->submissions
            : $assignment->submissions()
                ->where('student_id', $student->id)
                ->orderByDesc('submitted_at')
                ->orderByDesc('id')
                ->select(['id', 'assignment_id', 'student_id', 'status', 'score', 'teacher_comment', 'criterion_scores', 'submitted_at', 'is_resubmission'])
                ->get();

        $submission = $studentSubmissions->first();
        $retakeUsed = $studentSubmissions->contains(fn ($item) => (bool) $item->is_resubmission);
        $canSubmitFirstAttempt = ! $submission;
        $canSubmitRetake = (bool) ($submission && $submission->status === 'returned' && ! $retakeUsed);

        $data = $assignment->toArray();
        unset($data['teacher']);
        $data['is_completed'] = $assignment->status === 'archived';
        $data['status'] = $submission ? $submission->status : 'not_submitted';
        $data['score'] = $submission?->score;
        $data['grade_label'] = $submission?->gradeLabel();
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
    }

    private function mergeCriteriaWithScores(array $criteria, array $criterionScores): array
    {
        if (empty($criteria)) {
            return collect($criterionScores)
                ->map(fn ($item) => [
                    'text' => (string) ($item['text'] ?? ''),
                    'max_points' => (int) ($item['max_points'] ?? 0),
                    'received_points' => (int) ($item['received_points'] ?? 0),
                ])
                ->filter(fn ($item) => $item['text'] !== '')
                ->values()
                ->all();
        }

        return collect($criteria)
            ->values()
            ->map(function ($criterion, $index) use ($criterionScores) {
                $score = $criterionScores[$index] ?? null;
                if (! is_array($score)) {
                    return $criterion;
                }
                $criterion['received_points'] = (int) ($score['received_points'] ?? 0);

                return $criterion;
            })
            ->all();
    }

    private function sortStudentAssignmentsByDefault(Collection $assignments): Collection
    {
        return $assignments->sort(function ($a, $b) {
            $bucketA = $this->studentPriorityBucket($a);
            $bucketB = $this->studentPriorityBucket($b);
            if ($bucketA !== $bucketB) {
                return $bucketA <=> $bucketB;
            }

            if (in_array($bucketA, [0, 1, 2], true)) {
                return $this->timestampFromDate($a['deadline'] ?? null) <=> $this->timestampFromDate($b['deadline'] ?? null);
            }

            if (in_array($bucketA, [3, 4], true)) {
                return $this->timestampFromDate($b['submitted_at'] ?? null) <=> $this->timestampFromDate($a['submitted_at'] ?? null);
            }

            return strcasecmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''));
        })->values();
    }

    /** @param  Collection<int, array<string, mixed>>  $assignments */
    private function buildStudentStatusCounts(Collection $assignments): array
    {
        $all = $assignments->count();
        $notSubmitted = $assignments
            ->filter(fn ($assignment) => $this->isStudentActionRequiredStatus((string) ($assignment['status'] ?? '')))
            ->count();
        $submitted = $assignments->where('status', 'submitted')->count();
        $graded = $assignments->where('status', 'graded')->count();
        $returned = $assignments->where('status', 'returned')->count();
        $urgent = $assignments
            ->filter(fn ($assignment) => $this->isStudentActionRequiredStatus((string) ($assignment['status'] ?? '')))
            ->filter(fn ($assignment) => ($this->daysUntilDeadline($assignment['deadline'] ?? null) ?? 999) <= 3)
            ->count();

        return [
            'all' => $all,
            'not_submitted' => $notSubmitted,
            'submitted' => $submitted,
            'graded' => $graded,
            'returned' => $returned,
            'urgent' => $urgent,
        ];
    }

    private function isStudentActionRequiredStatus(string $status): bool
    {
        return in_array($status, ['not_submitted', 'returned'], true);
    }

    /** @param  array<string, mixed>  $assignment */
    private function studentPriorityBucket(array $assignment): int
    {
        $status = (string) ($assignment['status'] ?? 'not_submitted');
        $daysUntilDeadline = $this->daysUntilDeadline($assignment['deadline'] ?? null);

        if ($status === 'not_submitted' && $daysUntilDeadline !== null && $daysUntilDeadline <= 3) {
            return 0;
        }
        if ($status === 'returned') {
            return 1;
        }
        if ($status === 'not_submitted') {
            return 2;
        }
        if ($status === 'submitted') {
            return 3;
        }
        if ($status === 'graded') {
            return 4;
        }

        return 5;
    }

    private function daysUntilDeadline(mixed $value): ?int
    {
        $timestamp = $this->timestampFromDate($value);
        if ($timestamp <= 0) {
            return null;
        }

        $today = strtotime(date('Y-m-d'));

        return (int) floor(($timestamp - $today) / 86400);
    }

    private function timestampFromDate(mixed $value): int
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->getTimestamp();
        }

        $timestamp = strtotime((string) $value);

        return $timestamp !== false ? $timestamp : 0;
    }

    public function normalizeGroupName(string $name): string
    {
        $normalized = trim($name);
        $normalized = preg_replace('/\s+/u', ' ', $normalized) ?? $normalized;
        $normalized = str_replace(['—', '–', '−'], '-', $normalized);

        return mb_strtoupper($normalized);
    }

    public function resolveGroupIdByName(string $groupName, int $teacherId, int $subjectId): int
    {
        $exactGroup = Group::where('name', $groupName)
            ->whereHas('teachingLoads', fn ($loadQuery) => $loadQuery
                ->where('teacher_id', $teacherId)
                ->where('subject_id', $subjectId)
                ->where('status', 'active'))
            ->first();
        if ($exactGroup) {
            return (int) $exactGroup->id;
        }

        $normalizedExistingGroup = Group::whereHas('teachingLoads', fn ($loadQuery) => $loadQuery
                ->where('teacher_id', $teacherId)
                ->where('subject_id', $subjectId)
                ->where('status', 'active'))
            ->get(['id', 'name'])
            ->first(fn ($group) => $this->normalizeGroupName((string) $group->name) === $groupName);

        if ($normalizedExistingGroup) {
            return (int) $normalizedExistingGroup->id;
        }

        throw new \Illuminate\Http\Exceptions\HttpResponseException(response()->json([
            'message' => "Группа {$groupName} не назначена вам по выбранной дисциплине.",
        ], 422));
    }

    public function teacherCanTeachSubject(int $teacherId, int $subjectId): bool
    {
        return TeachingLoad::where('teacher_id', $teacherId)
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->exists();
    }

    /** @param  Builder<Assignment>  $query */
    public function applyTeacherTextFilter(Builder $query, string $teacherFilter): void
    {
        $teacherName = trim($teacherFilter);
        if ($teacherName === '') {
            return;
        }

        $tokens = collect(preg_split('/\s+/u', $teacherName) ?: [])
            ->map(fn ($token) => trim((string) $token))
            ->filter()
            ->values()
            ->all();

        $query->whereHas('teacher', function ($teacherQuery) use ($teacherName, $tokens) {
            $teacherQuery->where(function ($fullTextQuery) use ($teacherName) {
                $fullTextQuery
                    ->where('login', 'like', "%{$teacherName}%")
                    ->orWhere('last_name', 'like', "%{$teacherName}%")
                    ->orWhere('first_name', 'like', "%{$teacherName}%")
                    ->orWhere('middle_name', 'like', "%{$teacherName}%");
            });

            foreach ($tokens as $token) {
                $teacherQuery->where(function ($tokenQuery) use ($token) {
                    $tokenQuery
                        ->where('last_name', 'like', "%{$token}%")
                        ->orWhere('first_name', 'like', "%{$token}%")
                        ->orWhere('middle_name', 'like', "%{$token}%")
                        ->orWhere('login', 'like', "%{$token}%");
                });
            }
        });
    }
}
