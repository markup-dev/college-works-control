<?php

namespace App\Services\Teacher;

use App\Models\Assignment;
use App\Models\Group;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Данные для экрана преподавателя «мои студенты»: сводки по группам, прогресс по заданиям, детализация студента и группы.
 * Агрегации строятся на активной нагрузке и последних сдачах по парам студент–задание.
 */
class TeacherStudentService
{
    /** @return array{data: list<array<string, mixed>>} */
    public function studentsIndexData(User $teacher): array
    {
        $groupIds = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        if ($groupIds === []) {
            return ['data' => []];
        }

        $students = User::query()
            ->where('role', 'student')
            ->whereIn('group_id', $groupIds)
            ->with(['studentGroup:id,name'])
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get([
                'id', 'login', 'first_name', 'last_name', 'middle_name',
                'group_id', 'is_active', 'last_login',
            ]);

        $assignments = Assignment::query()
            ->where('teacher_id', $teacher->id)
            ->whereIn('status', ['active', 'inactive'])
            ->with('groups:id')
            ->get(['id', 'title', 'status', 'max_score', 'deadline']);

        $assignmentsByGroupId = [];
        foreach ($assignments as $assignment) {
            foreach ($assignment->groups as $group) {
                $gid = (int) $group->id;
                $assignmentsByGroupId[$gid] ??= [];
                $assignmentsByGroupId[$gid][$assignment->id] = true;
            }
        }

        $studentIds = $students->pluck('id')->all();
        $assignmentIds = $assignments->pluck('id')->all();

        $weekAgo = Carbon::now()->subDays(7);
        $submissionsWeekCounts = $studentIds === [] || $assignmentIds === []
            ? collect()
            : Submission::query()
                ->whereIn('student_id', $studentIds)
                ->where('submitted_at', '>=', $weekAgo)
                ->whereHas('assignment', fn ($q) => $q->where('teacher_id', $teacher->id))
                ->selectRaw('student_id, count(*) as cnt')
                ->groupBy('student_id')
                ->pluck('cnt', 'student_id');

        $latestByKey = [];
        if ($studentIds !== [] && $assignmentIds !== []) {
            $submissions = Submission::query()
                ->whereIn('student_id', $studentIds)
                ->whereIn('assignment_id', $assignmentIds)
                ->orderByDesc('id')
                ->get(['id', 'student_id', 'assignment_id', 'status', 'score', 'submitted_at']);

            foreach ($submissions as $sub) {
                $key = $sub->student_id . ':' . $sub->assignment_id;
                if (! isset($latestByKey[$key])) {
                    $latestByKey[$key] = $sub;
                }
            }
        }

        $data = [];
        foreach ($students as $student) {
            $gid = $student->group_id ? (int) $student->group_id : null;
            $relevantIds = $gid && isset($assignmentsByGroupId[$gid])
                ? array_keys($assignmentsByGroupId[$gid])
                : [];

            $submitted = 0;
            $missing = 0;
            $scoresGraded = [];

            foreach ($relevantIds as $aid) {
                $key = $student->id . ':' . $aid;
                if (isset($latestByKey[$key])) {
                    $sub = $latestByKey[$key];
                    $submitted++;
                    if ($sub->status === 'graded' && $sub->score !== null) {
                        $scoresGraded[] = (int) $sub->score;
                    }
                } else {
                    $missing++;
                }
            }

            $avg = $scoresGraded === []
                ? null
                : round(array_sum($scoresGraded) / count($scoresGraded), 1);

            $data[] = [
                'id' => $student->id,
                'fullName' => $student->full_name,
                'groupId' => $student->group_id,
                'groupName' => $student->studentGroup->name ?? '',
                'isActive' => (bool) $student->is_active,
                'lastLogin' => $student->last_login?->toIso8601String(),
                'submittedCount' => $submitted,
                'missingCount' => $missing,
                'relevantAssignmentsCount' => count($relevantIds),
                'averageScore' => $avg,
                'submissionsLastWeek' => (int) ($submissionsWeekCounts[$student->id] ?? 0),
            ];
        }

        return ['data' => $data];
    }

    /** @return array{student: array<string, mixed>, averageScore: float|null, assignments: list<array<string, mixed>>} */
    public function studentShowData(User $teacher, User $user): array
    {
        $user->loadMissing('studentGroup:id,name');
        $g = $user->group_id ? (int) $user->group_id : null;

        $assignments = Assignment::query()
            ->where('teacher_id', $teacher->id)
            ->whereIn('status', ['active', 'inactive'])
            ->whereHas('groups', fn ($q) => $q->where('groups.id', $g))
            ->orderByDesc('deadline')
            ->orderByDesc('id')
            ->get(['id', 'title', 'deadline', 'status', 'max_score']);

        $assignmentIds = $assignments->pluck('id')->all();
        $latest = [];
        if ($assignmentIds !== []) {
            $subs = Submission::query()
                ->where('student_id', $user->id)
                ->whereIn('assignment_id', $assignmentIds)
                ->orderByDesc('id')
                ->get(['id', 'assignment_id', 'status', 'score', 'submitted_at']);

            foreach ($subs as $sub) {
                if (! isset($latest[$sub->assignment_id])) {
                    $latest[$sub->assignment_id] = $sub;
                }
            }
        }

        $rows = $assignments->map(function (Assignment $a) use ($latest) {
            $s = $latest[$a->id] ?? null;

            return [
                'assignmentId' => $a->id,
                'title' => $a->title,
                'deadline' => $a->deadline?->format('Y-m-d'),
                'assignmentStatus' => $a->status,
                'maxScore' => (int) $a->max_score,
                'submissionId' => $s?->id,
                'submissionStatus' => $s ? $s->status : 'not_submitted',
                'score' => $s?->score,
                'submittedAt' => $s?->submitted_at?->toIso8601String(),
            ];
        });

        $gradedScores = $rows
            ->filter(fn ($r) => ($r['submissionStatus'] ?? '') === 'graded' && $r['score'] !== null)
            ->pluck('score');
        $average = $gradedScores->isEmpty()
            ? null
            : round($gradedScores->avg(), 1);

        return [
            'student' => [
                'id' => $user->id,
                'fullName' => $user->full_name,
                'groupName' => $user->studentGroup->name ?? '',
            ],
            'averageScore' => $average,
            'assignments' => $rows->values()->all(),
        ];
    }

    /** @return array{data: list<array<string, mixed>>} */
    public function groupsOverviewData(User $teacher): array
    {
        $groupIds = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        if ($groupIds === []) {
            return ['data' => []];
        }

        $groups = Group::query()
            ->whereIn('id', $groupIds)
            ->withCount(['students as students_count' => fn ($q) => $q->where('role', 'student')])
            ->orderBy('name')
            ->get(['id', 'name']);

        $assignmentsForStats = Assignment::query()
            ->where('teacher_id', $teacher->id)
            ->whereIn('status', ['active', 'inactive'])
            ->with(['groups:id', 'subject:id,name'])
            ->get(['id', 'subject_id']);

        $groupAssignmentIds = [];
        $groupSubjectStats = [];
        foreach ($assignmentsForStats as $assignment) {
            foreach ($assignment->groups as $group) {
                $gid = (int) $group->id;
                $groupAssignmentIds[$gid] ??= [];
                $groupAssignmentIds[$gid][$assignment->id] = true;

                $subjectKey = (int) ($assignment->subject_id ?? 0);
                $subjectName = $assignment->subject?->name ?: 'Без предмета';
                $groupSubjectStats[$gid] ??= [];
                $groupSubjectStats[$gid][$subjectKey] ??= ['subjectId' => $subjectKey, 'subjectName' => $subjectName, 'assignmentsCount' => 0];
                $groupSubjectStats[$gid][$subjectKey]['assignmentsCount']++;
            }
        }

        $studentsByGroup = User::query()
            ->where('role', 'student')
            ->whereIn('group_id', $groupIds)
            ->get(['id', 'group_id'])
            ->groupBy('group_id');

        $allStudentIds = $studentsByGroup->flatten(1)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $allAssignmentIds = collect($groupAssignmentIds)->flatMap(fn ($ids) => array_keys($ids))->unique()->values()->all();
        $latestMap = $this->latestSubmissionsMap($allStudentIds, $allAssignmentIds);

        $data = $groups->map(function (Group $group) use ($groupAssignmentIds, $studentsByGroup, $latestMap, $groupSubjectStats) {
            $gid = (int) $group->id;
            $studentIds = ($studentsByGroup[$gid] ?? collect())->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
            $assignmentIds = isset($groupAssignmentIds[$gid]) ? array_keys($groupAssignmentIds[$gid]) : [];

            $debtors = 0;
            $onReview = 0;
            $graded = 0;
            $returned = 0;

            foreach ($studentIds as $studentId) {
                $hasDebt = false;
                foreach ($assignmentIds as $assignmentId) {
                    $key = $studentId . ':' . $assignmentId;
                    $submission = $latestMap[$key] ?? null;
                    if (! $submission) {
                        $hasDebt = true;
                        continue;
                    }

                    if ($submission->status === 'submitted') {
                        $onReview++;
                    } elseif ($submission->status === 'graded') {
                        $graded++;
                    } elseif ($submission->status === 'returned') {
                        $returned++;
                    }
                }
                if ($hasDebt) {
                    $debtors++;
                }
            }

            return [
                'id' => $gid,
                'name' => $group->name,
                'studentsCount' => (int) $group->students_count,
                'assignmentsCount' => count($assignmentIds),
                'debtorsCount' => $debtors,
                'onReviewCount' => $onReview,
                'gradedCount' => $graded,
                'returnedCount' => $returned,
                'subjects' => array_values($groupSubjectStats[$gid] ?? []),
            ];
        })->values();

        return ['data' => $data->all()];
    }

    /**
     * @return array{
     *     group: array{id: int, name: string},
     *     filters: array{subjects: list<array<string, mixed>>, assignments: list<array<string, mixed>>},
     *     students: list<array<string, mixed>>
     * }
     */
    public function groupDetailsData(
        User $teacher,
        Group $group,
        int $subjectId,
        int $assignmentId,
        bool $debtOnly,
        string $search,
    ): array {
        $assignmentsQuery = Assignment::query()
            ->where('teacher_id', $teacher->id)
            ->whereIn('status', ['active', 'inactive'])
            ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id))
            ->with('subject:id,name')
            ->orderByDesc('deadline')
            ->orderByDesc('id');

        if ($subjectId > 0) {
            $assignmentsQuery->where('subject_id', $subjectId);
        }
        if ($assignmentId > 0) {
            $assignmentsQuery->where('id', $assignmentId);
        }

        $assignments = $assignmentsQuery->get(['id', 'title', 'subject_id', 'deadline', 'status', 'max_score']);
        $assignmentIds = $assignments->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        $studentsQuery = User::query()
            ->where('role', 'student')
            ->where('group_id', $group->id)
            ->orderBy('last_name')
            ->orderBy('first_name');
        if ($search !== '') {
            $studentsQuery->where(function ($q) use ($search) {
                $q->where('last_name', 'like', "%{$search}%")
                    ->orWhere('first_name', 'like', "%{$search}%")
                    ->orWhere('middle_name', 'like', "%{$search}%")
                    ->orWhere('login', 'like', "%{$search}%");
            });
        }
        $students = $studentsQuery->get(['id', 'login', 'first_name', 'last_name', 'middle_name', 'is_active', 'last_login']);
        $studentIds = $students->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        $latestMap = $this->latestSubmissionsMap($studentIds, $assignmentIds);
        $subjects = $assignments
            ->map(fn (Assignment $a) => [
                'id' => (int) ($a->subject_id ?? 0),
                'name' => $a->subject?->name ?: 'Без предмета',
            ])
            ->unique('id')
            ->sortBy('name')
            ->values()
            ->all();
        $assignmentOptions = $assignments
            ->map(fn (Assignment $a) => [
                'id' => (int) $a->id,
                'title' => $a->title,
                'subjectId' => (int) ($a->subject_id ?? 0),
            ])
            ->values()
            ->all();
        $assignmentDeadlineById = $assignments
            ->mapWithKeys(fn (Assignment $a) => [(int) $a->id => $a->deadline?->format('Y-m-d')])
            ->all();

        $assignmentMeta = $assignments
            ->mapWithKeys(fn (Assignment $a) => [
                (int) $a->id => [
                    'title' => $a->title,
                    'subjectName' => $a->subject?->name ?: 'Без предмета',
                ],
            ])
            ->all();

        $studentRows = $students->map(function (User $student) use ($assignmentIds, $latestMap, $debtOnly, $assignmentDeadlineById, $assignmentMeta) {
            $submitted = 0;
            $debt = 0;
            $onReview = 0;
            $graded = 0;
            $returned = 0;
            $nearestDebtDeadline = null;
            $debtItems = [];

            foreach ($assignmentIds as $aid) {
                $submission = $latestMap[$student->id . ':' . $aid] ?? null;
                if (! $submission) {
                    $debt++;
                    $meta = $assignmentMeta[$aid] ?? ['title' => '', 'subjectName' => 'Без предмета'];
                    $debtItems[] = [
                        'subjectName' => $meta['subjectName'],
                        'assignmentTitle' => $meta['title'],
                    ];
                    $deadline = $assignmentDeadlineById[$aid] ?? null;
                    if ($deadline !== null && ($nearestDebtDeadline === null || $deadline < $nearestDebtDeadline)) {
                        $nearestDebtDeadline = $deadline;
                    }
                    continue;
                }
                $submitted++;
                if ($submission->status === 'submitted') {
                    $onReview++;
                } elseif ($submission->status === 'graded') {
                    $graded++;
                } elseif ($submission->status === 'returned') {
                    $returned++;
                }
            }

            if ($debtOnly && $debt < 1) {
                return null;
            }

            usort($debtItems, function (array $a, array $b): int {
                $c = strcmp($a['subjectName'], $b['subjectName']);

                return $c !== 0 ? $c : strcmp($a['assignmentTitle'], $b['assignmentTitle']);
            });

            return [
                'id' => (int) $student->id,
                'fullName' => $student->full_name,
                'login' => $student->login,
                'isActive' => (bool) $student->is_active,
                'lastLogin' => $student->last_login?->toIso8601String(),
                'assignmentsCount' => count($assignmentIds),
                'submittedCount' => $submitted,
                'debtCount' => $debt,
                'onReviewCount' => $onReview,
                'gradedCount' => $graded,
                'returnedCount' => $returned,
                'nearestDebtDeadline' => $nearestDebtDeadline,
                'debtItems' => $debtItems,
            ];
        })->filter()->values()->all();

        return [
            'group' => [
                'id' => (int) $group->id,
                'name' => $group->name,
            ],
            'filters' => [
                'subjects' => $subjects,
                'assignments' => $assignmentOptions,
            ],
            'students' => $studentRows,
        ];
    }

    /**
     * @return array{
     *     group: array{id: int, name: string},
     *     student: array<string, mixed>,
     *     filters: array{subjects: list<array<string, mixed>>},
     *     stats: array<string, int>,
     *     assignments: list<array<string, mixed>>
     * }
     */
    public function studentDetailsData(
        User $teacher,
        Group $group,
        User $user,
        int $subjectId,
        string $status,
        bool $debtOnly,
        int $periodDays,
    ): array {
        $assignmentsQuery = Assignment::query()
            ->where('teacher_id', $teacher->id)
            ->whereIn('status', ['active', 'inactive'])
            ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id))
            ->with('subject:id,name')
            ->orderByDesc('deadline')
            ->orderByDesc('id');

        if ($subjectId > 0) {
            $assignmentsQuery->where('subject_id', $subjectId);
        }
        if ($periodDays > 0) {
            $date = Carbon::now()->subDays($periodDays)->startOfDay();
            $assignmentsQuery->whereDate('deadline', '>=', $date->toDateString());
        }

        $assignments = $assignmentsQuery->get(['id', 'title', 'subject_id', 'deadline', 'status', 'max_score']);
        $assignmentIds = $assignments->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $latestMap = $this->latestSubmissionsMap([(int) $user->id], $assignmentIds);

        $rows = $assignments->map(function (Assignment $assignment) use ($latestMap, $user, $status, $debtOnly) {
            $submission = $latestMap[$user->id . ':' . $assignment->id] ?? null;
            $submissionStatus = $submission?->status ?: 'not_submitted';

            if ($status !== 'all' && $submissionStatus !== $status) {
                return null;
            }
            if ($debtOnly && $submissionStatus !== 'not_submitted') {
                return null;
            }

            return [
                'assignmentId' => (int) $assignment->id,
                'title' => $assignment->title,
                'subjectId' => (int) ($assignment->subject_id ?? 0),
                'subjectName' => $assignment->subject?->name ?: 'Без предмета',
                'deadline' => $assignment->deadline?->format('Y-m-d'),
                'maxScore' => (int) $assignment->max_score,
                'submissionId' => $submission?->id,
                'submissionStatus' => $submissionStatus,
                'score' => $submission?->score,
                'submittedAt' => $submission?->submitted_at?->toIso8601String(),
            ];
        })->filter()->values();

        $subjects = $assignments
            ->map(fn (Assignment $a) => ['id' => (int) ($a->subject_id ?? 0), 'name' => $a->subject?->name ?: 'Без предмета'])
            ->unique('id')
            ->sortBy('name')
            ->values()
            ->all();

        return [
            'group' => ['id' => (int) $group->id, 'name' => $group->name],
            'student' => [
                'id' => (int) $user->id,
                'fullName' => $user->full_name,
                'login' => $user->login,
            ],
            'filters' => ['subjects' => $subjects],
            'stats' => [
                'total' => $rows->count(),
                'debts' => $rows->where('submissionStatus', 'not_submitted')->count(),
                'onReview' => $rows->where('submissionStatus', 'submitted')->count(),
                'graded' => $rows->where('submissionStatus', 'graded')->count(),
                'returned' => $rows->where('submissionStatus', 'returned')->count(),
            ],
            'assignments' => $rows->all(),
        ];
    }

    /** @return array<string, Submission> */
    private function latestSubmissionsMap(array $studentIds, array $assignmentIds): array
    {
        if ($studentIds === [] || $assignmentIds === []) {
            return [];
        }

        $map = [];
        $submissions = Submission::query()
            ->whereIn('student_id', $studentIds)
            ->whereIn('assignment_id', $assignmentIds)
            ->orderByDesc('id')
            ->get(['id', 'student_id', 'assignment_id', 'status', 'score', 'submitted_at']);

        foreach ($submissions as $submission) {
            $key = $submission->student_id . ':' . $submission->assignment_id;
            if (! isset($map[$key])) {
                $map[$key] = $submission;
            }
        }

        return $map;
    }
}
