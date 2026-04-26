<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

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
}
