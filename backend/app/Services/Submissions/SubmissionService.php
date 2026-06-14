<?php

namespace App\Services\Submissions;

use App\Models\Assignment;
use App\Models\Submission;
use App\Models\User;
use App\Services\Assignments\AssignmentService as AssignmentsAssignmentService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Выдача списков сдач с фильтрами по роли: студент видит только свои, преподаватель — по своим заданиям (с проверкой доступа к студенту).
 * Вспомогательные правила файла (форматы, лимит МБ) и триггер пересчёта статуса задания после сдачи.
 */
class SubmissionService
{
    public const DEFAULT_ALLOWED_FORMATS = ['pdf', 'doc', 'docx', 'zip', 'rar'];

    public const DEFAULT_PER_PAGE = 20;

    /**
     * @param  array<string, mixed>  $validated
     * @return array<int|string, mixed>|list<mixed>
     */
    public function indexPayload(User $user, array $validated, int $requestedPage, int $perPage, bool $shouldPaginate): array
    {
        if ($user->role === 'student') {
            $query = Submission::where('student_id', $user->id);
        } elseif ($user->role === 'teacher') {
            $query = Submission::whereHas('assignment', fn ($q) => $q->where('teacher_id', $user->id));
        } else {
            $query = Submission::query();
        }

        $query->with([
            'assignment:id,title,subject_id,max_score,submission_type,deadline,teacher_id',
            'assignment.subject:id,name',
            'assignment.teacher:id,grade_scale',
            'student:id,login,group_id,last_name,first_name,middle_name',
            'student.studentGroup:id,name',
        ]);

        $this->scopeLatestSubmissionPerStudentAssignment($query, $user);

        if (! empty($validated['status'])) {
            $query->where('submissions.status', $validated['status']);
        } elseif (
            $user->role === 'teacher'
            && ($validated['list_context'] ?? null) !== 'full'
        ) {
            $query->whereIn('submissions.status', ['submitted', 'graded']);
        }

        if (! empty($validated['assignment_id'])) {
            $query->where('assignment_id', (int) $validated['assignment_id']);
        }
        if (! empty($validated['subject_id'])) {
            $query->whereHas('assignment', fn ($assignmentQuery) => $assignmentQuery->where('subject_id', (int) $validated['subject_id']));
        }

        if (! empty($validated['group_id'])) {
            $query->whereHas('student', fn ($studentQuery) => $studentQuery->where('group_id', (int) $validated['group_id']));
        }
        if (! empty($validated['student_id'])) {
            $sid = (int) $validated['student_id'];
            if ($user->role === 'teacher') {
                $stu = User::query()->where('id', $sid)->where('role', 'student')->first();
                if (! $stu || ! $stu->group_id) {
                    throw ValidationException::withMessages(['student_id' => 'Студент не найден.']);
                }
                $allowed = $user->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
                if (! in_array((int) $stu->group_id, $allowed, true)) {
                    throw ValidationException::withMessages(['student_id' => 'Нет доступа к этому студенту.']);
                }
            }
            $query->where('student_id', $sid);
        }
        if (! empty($validated['group'])) {
            $groupName = trim((string) $validated['group']);
            $query->whereHas('student.studentGroup', fn ($groupQuery) => $groupQuery->where('name', $groupName));
        }

        if (! empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(function ($builder) use ($term) {
                $builder
                    ->whereHas('assignment', fn ($assignmentQuery) => $assignmentQuery->where('title', 'like', "%{$term}%"))
                    ->orWhereHas('student', function ($studentQuery) use ($term) {
                        $studentQuery
                            ->where('login', 'like', "%{$term}%")
                            ->orWhere('last_name', 'like', "%{$term}%")
                            ->orWhere('first_name', 'like', "%{$term}%")
                            ->orWhere('middle_name', 'like', "%{$term}%");
                    })
                    ->orWhereHas('student.studentGroup', fn ($groupQuery) => $groupQuery->where('name', 'like', "%{$term}%"));
            });
        }

        $deadlineFilter = $validated['deadline_filter'] ?? 'all';
        if ($deadlineFilter !== 'all' && $deadlineFilter !== '') {
            $todayStart = now()->startOfDay();
            match ($deadlineFilter) {
                'overdue' => $query->whereExists(function ($sub) use ($todayStart) {
                    $sub->from('assignments')
                        ->whereColumn('assignments.id', 'submissions.assignment_id')
                        ->whereNotNull('assignments.deadline')
                        ->whereDate('assignments.deadline', '<', $todayStart)
                        ->where(function ($inner) {
                            $inner->where('submissions.status', '!=', 'graded')
                                ->orWhereRaw(
                                    'DATE(COALESCE(submissions.submitted_at, submissions.created_at)) > DATE(assignments.deadline)'
                                );
                        });
                }),
                'due_3d' => $query->whereHas('assignment', function ($assignmentQuery) use ($todayStart) {
                    $end = $todayStart->copy()->addDays(3)->endOfDay();
                    $assignmentQuery->whereNotNull('deadline')
                        ->whereBetween('deadline', [$todayStart, $end]);
                }),
                'due_week' => $query->whereHas('assignment', function ($assignmentQuery) use ($todayStart) {
                    $end = $todayStart->copy()->addDays(7)->endOfDay();
                    $assignmentQuery->whereNotNull('deadline')
                        ->whereBetween('deadline', [$todayStart, $end]);
                }),
                default => null,
            };
        }

        $sort = $validated['sort'] ?? 'newest';
        switch ($sort) {
            case 'review_queue':
                $todayDate = now()->toDateString();
                $query->join('assignments as _rq_assignments', '_rq_assignments.id', '=', 'submissions.assignment_id');
                $query->select('submissions.*');
                $query->orderByRaw("CASE submissions.status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END");
                $query->orderByRaw(
                    "CASE WHEN submissions.status = 'submitted' AND _rq_assignments.deadline IS NOT NULL AND DATE(_rq_assignments.deadline) < ? THEN 0 ELSE 1 END",
                    [$todayDate]
                );
                $query->orderByRaw('CASE WHEN _rq_assignments.deadline IS NULL THEN 1 ELSE 0 END');
                $query->orderBy('_rq_assignments.deadline', 'asc');
                $query->orderByDesc('submissions.is_resubmission');
                $query->orderBy('submissions.submitted_at', 'asc');
                $query->orderBy('submissions.id', 'asc');
                break;
            case 'oldest':
                $query->orderBy('submitted_at')->orderBy('created_at');
                break;
            case 'student_asc':
                $query->orderBy(
                    User::select('last_name')->whereColumn('users.id', 'submissions.student_id')
                )->orderBy(
                    User::select('first_name')->whereColumn('users.id', 'submissions.student_id')
                );
                break;
            case 'student_desc':
                $query->orderByDesc(
                    User::select('last_name')->whereColumn('users.id', 'submissions.student_id')
                )->orderByDesc(
                    User::select('first_name')->whereColumn('users.id', 'submissions.student_id')
                );
                break;
            case 'score_desc':
                $query->orderByDesc('score')->orderByDesc('submitted_at');
                break;
            case 'score_asc':
                $query->orderBy('score')->orderByDesc('submitted_at');
                break;
            case 'newest':
            default:
                $query->orderByDesc('submitted_at')->orderByDesc('created_at');
                break;
        }

        if ($shouldPaginate) {
            $paginated = $query->paginate($perPage, ['*'], 'page', $requestedPage);
            $paginated->getCollection()->transform(fn (Submission $submission) => $this->submissionPayload($submission));

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

        return $query->get()->map(fn (Submission $submission) => $this->submissionPayload($submission))->values()->all();
    }

    /** @return array<string, mixed> */
    public function submissionPayload(Submission $submission): array
    {
        $submission->loadMissing([
            'assignment:id,title,subject_id,max_score,submission_type,deadline,teacher_id',
            'assignment.subject:id,name',
            'assignment.teacher:id,grade_scale',
            'student:id,login,group_id,last_name,first_name,middle_name',
            'student.studentGroup:id,name',
        ]);

        return [
            'id' => $submission->id,
            'assignment_id' => $submission->assignment_id,
            'assignment_title' => $submission->assignment?->title ?? '',
            'subject_id' => $submission->assignment?->subject_id,
            'subject_name' => $submission->assignment?->subject?->name ?? '',
            'max_score' => $submission->assignment?->max_score ?? 100,
            'submission_type' => $submission->assignment?->submission_type ?? 'file',
            'assignment_deadline' => $submission->assignment?->deadline?->format('Y-m-d'),
            'student_id' => $submission->student_id,
            'student_name' => $submission->student?->full_name ?? '',
            'student_login' => $submission->student?->login ?? '',
            'group_id' => $submission->student?->group_id,
            'group_name' => $submission->student?->studentGroup?->name ?? '',
            'status' => $submission->status,
            'score' => $submission->score,
            'grade_label' => $submission->gradeLabel(),
            'comment' => $submission->comment,
            'teacher_comment' => $submission->teacher_comment,
            'criterion_scores' => $submission->criterion_scores,
            'file_name' => $submission->file_name,
            'file_size' => $submission->file_size,
            'file_type' => $submission->file_type,
            'is_resubmission' => $submission->is_resubmission,
            'submission_date' => $submission->submitted_at ?? $submission->created_at,
            'created_at' => $submission->created_at,
        ];
    }

    /**
     * В списках показываем только последнюю сдачу студента по заданию (актуальный статус после пересдачи).
     *
     * @param  \Illuminate\Database\Eloquent\Builder<Submission>  $query
     */
    private function scopeLatestSubmissionPerStudentAssignment($query, User $user): void
    {
        $latestIds = DB::table('submissions as s')
            ->when($user->role === 'teacher', function ($builder) use ($user) {
                $builder->join('assignments as a', 'a.id', '=', 's.assignment_id')
                    ->where('a.teacher_id', $user->id);
            })
            ->when($user->role === 'student', fn ($builder) => $builder->where('s.student_id', $user->id))
            ->selectRaw('MAX(s.id) as id')
            ->groupBy('s.assignment_id', 's.student_id');

        $query->whereIn('submissions.id', $latestIds);
    }

    public function formatFileSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }

        return round($bytes / 1024, 1) . ' KB';
    }

    public function syncAssignmentCompletionStatus(?Assignment $assignment): void
    {
        if (! $assignment) {
            return;
        }

        $metrics = app(AssignmentsAssignmentService::class)
            ->batchCompletionMetrics(collect([$assignment]))[(int) $assignment->id] ?? [
                'total_students' => 0,
                'submitted_students' => 0,
                'graded_students' => 0,
            ];

        $totalStudents = (int) ($metrics['total_students'] ?? 0);
        $submittedStudents = (int) ($metrics['submitted_students'] ?? 0);
        $gradedStudents = (int) ($metrics['graded_students'] ?? 0);

        $nextStatus = (
            $totalStudents > 0
            && $submittedStudents === $totalStudents
            && $gradedStudents === $totalStudents
        ) ? 'archived' : 'active';

        if ($assignment->status !== $nextStatus) {
            $assignment->update(['status' => $nextStatus]);
        }
    }

    /** @return list<string> */
    public function resolveAllowedFormats(Assignment $assignment): array
    {
        $formats = collect($assignment->allowed_formats ?? [])
            ->map(fn ($format) => mb_strtolower(trim((string) $format)))
            ->filter()
            ->map(fn ($format) => ltrim($format, '.'))
            ->filter(fn ($format) => preg_match('/^[a-z0-9]+$/', $format))
            ->unique()
            ->values()
            ->all();

        return ! empty($formats) ? $formats : self::DEFAULT_ALLOWED_FORMATS;
    }

    public function resolveMaxFileSizeKilobytes(Assignment $assignment): int
    {
        $maxFileSizeMb = (int) ($assignment->max_file_size ?? AssignmentsAssignmentService::DEFAULT_MAX_FILE_SIZE_MB);
        if ($maxFileSizeMb <= 0) {
            $maxFileSizeMb = AssignmentsAssignmentService::DEFAULT_MAX_FILE_SIZE_MB;
        }

        return $maxFileSizeMb * 1024;
    }
}
