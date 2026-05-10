<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\LogsAdminActions;
use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Group;
use App\Models\Submission;
use App\Models\Subject;
use App\Models\TeachingLoad;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Админ: матрица и списки назначений (преподаватель + предмет + группа), CRUD и перенос заданий при смене преподавателя.
 */
class TeachingLoadController extends Controller
{
    use LogsAdminActions;

    private const SUBJECTS_PER_PAGE = 20;

    /**
     * Матрица назначений: строки — активные предметы, столбцы — активные группы.
     */
    public function teachingLoadsMatrix()
    {
        $subjects = Subject::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $groups = Group::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name']);

        $loads = TeachingLoad::query()
            ->where('status', 'active')
            ->with(['teacher:id,last_name,first_name,middle_name'])
            ->get();

        $loadsPayload = $loads->map(function (TeachingLoad $tl) {
            return [
                'id' => $tl->id,
                'subject_id' => $tl->subject_id,
                'group_id' => $tl->group_id,
                'teacher_id' => $tl->teacher_id,
                'teacher' => $tl->teacher
                    ? [
                        'id' => $tl->teacher->id,
                        'last_name' => $tl->teacher->last_name,
                        'first_name' => $tl->teacher->first_name,
                        'middle_name' => $tl->teacher->middle_name,
                    ]
                    : null,
            ];
        })->values()->all();

        return response()->json([
            'subjects' => $subjects,
            'groups' => $groups,
            'loads' => $loadsPayload,
        ]);
    }

    public function teachingLoads()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'teacher_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'specialty' => ['nullable', 'string', 'max:150'],
            'status' => ['nullable', 'in:active,inactive'],
            'sort' => ['nullable', 'in:newest,oldest,teacher_asc,subject_asc,group_asc'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = TeachingLoad::with([
            'teacher:id,last_name,first_name,middle_name,login,email',
            'subject:id,name,code,status',
            'group:id,name,specialty,status',
        ]);

        if (! empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(function ($builder) use ($term) {
                $builder
                    ->whereHas('teacher', fn ($teacherQuery) => $teacherQuery
                        ->where('login', 'like', "%{$term}%")
                        ->orWhere('last_name', 'like', "%{$term}%")
                        ->orWhere('first_name', 'like', "%{$term}%")
                        ->orWhere('middle_name', 'like', "%{$term}%"))
                    ->orWhereHas('subject', function ($subjectQuery) use ($term) {
                        $subjectQuery
                            ->where('name', 'like', "%{$term}%")
                            ->orWhere('code', 'like', "%{$term}%");
                    })
                    ->orWhereHas('group', fn ($groupQuery) => $groupQuery->where('name', 'like', "%{$term}%"));
            });
        }

        if (! empty($validated['teacher_id'])) {
            $query->where('teacher_id', (int) $validated['teacher_id']);
        }
        if (! empty($validated['subject_id'])) {
            $query->where('subject_id', (int) $validated['subject_id']);
        }
        if (! empty($validated['group_id'])) {
            $query->where('group_id', (int) $validated['group_id']);
        }
        if (! empty($validated['specialty'])) {
            $spec = trim((string) $validated['specialty']);
            $query->whereHas('group', fn ($gq) => $gq->where('specialty', $spec));
        }
        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        match ($validated['sort'] ?? 'teacher_asc') {
            'oldest' => $query->oldest(),
            'newest' => $query->latest(),
            'subject_asc' => $query->orderBy(Subject::select('name')->whereColumn('subjects.id', 'teaching_loads.subject_id')),
            'group_asc' => $query->orderBy(Group::select('name')->whereColumn('groups.id', 'teaching_loads.group_id')),
            default => $query->orderBy(User::select('last_name')->whereColumn('users.id', 'teaching_loads.teacher_id'))
                ->orderBy(User::select('first_name')->whereColumn('users.id', 'teaching_loads.teacher_id')),
        };

        $perPage = (int) ($validated['per_page'] ?? self::SUBJECTS_PER_PAGE);
        $loads = $query->paginate($perPage)->withQueryString();

        $collection = $loads->getCollection();
        $payload = $collection->map(fn (TeachingLoad $tl) => $this->teachingLoadListPayload(
            $tl,
            $this->statsForTeachingLoadTriple((int) $tl->teacher_id, (int) $tl->subject_id, (int) $tl->group_id)
        ));

        return response()->json([
            'data' => $payload->values()->all(),
            'meta' => [
                'current_page' => $loads->currentPage(),
                'last_page' => $loads->lastPage(),
                'per_page' => $loads->perPage(),
                'total' => $loads->total(),
            ],
        ]);
    }

    /**
     * Карточка назначения: метрики и последние задания по тройке преподаватель + предмет + группа.
     */
    public function teachingLoadDetail(Request $request, TeachingLoad $teachingLoad)
    {
        $teachingLoad->load([
            'teacher:id,last_name,first_name,middle_name,login,email',
            'subject:id,name,code,status',
            'group:id,name,specialty,status',
        ]);

        $tid = (int) $teachingLoad->teacher_id;
        $sid = (int) $teachingLoad->subject_id;
        $gid = (int) $teachingLoad->group_id;

        $stats = $this->statsForTeachingLoadTriple($tid, $sid, $gid);
        $assignmentBase = Assignment::query()
            ->where('teacher_id', $tid)
            ->where('subject_id', $sid)
            ->whereHas('groups', fn ($q) => $q->where('groups.id', $gid));

        $recentAssignments = (clone $assignmentBase)
            ->orderByDesc('updated_at')
            ->limit(10)
            ->get(['id', 'title', 'status', 'deadline'])
            ->map(fn (Assignment $a) => [
                'id' => $a->id,
                'title' => $a->title,
                'status' => $a->status,
                'deadline' => $a->deadline?->toDateString(),
            ])
            ->values()
            ->all();

        $gradedScores = Submission::query()
            ->where('status', 'graded')
            ->whereNotNull('score')
            ->whereHas('assignment', function ($q) use ($tid, $sid, $gid) {
                $q->where('teacher_id', $tid)
                    ->where('subject_id', $sid)
                    ->whereHas('groups', fn ($gq) => $gq->where('groups.id', $gid));
            })
            ->pluck('score');

        $avgScore = $gradedScores->isEmpty() ? null : round($gradedScores->avg(), 1);

        return response()->json([
            'teaching_load' => $this->teachingLoadListPayload($teachingLoad, $stats),
            'stats' => [
                'students_count' => $stats['students_count'],
                'assignments_total' => $stats['assignments_total'],
                'assignments_active' => $stats['assignments_active'],
                'submissions_count' => $stats['submissions_count'],
                'average_score' => $avgScore,
            ],
            'recent_assignments' => $recentAssignments,
        ]);
    }

    /**
     * Несколько назначений за раз: одна тройка на каждую выбранную группу.
     */
    public function createTeachingLoadsBatch(Request $request)
    {
        $validated = $request->validate([
            'teacher_id' => ['required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['required', 'exists:subjects,id'],
            'group_ids' => ['required', 'array', 'min:1'],
            'group_ids.*' => ['integer', 'exists:groups,id'],
            'status' => ['nullable', 'in:active,inactive'],
        ], [
            'group_ids.required' => 'Выберите хотя бы одну группу.',
        ]);

        $teacherId = (int) $validated['teacher_id'];
        $subjectId = (int) $validated['subject_id'];
        $status = $validated['status'] ?? 'active';

        $created = [];
        $skippedGroupIds = [];

        foreach (array_unique($validated['group_ids']) as $groupId) {
            $groupId = (int) $groupId;
            $exists = TeachingLoad::where('teacher_id', $teacherId)
                ->where('subject_id', $subjectId)
                ->where('group_id', $groupId)
                ->exists();
            if ($exists) {
                $skippedGroupIds[] = $groupId;
                continue;
            }
            $created[] = TeachingLoad::create([
                'teacher_id' => $teacherId,
                'subject_id' => $subjectId,
                'group_id' => $groupId,
                'status' => $status,
            ])->load(['teacher', 'subject', 'group']);
        }

        $this->log($request, 'create_teaching_load_batch', 'Пакетное создание назначений: '.count($created).' новых, пропуск групп: '.implode(',', $skippedGroupIds));

        return response()->json([
            'success' => true,
            'created' => collect($created)->map(fn (TeachingLoad $tl) => $this->teachingLoadListPayload(
                $tl,
                $this->statsForTeachingLoadTriple((int) $tl->teacher_id, (int) $tl->subject_id, (int) $tl->group_id)
            ))->values()->all(),
            'skipped_group_ids' => $skippedGroupIds,
        ], 201);
    }

    /**
     * Синхронизация списка групп для пары преподаватель + предмет: добавить/убрать карточки назначений.
     * Снятие группы запрещено, если по этой тройке есть учебные задания.
     */
    public function syncTeachingLoadsForPair(Request $request)
    {
        $validated = $request->validate([
            'teacher_id' => ['required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['required', 'exists:subjects,id'],
            'group_ids' => ['required', 'array', 'min:1'],
            'group_ids.*' => ['integer', 'exists:groups,id'],
        ], [
            'group_ids.min' => 'Должна остаться хотя бы одна группа.',
        ]);

        $teacherId = (int) $validated['teacher_id'];
        $subjectId = (int) $validated['subject_id'];
        $want = collect($validated['group_ids'])->map(fn ($id) => (int) $id)->unique()->values();

        DB::transaction(function () use ($request, $teacherId, $subjectId, $want) {
            $current = TeachingLoad::where('teacher_id', $teacherId)
                ->where('subject_id', $subjectId)
                ->get();

            foreach ($current as $tl) {
                if ($want->contains((int) $tl->group_id)) {
                    continue;
                }
                $tl->loadMissing('group');
                $n = Assignment::where('teacher_id', $teacherId)
                    ->where('subject_id', $subjectId)
                    ->whereHas('groups', fn ($q) => $q->where('groups.id', $tl->group_id))
                    ->count();
                if ($n > 0) {
                    throw ValidationException::withMessages([
                        'group_ids' => 'Нельзя убрать группу «'.$tl->group?->name.'»: есть '.$n.' задан(ий) по этой связке.',
                    ]);
                }
                $tl->delete();
            }

            foreach ($want as $gid) {
                TeachingLoad::firstOrCreate(
                    [
                        'teacher_id' => $teacherId,
                        'subject_id' => $subjectId,
                        'group_id' => $gid,
                    ],
                    ['status' => 'active']
                );
            }

            $this->log($request, 'sync_teaching_loads_pair', "Синхронизированы группы для преподавателя {$teacherId}, предмет {$subjectId}");
        });

        $fresh = TeachingLoad::where('teacher_id', $teacherId)
            ->where('subject_id', $subjectId)
            ->with(['teacher', 'subject', 'group'])
            ->orderBy(Group::select('name')->whereColumn('groups.id', 'teaching_loads.group_id'))
            ->get();

        return response()->json([
            'success' => true,
            'teaching_loads' => $fresh->map(fn (TeachingLoad $tl) => $this->teachingLoadListPayload(
                $tl,
                $this->statsForTeachingLoadTriple((int) $tl->teacher_id, (int) $tl->subject_id, (int) $tl->group_id)
            ))->values()->all(),
        ]);
    }

    /**
     * Смена преподавателя у назначения: активные задания по этой тройке переходят новому преподавателю.
     */
    public function transferTeachingLoadTeacher(Request $request, TeachingLoad $teachingLoad)
    {
        $validated = $request->validate([
            'teacher_id' => ['required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
        ]);

        $newId = (int) $validated['teacher_id'];
        $oldId = (int) $teachingLoad->teacher_id;

        if ($newId === $oldId) {
            $teachingLoad->load(['teacher', 'subject', 'group']);

            return response()->json([
                'success' => true,
                'teaching_load' => $this->teachingLoadListPayload(
                    $teachingLoad,
                    $this->statsForTeachingLoadTriple($oldId, (int) $teachingLoad->subject_id, (int) $teachingLoad->group_id)
                ),
            ]);
        }

        DB::transaction(function () use ($teachingLoad, $oldId, $newId) {
            Assignment::query()
                ->where('teacher_id', $oldId)
                ->where('subject_id', $teachingLoad->subject_id)
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $teachingLoad->group_id))
                ->update(['teacher_id' => $newId]);

            $teachingLoad->update(['teacher_id' => $newId]);
        });

        $fresh = $teachingLoad->fresh(['teacher', 'subject', 'group']);
        $this->log($request, 'transfer_teaching_load_teacher', "Смена преподавателя в назначении #{$teachingLoad->id}");

        return response()->json([
            'success' => true,
            'teaching_load' => $this->teachingLoadListPayload(
                $fresh,
                $this->statsForTeachingLoadTriple($newId, (int) $fresh->subject_id, (int) $fresh->group_id)
            ),
        ]);
    }

    public function createTeachingLoad(Request $request)
    {
        $validated = $request->validate([
            'teacher_id' => ['required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['required', 'exists:subjects,id'],
            'group_id' => ['required', 'exists:groups,id'],
            'status' => ['nullable', 'in:active,inactive'],
        ], [
            'teacher_id.required' => 'Выберите преподавателя.',
            'subject_id.required' => 'Выберите предмет.',
            'group_id.required' => 'Выберите группу.',
        ]);

        $existing = TeachingLoad::where('teacher_id', (int) $validated['teacher_id'])
            ->where('subject_id', (int) $validated['subject_id'])
            ->where('group_id', (int) $validated['group_id'])
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Такая нагрузка уже назначена.',
            ], 422);
        }

        $load = TeachingLoad::create([
            'teacher_id' => (int) $validated['teacher_id'],
            'subject_id' => (int) $validated['subject_id'],
            'group_id' => (int) $validated['group_id'],
            'status' => $validated['status'] ?? 'active',
        ])->load(['teacher', 'subject', 'group']);

        $this->log($request, 'create_teaching_load', "Назначена нагрузка: {$load->teacher->full_name} · {$load->subject->name} · {$load->group->name}");

        return response()->json(['success' => true, 'teaching_load' => $load], 201);
    }

    public function updateTeachingLoad(Request $request, TeachingLoad $teachingLoad)
    {
        $validated = $request->validate([
            'teacher_id' => ['sometimes', 'required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['sometimes', 'required', 'exists:subjects,id'],
            'group_id' => ['sometimes', 'required', 'exists:groups,id'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $next = [
            'teacher_id' => (int) ($validated['teacher_id'] ?? $teachingLoad->teacher_id),
            'subject_id' => (int) ($validated['subject_id'] ?? $teachingLoad->subject_id),
            'group_id' => (int) ($validated['group_id'] ?? $teachingLoad->group_id),
            'status' => $validated['status'] ?? $teachingLoad->status,
        ];

        $duplicateExists = TeachingLoad::where('teacher_id', $next['teacher_id'])
            ->where('subject_id', $next['subject_id'])
            ->where('group_id', $next['group_id'])
            ->where('id', '!=', $teachingLoad->id)
            ->exists();

        if ($duplicateExists) {
            return response()->json([
                'success' => false,
                'message' => 'Такая нагрузка уже назначена.',
            ], 422);
        }

        $teachingLoad->update($next);
        $freshLoad = $teachingLoad->fresh(['teacher', 'subject', 'group']);

        $this->log($request, 'update_teaching_load', "Изменена нагрузка: {$freshLoad->teacher->full_name} · {$freshLoad->subject->name} · {$freshLoad->group->name}");

        return response()->json(['success' => true, 'teaching_load' => $freshLoad]);
    }

    public function deleteTeachingLoad(Request $request, TeachingLoad $teachingLoad)
    {
        $teachingLoad->load(['teacher', 'subject', 'group']);
        $details = "{$teachingLoad->teacher?->full_name} · {$teachingLoad->subject?->name} · {$teachingLoad->group?->name}";
        $teachingLoad->delete();

        $this->log($request, 'delete_teaching_load', "Удалена нагрузка: {$details}");

        return response()->json(['success' => true]);
    }

    /**
     * @return array{students_count: int, assignments_total: int, assignments_active: int, submissions_count: int}
     */
    private function statsForTeachingLoadTriple(int $teacherId, int $subjectId, int $groupId): array
    {
        $studentsCount = User::query()
            ->where('role', 'student')
            ->where('group_id', $groupId)
            ->count();

        $base = Assignment::query()
            ->where('teacher_id', $teacherId)
            ->where('subject_id', $subjectId)
            ->whereHas('groups', fn ($q) => $q->where('groups.id', $groupId));

        $assignmentsTotal = (clone $base)->count();
        $assignmentsActive = (clone $base)->where('status', 'active')->count();

        $submissionsCount = Submission::query()
            ->whereHas('assignment', function ($q) use ($teacherId, $subjectId, $groupId) {
                $q->where('teacher_id', $teacherId)
                    ->where('subject_id', $subjectId)
                    ->whereHas('groups', fn ($gq) => $gq->where('groups.id', $groupId));
            })
            ->count();

        return [
            'students_count' => $studentsCount,
            'assignments_total' => $assignmentsTotal,
            'assignments_active' => $assignmentsActive,
            'submissions_count' => $submissionsCount,
        ];
    }

    /**
     * @param  array{students_count: int, assignments_total: int, assignments_active: int, submissions_count: int}  $stats
     */
    private function teachingLoadListPayload(TeachingLoad $tl, array $stats): array
    {
        return [
            'id' => $tl->id,
            'teacher_id' => $tl->teacher_id,
            'subject_id' => $tl->subject_id,
            'group_id' => $tl->group_id,
            'status' => $tl->status,
            'created_at' => $tl->created_at?->toISOString(),
            'teacher' => $tl->teacher ? [
                'id' => $tl->teacher->id,
                'last_name' => $tl->teacher->last_name,
                'first_name' => $tl->teacher->first_name,
                'middle_name' => $tl->teacher->middle_name,
                'login' => $tl->teacher->login,
                'email' => $tl->teacher->email,
                'full_name' => $tl->teacher->full_name,
            ] : null,
            'subject' => $tl->subject ? [
                'id' => $tl->subject->id,
                'name' => $tl->subject->name,
                'code' => $tl->subject->code,
                'status' => $tl->subject->status,
            ] : null,
            'group' => $tl->group ? [
                'id' => $tl->group->id,
                'name' => $tl->group->name,
                'specialty' => $tl->group->specialty,
                'status' => $tl->group->status,
            ] : null,
            'students_count' => $stats['students_count'],
            'assignments_count' => $stats['assignments_total'],
            'active_assignments_count' => $stats['assignments_active'],
            'submissions_count' => $stats['submissions_count'],
        ];
    }
}
