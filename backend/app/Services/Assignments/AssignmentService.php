<?php

namespace App\Services\Assignments;

use App\Models\Assignment;
use App\Models\Group;
use App\Models\Subject;
use App\Models\TeachingLoad;
use App\Models\TeacherSubject;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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

        $subjects = Subject::whereHas('teacherSubjects', fn ($permissionQuery) => $permissionQuery
                ->where('teacher_id', $user->id)
                ->where('status', 'active'))
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name']);

        $groups = Group::query()
            ->whereIn('id', $user->attachedTeachingGroupIds())
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name']);

        $teachingLoads = TeachingLoad::query()
            ->where('teacher_id', $user->id)
            ->where('status', 'active')
            ->whereHas('subject', fn ($subjectQuery) => $subjectQuery->where('status', 'active'))
            ->whereHas('group', fn ($groupQuery) => $groupQuery->where('status', 'active'))
            ->with(['subject:id,name', 'group:id,name'])
            ->get(['id', 'subject_id', 'group_id']);

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
            'teaching_loads' => $teachingLoads
                ->filter(fn ($load) => $load->subject && $load->group && ! empty($load->subject->name) && ! empty($load->group->name))
                ->map(fn ($load) => [
                    'id' => (int) $load->id,
                    'subject_id' => (int) $load->subject_id,
                    'subject_name' => (string) $load->subject->name,
                    'group_id' => (int) $load->group_id,
                    'group_name' => (string) $load->group->name,
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
                        ->orWhere('description', 'like', "%{$term}%")
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

            if (! empty($validated['submission_type'])) {
                $query->where('submission_type', (string) $validated['submission_type']);
            }

            if (! empty($validated['group_id'])) {
                $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.id', (int) $validated['group_id']));
            }
            if (! empty($validated['group'])) {
                $groupName = trim((string) $validated['group']);
                $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('groups.name', $groupName));
            }

            $query->orderBy('deadline');

            $counts = $this->buildStudentStatusCountsFromDb($user);

            if (! empty($validated['status'])) {
                $this->applyStudentListStatusFilter($query, $user, (string) $validated['status']);
            }

            if ($shouldPaginate) {
                $paginated = $query->paginate($perPage, ['*'], 'page', $requestedPage);
                $items = collect($paginated->items())
                    ->map(fn ($assignment) => $this->transformStudentAssignmentPayload($assignment, $user))
                    ->values()
                    ->all();

                return [
                    'data' => $items,
                    'meta' => [
                        'current_page' => $paginated->currentPage(),
                        'last_page' => $paginated->lastPage(),
                        'per_page' => $paginated->perPage(),
                        'total' => $paginated->total(),
                        'counts' => $counts,
                    ],
                ];
            }

            $transformed = $query->get()
                ->map(fn ($assignment) => $this->transformStudentAssignmentPayload($assignment, $user));

            return $this->sortStudentAssignmentsByDefault($transformed)->values()->all();
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
                $query->where('status', 'active');
            } elseif (in_array($validated['status'], ['active', 'archived'], true)) {
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

        if ($shouldPaginate) {
            $paginated = $query->paginate($perPage, ['*'], 'page', $requestedPage);
            $collection = $paginated->getCollection();
            $metricsByAssignment = $this->batchCompletionMetrics($collection);
            $collection->transform(function ($assignment) use ($metricsByAssignment) {
                return $this->mapAssignmentForIndex(
                    $assignment,
                    $metricsByAssignment[(int) $assignment->id] ?? null,
                );
            });

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

        $assignments = $query->get();
        $metricsByAssignment = $this->batchCompletionMetrics($assignments);

        return $assignments
            ->map(fn ($assignment) => $this->mapAssignmentForIndex(
                $assignment,
                $metricsByAssignment[(int) $assignment->id] ?? null,
            ))
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    public function mapCreatedAssignmentResponse(Assignment $assignment): array
    {
        $metrics = $this->batchCompletionMetrics(collect([$assignment]));

        return $this->mapAssignmentForIndex(
            $assignment,
            $metrics[(int) $assignment->id] ?? null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function mapAssignmentForIndex(Assignment $assignment, ?array $metrics = null): array
    {
        $data = $assignment->toArray();
        unset($data['teacher']);
        $data['teacher'] = $assignment->teacher?->full_name ?? 'Не указан';
        $data['is_completed'] = $assignment->status === 'archived';

        return [
            ...$data,
            ...($metrics ?? $assignment->calculateCompletionMetrics()),
        ];
    }

    /**
     * Агрегированные метрики сдачи для списка заданий — без N+1 запросов и без записи в БД.
     *
     * @param  Collection<int, Assignment>|iterable<Assignment>  $assignments
     * @return array<int, array<string, int>>
     */
    public function batchCompletionMetrics(iterable $assignments): array
    {
        $assignmentIds = collect($assignments)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        if ($assignmentIds->isEmpty()) {
            return [];
        }

        $defaultMetrics = [
            'total_students' => 0,
            'submitted_students' => 0,
            'graded_students' => 0,
            'pending_students' => 0,
            'returned_students' => 0,
            'completion_rate' => 0,
        ];

        $metricsByAssignment = $assignmentIds
            ->mapWithKeys(fn ($id) => [$id => $defaultMetrics])
            ->all();

        $targetStudents = DB::table('assignment_group as ag')
            ->join('users as u', function ($join) {
                $join->on('u.group_id', '=', 'ag.group_id')
                    ->where('u.role', '=', 'student')
                    ->where('u.is_active', '=', true);
            })
            ->whereIn('ag.assignment_id', $assignmentIds)
            ->select(['ag.assignment_id', 'u.id as student_id'])
            ->get();

        foreach ($targetStudents->groupBy('assignment_id') as $assignmentId => $rows) {
            $metricsByAssignment[(int) $assignmentId]['total_students'] = $rows
                ->pluck('student_id')
                ->unique()
                ->count();
        }

        $latestSubmissionIds = DB::table('submissions')
            ->selectRaw('MAX(id) as id')
            ->whereIn('assignment_id', $assignmentIds)
            ->groupBy('assignment_id', 'student_id');

        $latestSubmissions = DB::table('submissions as s')
            ->joinSub($latestSubmissionIds, 'latest', fn ($join) => $join->on('s.id', '=', 'latest.id'))
            ->select(['s.assignment_id', 's.student_id', 's.status'])
            ->get();

        $targetKeys = $targetStudents
            ->map(fn ($row) => ((int) $row->assignment_id).':'.((int) $row->student_id))
            ->flip();

        foreach ($latestSubmissions as $submission) {
            $assignmentId = (int) $submission->assignment_id;
            $studentId = (int) $submission->student_id;
            $targetKey = $assignmentId.':'.$studentId;

            if (! isset($targetKeys[$targetKey], $metricsByAssignment[$assignmentId])) {
                continue;
            }

            $metricsByAssignment[$assignmentId]['submitted_students']++;

            match ($submission->status) {
                'graded' => $metricsByAssignment[$assignmentId]['graded_students']++,
                'submitted' => $metricsByAssignment[$assignmentId]['pending_students']++,
                'returned' => $metricsByAssignment[$assignmentId]['returned_students']++,
                default => null,
            };
        }

        foreach ($metricsByAssignment as $assignmentId => &$metrics) {
            $totalStudents = (int) $metrics['total_students'];
            $submittedStudents = (int) $metrics['submitted_students'];
            $metrics['completion_rate'] = $totalStudents > 0
                ? (int) round(($submittedStudents / $totalStudents) * 100)
                : 0;
        }
        unset($metrics);

        return $metricsByAssignment;
    }

    /**
     * @param  Collection<int, Assignment>|iterable<Assignment>  $assignments
     * @return array<int, float|null>
     */
    public function batchAverageGradedScores(iterable $assignments): array
    {
        $assignmentIds = collect($assignments)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        if ($assignmentIds->isEmpty()) {
            return [];
        }

        $latestSubmissionIds = DB::table('submissions')
            ->selectRaw('MAX(id) as id')
            ->whereIn('assignment_id', $assignmentIds)
            ->groupBy('assignment_id', 'student_id');

        return DB::table('submissions as s')
            ->joinSub($latestSubmissionIds, 'latest', fn ($join) => $join->on('s.id', '=', 'latest.id'))
            ->whereIn('s.assignment_id', $assignmentIds)
            ->where('s.status', 'graded')
            ->whereNotNull('s.score')
            ->groupBy('s.assignment_id')
            ->selectRaw('s.assignment_id, AVG(s.score) as avg_score')
            ->pluck('avg_score', 'assignment_id')
            ->map(fn ($avg) => round((float) $avg, 1))
            ->all();
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

    /** @param  Builder<Assignment>  $query */
    private function applyStudentListStatusFilter(Builder $query, User $student, string $status): void
    {
        $studentId = (int) $student->id;

        if ($status === 'urgent') {
            $today = now()->startOfDay();
            $urgentDeadline = $today->copy()->addDays(3)->toDateString();
            $query->whereNotNull('deadline')
                ->whereDate('deadline', '<=', $urgentDeadline)
                ->where(function (Builder $builder) use ($studentId) {
                    $builder->whereDoesntHave(
                        'submissions',
                        fn (Builder $submissionQuery) => $submissionQuery->where('student_id', $studentId),
                    )->orWhereIn('assignments.id', $this->latestStudentSubmissionAssignmentIds($studentId, ['returned']));
                });

            return;
        }

        if ($status === 'not_submitted') {
            $query->where(function (Builder $builder) use ($studentId) {
                $builder->whereDoesntHave(
                    'submissions',
                    fn (Builder $submissionQuery) => $submissionQuery->where('student_id', $studentId),
                )->orWhereIn('assignments.id', $this->latestStudentSubmissionAssignmentIds($studentId, ['returned']));
            });

            return;
        }

        if (in_array($status, ['submitted', 'graded', 'returned'], true)) {
            $query->whereIn('assignments.id', $this->latestStudentSubmissionAssignmentIds($studentId, [$status]));
        }
    }

    /**
     * @param  list<string>  $statuses
     * @return list<int>
     */
    private function latestStudentSubmissionAssignmentIds(int $studentId, array $statuses): array
    {
        $latestSubmissionIds = DB::table('submissions')
            ->selectRaw('MAX(id) as id')
            ->where('student_id', $studentId)
            ->groupBy('assignment_id');

        return DB::table('submissions as s')
            ->joinSub($latestSubmissionIds, 'latest', fn ($join) => $join->on('s.id', '=', 'latest.id'))
            ->whereIn('s.status', $statuses)
            ->pluck('s.assignment_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /** @return array<string, int> */
    private function buildStudentStatusCountsFromDb(User $student): array
    {
        if (! $student->group_id) {
            return [
                'all' => 0,
                'not_submitted' => 0,
                'submitted' => 0,
                'graded' => 0,
                'returned' => 0,
                'urgent' => 0,
            ];
        }

        $base = Assignment::query()
            ->whereHas('groups', fn (Builder $groupQuery) => $groupQuery->where('groups.id', $student->group_id));

        $all = (clone $base)->count();
        $submitted = (clone $base)->whereIn('assignments.id', $this->latestStudentSubmissionAssignmentIds((int) $student->id, ['submitted']))->count();
        $graded = (clone $base)->whereIn('assignments.id', $this->latestStudentSubmissionAssignmentIds((int) $student->id, ['graded']))->count();
        $returned = (clone $base)->whereIn('assignments.id', $this->latestStudentSubmissionAssignmentIds((int) $student->id, ['returned']))->count();

        $notSubmittedQuery = clone $base;
        $this->applyStudentListStatusFilter($notSubmittedQuery, $student, 'not_submitted');
        $notSubmitted = $notSubmittedQuery->count();

        $urgentQuery = clone $base;
        $this->applyStudentListStatusFilter($urgentQuery, $student, 'urgent');
        $urgent = $urgentQuery->count();

        return [
            'all' => $all,
            'not_submitted' => $notSubmitted,
            'submitted' => $submitted,
            'graded' => $graded,
            'returned' => $returned,
            'urgent' => $urgent,
        ];
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
        $resolved = $this->resolveGroupIdsByNames([$groupName], $teacherId, $subjectId);

        return (int) $resolved[0];
    }

    /**
     * @param  list<string>  $groupNames
     * @return list<int>
     */
    public function resolveGroupIdsByNames(array $groupNames, int $teacherId, int $subjectId): array
    {
        $normalizedNames = collect($groupNames)
            ->map(fn ($name) => $this->normalizeGroupName((string) $name))
            ->filter()
            ->unique()
            ->values();

        if ($normalizedNames->isEmpty()) {
            return [];
        }

        $groups = Group::query()
            ->whereHas('teachingLoads', fn ($loadQuery) => $loadQuery
                ->where('teacher_id', $teacherId)
                ->where('subject_id', $subjectId)
                ->where('status', 'active'))
            ->get(['id', 'name']);

        $groupsByNormalizedName = $groups->keyBy(
            fn (Group $group) => $this->normalizeGroupName((string) $group->name),
        );

        $ids = [];
        foreach ($normalizedNames as $groupName) {
            $group = $groupsByNormalizedName->get($groupName);
            if (! $group) {
                throw new \Illuminate\Http\Exceptions\HttpResponseException(response()->json([
                    'message' => "Группа {$groupName} не назначена вам по выбранной дисциплине.",
                ], 422));
            }

            $ids[] = (int) $group->id;
        }

        return array_values(array_unique($ids));
    }

    public function teacherCanTeachSubject(int $teacherId, int $subjectId): bool
    {
        return TeacherSubject::where('teacher_id', $teacherId)
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->whereHas('subject', fn ($query) => $query->where('status', 'active'))
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
