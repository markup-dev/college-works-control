<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\Group;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class TeacherStudentController extends Controller
{
    public function index(Request $request)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher') {
            abort(403);
        }

        $groupIds = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        if ($groupIds === []) {
            return response()->json(['data' => []]);
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

        return response()->json(['data' => $data]);
    }

    public function show(Request $request, User $user)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher' || $user->role !== 'student') {
            abort(404);
        }

        $allowed = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        $g = $user->group_id ? (int) $user->group_id : null;
        if (! $g || ! in_array($g, $allowed, true)) {
            abort(403, 'Нет доступа к данному студенту.');
        }

        $user->loadMissing('studentGroup:id,name');

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

        return response()->json([
            'student' => [
                'id' => $user->id,
                'fullName' => $user->full_name,
                'groupName' => $user->studentGroup->name ?? '',
            ],
            'averageScore' => $average,
            'assignments' => $rows->values()->all(),
        ]);
    }

    public function groupsOverview(Request $request)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher') {
            abort(403);
        }

        $groupIds = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        if ($groupIds === []) {
            return response()->json(['data' => []]);
        }

        $groups = Group::query()
            ->whereIn('id', $groupIds)
            ->withCount(['students as students_count' => fn ($q) => $q->where('role', 'student')])
            ->orderBy('name')
            ->get(['id', 'name']);

        $assignments = Assignment::query()
            ->where('teacher_id', $teacher->id)
            ->whereIn('status', ['active', 'inactive'])
            ->with(['groups:id', 'subjectRelation:id,name'])
            ->get(['id', 'subject_id']);

        $groupAssignmentIds = [];
        $groupSubjectStats = [];
        foreach ($assignments as $assignment) {
            foreach ($assignment->groups as $group) {
                $gid = (int) $group->id;
                $groupAssignmentIds[$gid] ??= [];
                $groupAssignmentIds[$gid][$assignment->id] = true;

                $subjectKey = (int) ($assignment->subject_id ?? 0);
                $subjectName = $assignment->subjectRelation?->name ?: 'Без предмета';
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

        return response()->json(['data' => $data]);
    }

    public function groupDetails(Request $request, Group $group)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher') {
            abort(403);
        }
        $allowed = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        if (! in_array((int) $group->id, $allowed, true)) {
            abort(403, 'Нет доступа к этой группе.');
        }

        $subjectId = (int) $request->query('subject_id', 0);
        $assignmentId = (int) $request->query('assignment_id', 0);
        $debtOnly = (bool) ((int) $request->query('debt_only', 0));
        $search = trim((string) $request->query('search', ''));

        $assignmentsQuery = Assignment::query()
            ->where('teacher_id', $teacher->id)
            ->whereIn('status', ['active', 'inactive'])
            ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id))
            ->with('subjectRelation:id,name')
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
                'name' => $a->subjectRelation?->name ?: 'Без предмета',
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
                    'subjectName' => $a->subjectRelation?->name ?: 'Без предмета',
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

        return response()->json([
            'group' => [
                'id' => (int) $group->id,
                'name' => $group->name,
            ],
            'filters' => [
                'subjects' => $subjects,
                'assignments' => $assignmentOptions,
            ],
            'students' => $studentRows,
        ]);
    }

    public function studentDetails(Request $request, Group $group, User $user)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher' || $user->role !== 'student') {
            abort(404);
        }
        $allowed = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        if (! in_array((int) $group->id, $allowed, true) || (int) $user->group_id !== (int) $group->id) {
            abort(403, 'Нет доступа к данным этого студента.');
        }

        $subjectId = (int) $request->query('subject_id', 0);
        $status = (string) $request->query('status', 'all');
        $debtOnly = (bool) ((int) $request->query('debt_only', 0));
        $periodDays = (int) $request->query('period_days', 0);

        $assignmentsQuery = Assignment::query()
            ->where('teacher_id', $teacher->id)
            ->whereIn('status', ['active', 'inactive'])
            ->whereHas('groups', fn ($q) => $q->where('groups.id', $group->id))
            ->with('subjectRelation:id,name')
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
                'subjectName' => $assignment->subjectRelation?->name ?: 'Без предмета',
                'deadline' => $assignment->deadline?->format('Y-m-d'),
                'maxScore' => (int) $assignment->max_score,
                'submissionId' => $submission?->id,
                'submissionStatus' => $submissionStatus,
                'score' => $submission?->score,
                'submittedAt' => $submission?->submitted_at?->toIso8601String(),
            ];
        })->filter()->values();

        $subjects = $assignments
            ->map(fn (Assignment $a) => ['id' => (int) ($a->subject_id ?? 0), 'name' => $a->subjectRelation?->name ?: 'Без предмета'])
            ->unique('id')
            ->sortBy('name')
            ->values()
            ->all();

        return response()->json([
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
        ]);
    }

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
