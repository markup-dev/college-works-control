<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\LogsAdminActions;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Submission;
use App\Models\TeachingLoad;
use App\Models\User;
use App\Services\AssignmentNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Админ: полный доступ к заданиям всех преподавателей — список, создание от имени системы, материалы, архив.
 */
class AdminAssignmentController extends Controller
{
    use LogsAdminActions;

    private const ASSIGNMENTS_PER_PAGE = 18;

    public function adminAssignments(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'teacher_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where(fn ($q) => $q->where('role', 'teacher'))],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'status' => ['nullable', 'in:all,active,inactive,archived,overdue'],
            'filter' => ['nullable', 'in:all,overdue,overdue_checks,review_stale'],
            'sort' => ['nullable', 'in:deadline_asc,deadline_desc,created_asc,created_desc,submissions_desc,submissions_asc'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? self::ASSIGNMENTS_PER_PAGE);
        $query = Assignment::query()
            ->with([
                'teacher:id,last_name,first_name,middle_name,login',
                'subject:id,name,code',
                'groups:id,name',
            ]);

        if (! empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(function ($builder) use ($term) {
                $builder
                    ->where('title', 'like', "%{$term}%")
                    ->orWhereHas('subject', fn ($q) => $q->where('name', 'like', "%{$term}%")->orWhere('code', 'like', "%{$term}%"))
                    ->orWhereHas('teacher', function ($tq) use ($term) {
                        $tq->where('last_name', 'like', "%{$term}%")
                            ->orWhere('first_name', 'like', "%{$term}%")
                            ->orWhere('middle_name', 'like', "%{$term}%")
                            ->orWhere('login', 'like', "%{$term}%");
                    });
            });
        }

        if (! empty($validated['teacher_id'])) {
            $query->where('teacher_id', (int) $validated['teacher_id']);
        }
        if (! empty($validated['subject_id'])) {
            $query->where('subject_id', (int) $validated['subject_id']);
        }
        if (! empty($validated['group_id'])) {
            $query->whereHas('groups', fn ($gq) => $gq->where('groups.id', (int) $validated['group_id']));
        }

        $status = $validated['status'] ?? 'all';
        if ($status === 'active') {
            $query->where('status', 'active');
        } elseif ($status === 'inactive') {
            $query->where('status', 'inactive');
        } elseif ($status === 'archived') {
            $query->where('status', 'archived');
        } elseif ($status === 'overdue') {
            $query->where('status', 'active')->whereDate('deadline', '<', now()->toDateString());
        }

        $special = $validated['filter'] ?? 'all';
        if (in_array($special, ['overdue_checks', 'review_stale'], true)) {
            $query->where('status', 'active')
                ->whereHas('submissions', function ($sq) {
                    $sq->where('status', 'submitted')
                        ->whereNotNull('submitted_at')
                        ->where('submitted_at', '<=', now()->subDays(3));
                });
        } elseif ($special === 'overdue') {
            $query->where('status', 'active')->whereDate('deadline', '<', now()->toDateString());
        }

        $sort = $validated['sort'] ?? 'deadline_asc';
        match ($sort) {
            'deadline_desc' => $query->orderByDesc('deadline'),
            'created_asc' => $query->oldest(),
            'created_desc' => $query->latest(),
            'submissions_desc' => $query->withCount('submissions')->orderByDesc('submissions_count'),
            'submissions_asc' => $query->withCount('submissions')->orderBy('submissions_count'),
            default => $query->orderBy('deadline'),
        };

        $paginator = $query->paginate($perPage)->withQueryString();
        $items = collect($paginator->items())->map(fn (Assignment $a) => $this->buildAdminAssignmentListItem($a))->values()->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function showAdminAssignment(Request $request, Assignment $assignment)
    {
        $assignment->load([
            'teacher:id,last_name,first_name,middle_name,login,email',
            'subject:id,name,code',
            'groups:id,name',
        ]);
        $assignment->load(['groups.students' => fn ($q) => $q->where('role', 'student')->select('users.id', 'users.last_name', 'users.first_name', 'users.middle_name', 'users.group_id', 'users.role')]);

        $listItem = $this->buildAdminAssignmentListItem($assignment);

        $latestByStudent = Submission::query()
            ->where('assignment_id', $assignment->id)
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->get(['id', 'student_id', 'status', 'score', 'submitted_at']);

        $byStudent = $latestByStudent->unique('student_id')->keyBy('student_id');

        $gradeDist = ['5' => 0, '4' => 0, '3' => 0, '2' => 0, 'other' => 0];
        foreach ($byStudent as $sub) {
            if ($sub->status !== 'graded' || $sub->score === null) {
                continue;
            }
            $k = (string) (int) $sub->score;
            if (isset($gradeDist[$k])) {
                $gradeDist[$k]++;
            } else {
                $gradeDist['other']++;
            }
        }

        $targetIds = $assignment->groups->flatMap(fn ($g) => $g->students)->filter(fn ($u) => $u->role === 'student')->pluck('id')->unique()->values();
        $deadline = $assignment->deadline;
        $deadlinePassed = $assignment->status === 'active' && $deadline && $deadline->lt(now()->startOfDay());

        $notSubmitted = [];
        foreach ($targetIds as $sid) {
            $sub = $byStudent->get($sid);
            $hasDone = $sub && in_array($sub->status, ['submitted', 'graded', 'returned'], true);
            if ($hasDone) {
                continue;
            }
            $student = User::query()->find($sid);
            $notSubmitted[] = [
                'id' => (int) $sid,
                'short_name' => $student?->full_name ?? '—',
                'overdue' => $deadlinePassed,
            ];
        }

        return response()->json([
            'assignment' => [
                'id' => $assignment->id,
                'title' => $assignment->title,
                'description' => $assignment->description,
                'submission_type' => $assignment->submission_type,
                'status' => $assignment->status,
                'deadline' => $deadline?->toDateString(),
                'created_at' => $assignment->created_at?->toISOString(),
                'teacher' => $listItem['teacher'],
                'subject' => $listItem['subject'],
                'groups' => $listItem['groups'],
            ],
            'stats' => $listItem['stats'],
            'grade_distribution' => $gradeDist,
            'not_submitted' => $notSubmitted,
        ]);
    }

    public function updateAdminAssignment(Request $request, Assignment $assignment)
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'min:3', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'deadline' => ['sometimes', 'required', 'date'],
            'status' => ['nullable', 'in:active,inactive,archived'],
        ]);

        $assignment->update($validated);
        $fresh = $assignment->fresh()->load([
            'teacher:id,last_name,first_name,middle_name,login',
            'subject:id,name,code',
            'groups:id,name',
        ]);

        if ($fresh->status !== 'archived') {
            try {
                app(AssignmentNotificationService::class)->notifyAssignmentUpdated($fresh);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $this->log($request, 'update_assignment', "Администратор изменил задание «{$fresh->title}»");

        return response()->json([
            'success' => true,
            'assignment' => $this->buildAdminAssignmentListItem($fresh),
        ]);
    }

    public function updateAdminAssignmentTeacher(Request $request, Assignment $assignment)
    {
        $validated = $request->validate([
            'teacher_id' => ['required', Rule::exists('users', 'id')->where(fn ($q) => $q->where('role', 'teacher'))],
        ]);

        $newId = (int) $validated['teacher_id'];
        $this->assertTeacherCoversAssignmentGroups($assignment, $newId);

        $assignment->update(['teacher_id' => $newId]);
        $fresh = $assignment->fresh()->load([
            'teacher:id,last_name,first_name,middle_name,login',
            'subject:id,name,code',
            'groups:id,name',
        ]);

        $this->log($request, 'reassign_assignment_teacher', "Смена преподавателя у задания «{$fresh->title}» (id {$fresh->id})");

        return response()->json([
            'success' => true,
            'assignment' => $this->buildAdminAssignmentListItem($fresh),
        ]);
    }

    public function eligibleTeachersForAdminAssignment(Request $request, Assignment $assignment)
    {
        $assignment->loadMissing('groups');
        $subjectId = (int) $assignment->subject_id;
        if ($subjectId === 0) {
            return response()->json(['data' => []]);
        }
        $groupIds = $assignment->groups->pluck('id')->map(fn ($id) => (int) $id)->all();
        if ($groupIds === []) {
            return response()->json(['data' => []]);
        }

        $teacherIds = TeachingLoad::query()
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->whereIn('group_id', $groupIds)
            ->selectRaw('teacher_id, COUNT(DISTINCT group_id) as c')
            ->groupBy('teacher_id')
            ->havingRaw('COUNT(DISTINCT group_id) = ?', [count($groupIds)])
            ->pluck('teacher_id')
            ->all();

        $teachers = User::query()
            ->where('role', 'teacher')
            ->whereIn('id', $teacherIds)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'last_name', 'first_name', 'middle_name', 'login']);

        $data = $teachers->map(fn (User $u) => [
            'id' => $u->id,
            'short_name' => $u->full_name,
        ])->values()->all();

        return response()->json(['data' => $data]);
    }

    public function deleteAdminAssignment(Request $request, Assignment $assignment)
    {
        $assignment->loadMissing('materialItems');
        foreach ($assignment->materialItems as $material) {
            if (! empty($material->file_path) && Storage::disk('public')->exists($material->file_path)) {
                Storage::disk('public')->delete($material->file_path);
            }
        }

        $title = $assignment->title;
        $assignment->delete();

        $this->log($request, 'delete_assignment', "Удалено задание «{$title}»");

        return response()->json(['success' => true]);
    }

    private function buildAdminAssignmentListItem(Assignment $assignment): array
    {
        $assignment->loadMissing(['groups.students' => fn ($q) => $q->where('role', 'student')->select('users.id', 'users.group_id', 'users.role')]);

        $metrics = $assignment->calculateCompletionMetrics();
        $total = (int) ($metrics['total_students'] ?? 0);
        $submitted = (int) ($metrics['submitted_students'] ?? 0);
        $graded = (int) ($metrics['graded_students'] ?? 0);
        $pending = (int) ($metrics['pending_students'] ?? 0);
        $notSubmitted = max(0, $total - $submitted);

        $latestByStudent = Submission::query()
            ->where('assignment_id', $assignment->id)
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->get(['id', 'assignment_id', 'student_id', 'status', 'score', 'submitted_at'])
            ->unique('student_id');

        $scores = $latestByStudent->where('status', 'graded')->pluck('score')->filter(fn ($s) => $s !== null);
        $avgScore = $scores->isEmpty() ? null : round((float) $scores->avg(), 1);

        $deadline = $assignment->deadline;
        $displayOverdue = $assignment->status === 'active' && $deadline && $deadline->lt(now()->startOfDay());

        return [
            'id' => $assignment->id,
            'title' => $assignment->title,
            'teacher' => $this->adminTeacherShortPayload($assignment->teacher),
            'subject' => $assignment->subject
                ? [
                    'id' => $assignment->subject->id,
                    'name' => $assignment->subject->name,
                    'code' => $assignment->subject->code ?? null,
                ]
                : null,
            'groups' => $assignment->groups->map(fn ($g) => ['id' => $g->id, 'name' => $g->name])->values()->all(),
            'status' => $assignment->status,
            'display_overdue' => $displayOverdue,
            'deadline' => $deadline?->toDateString(),
            'created_at' => $assignment->created_at?->toISOString(),
            'stats' => [
                'total_students' => $total,
                'submitted' => $submitted,
                'graded' => $graded,
                'pending_review' => $pending,
                'not_submitted' => $notSubmitted,
                'avg_score' => $avgScore,
            ],
        ];
    }

    private function adminTeacherShortPayload(?User $u): ?array
    {
        if (! $u) {
            return null;
        }

        return [
            'id' => $u->id,
            'short_name' => $u->full_name,
        ];
    }

    private function assertTeacherCoversAssignmentGroups(Assignment $assignment, int $teacherId): void
    {
        $assignment->loadMissing('groups');
        $subjectId = (int) $assignment->subject_id;
        if ($subjectId === 0) {
            throw ValidationException::withMessages(['teacher_id' => 'У задания не указан предмет.']);
        }
        $groupIds = $assignment->groups->pluck('id')->map(fn ($id) => (int) $id)->all();
        if ($groupIds === []) {
            throw ValidationException::withMessages(['teacher_id' => 'У задания не привязаны группы.']);
        }
        foreach ($groupIds as $gid) {
            $ok = TeachingLoad::query()
                ->where('teacher_id', $teacherId)
                ->where('subject_id', $subjectId)
                ->where('group_id', $gid)
                ->where('status', 'active')
                ->exists();
            if (! $ok) {
                throw ValidationException::withMessages([
                    'teacher_id' => 'Преподаватель должен быть назначен на этот предмет по всем группам задания.',
                ]);
            }
        }
    }
}
