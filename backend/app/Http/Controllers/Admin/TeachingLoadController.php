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
use App\Services\AcademicProgramService;
use App\Services\AdminActionNotificationService;
use App\Support\AdminLogMessages;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Админ: списки назначений (преподаватель + дисциплина + группа), CRUD и перенос заданий при смене преподавателя.
 */
class TeachingLoadController extends Controller
{
    use LogsAdminActions;

    private const SUBJECTS_PER_PAGE = 18;

    /**
     * Допустимые преподаватели, дисциплины и группы для форм назначений
     * (с учётом допусков преподавателя и программы группы на текущем курсе).
     */
    public function formOptions(Request $request)
    {
        $validated = $request->validate([
            'teacher_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['nullable', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
            'exclude_teacher_id' => ['nullable', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
        ]);

        $teacherId = isset($validated['teacher_id']) ? (int) $validated['teacher_id'] : null;
        $subjectId = isset($validated['subject_id']) ? (int) $validated['subject_id'] : null;
        $excludeTeacherId = isset($validated['exclude_teacher_id']) ? (int) $validated['exclude_teacher_id'] : null;

        $teachersQuery = User::query()
            ->where('role', 'teacher')
            ->where('is_active', true)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->orderBy('middle_name');

        if ($subjectId) {
            $teachersQuery->whereHas('teacherSubjects', fn ($q) => $q
                ->where('subject_id', $subjectId)
                ->where('status', 'active'));
        }
        if ($excludeTeacherId) {
            $teachersQuery->where('id', '!=', $excludeTeacherId);
        }

        $teachers = $teachersQuery->get([
            'id',
            'login',
            'email',
            'last_name',
            'first_name',
            'middle_name',
            'department',
        ]);

        $subjectsQuery = Subject::query()
            ->where('status', 'active')
            ->orderBy('name');

        if ($teacherId) {
            $subjectsQuery->whereHas('teacherSubjects', fn ($q) => $q
                ->where('teacher_id', $teacherId)
                ->where('status', 'active'));
        }

        $subjects = $subjectsQuery->get(['id', 'name', 'code']);

        $groupsQuery = Group::query()
            ->where('status', 'active')
            ->withCount('students')
            ->orderBy('name');

        if ($subjectId) {
            $groupsQuery->where(function ($query) use ($subjectId) {
                $query
                    ->whereHas('groupSubjects', fn ($q) => $q
                        ->where('subject_id', $subjectId)
                        ->whereColumn('course', 'groups.current_course')
                        ->where('status', 'active'))
                    ->orWhereHas('teachingLoads', fn ($q) => $q
                        ->where('subject_id', $subjectId)
                        ->where('status', 'active'));
            });
        }

        if ($teacherId && $subjectId) {
            $assignedGroupIds = TeachingLoad::query()
                ->where('teacher_id', $teacherId)
                ->where('subject_id', $subjectId)
                ->where('status', 'active')
                ->pluck('group_id');
            if ($assignedGroupIds->isNotEmpty()) {
                $groupsQuery->whereNotIn('id', $assignedGroupIds);
            }
        }

        $groups = $groupsQuery->get([
            'id',
            'name',
            'specialty',
            'current_course',
            'admission_year',
            'graduation_year',
            'status',
        ]);

        return response()->json([
            'teachers' => $teachers,
            'subjects' => $subjects,
            'groups' => $groups,
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
            'teacher:id,last_name,first_name,middle_name,login,email,department',
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
                    ->orWhereHas('group', fn ($groupQuery) => $groupQuery
                        ->where('name', 'like', "%{$term}%")
                        ->orWhere('specialty', 'like', "%{$term}%"));
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
     * Карточка назначения: метрики и последние задания по тройке преподаватель + дисциплина + группа.
     */
    public function teachingLoadDetail(Request $request, TeachingLoad $teachingLoad)
    {
        $teachingLoad->load([
            'teacher:id,last_name,first_name,middle_name,login,email,department',
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

        $assignmentIds = $assignmentBase->pluck('id');
        $gradedScores = collect();
        if ($assignmentIds->isNotEmpty()) {
            $rows = Submission::query()
                ->whereIn('assignment_id', $assignmentIds)
                ->orderByDesc('submitted_at')
                ->orderByDesc('id')
                ->get(['assignment_id', 'student_id', 'status', 'score']);
            $seen = [];
            foreach ($rows as $row) {
                $pairKey = $row->assignment_id.':'.$row->student_id;
                if (array_key_exists($pairKey, $seen)) {
                    continue;
                }
                $seen[$pairKey] = true;
                if ($row->status === 'graded' && $row->score !== null) {
                    $gradedScores->push((float) $row->score);
                }
            }
        }

        $avgScore = $gradedScores->isEmpty() ? null : round((float) $gradedScores->avg(), 1);

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
    public function createTeachingLoadsBatch(Request $request, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'teacher_id' => ['required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
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
            $programs->assertTeachingLoadAllowed($teacherId, $subjectId, $groupId);
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

        foreach ($created as $tl) {
            app(AdminActionNotificationService::class)->notifyTeachingLoadAssigned($tl, $request->user());
        }

        $skippedLabels = $skippedGroupIds === []
            ? ''
            : Group::query()->whereIn('id', $skippedGroupIds)->orderBy('name')->pluck('name')->implode(', ');
        $batchDetails = 'Создано назначений: '.count($created);
        if ($skippedLabels !== '') {
            $batchDetails .= ', уже были: '.$skippedLabels;
        }
        $this->log($request, 'create_teaching_load_batch', $batchDetails);

        if (count($created) === 0 && count($skippedGroupIds) > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Все выбранные группы уже имеют это назначение у преподавателя.',
                'skipped_group_ids' => $skippedGroupIds,
            ], 422);
        }

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
     * Синхронизация списка групп для пары преподаватель + дисциплина: добавить/убрать карточки назначений.
     * Снятие группы запрещено, если по этой тройке есть учебные задания.
     */
    public function syncTeachingLoadsForPair(Request $request, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'teacher_id' => ['required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
            'group_ids' => ['required', 'array', 'min:1'],
            'group_ids.*' => ['integer', 'exists:groups,id'],
        ], [
            'group_ids.min' => 'Должна остаться хотя бы одна группа.',
        ]);

        $teacherId = (int) $validated['teacher_id'];
        $subjectId = (int) $validated['subject_id'];
        $want = collect($validated['group_ids'])->map(fn ($id) => (int) $id)->unique()->values();

        $removedLoads = [];
        $addedLoads = [];

        DB::transaction(function () use ($request, $teacherId, $subjectId, $want, $programs, &$removedLoads, &$addedLoads) {
            $current = TeachingLoad::where('teacher_id', $teacherId)
                ->where('subject_id', $subjectId)
                ->with(['teacher', 'subject', 'group'])
                ->get();

            $currentGroupIds = $current->pluck('group_id')->map(fn ($id) => (int) $id);
            $addingGroupIds = $want->filter(fn ($gid) => ! $currentGroupIds->contains($gid));
            if ($addingGroupIds->isNotEmpty()) {
                $programs->assertActiveTeacher($teacherId);
            }

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
                $removedLoads[] = $tl;
                $tl->delete();
            }

            foreach ($want as $gid) {
                $programs->assertTeachingLoadAllowed($teacherId, $subjectId, (int) $gid);
                $load = TeachingLoad::firstOrCreate(
                    [
                        'teacher_id' => $teacherId,
                        'subject_id' => $subjectId,
                        'group_id' => $gid,
                    ],
                    ['status' => 'active']
                );
                if ($load->wasRecentlyCreated) {
                    $addedLoads[] = $load->load(['teacher', 'subject', 'group']);
                }
            }

            $teacher = User::query()->find($teacherId, ['id', 'last_name', 'first_name', 'middle_name', 'login']);
            $subject = Subject::query()->find($subjectId, ['id', 'name']);
            $this->log(
                $request,
                'sync_teaching_loads_pair',
                'Синхронизированы группы: '.AdminLogMessages::teachingLoadTriple(
                    $teacher?->full_name,
                    $subject?->name,
                    null,
                ),
            );
        });

        foreach ($removedLoads as $load) {
            app(AdminActionNotificationService::class)->notifyTeachingLoadRemoved($load, $request->user());
        }
        foreach ($addedLoads as $load) {
            app(AdminActionNotificationService::class)->notifyTeachingLoadAssigned($load, $request->user());
        }

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
    public function transferTeachingLoadTeacher(Request $request, TeachingLoad $teachingLoad, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'teacher_id' => ['required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
        ]);

        $newId = (int) $validated['teacher_id'];
        $oldId = (int) $teachingLoad->teacher_id;
        $programs->assertTeachingLoadAllowed($newId, (int) $teachingLoad->subject_id, (int) $teachingLoad->group_id);

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

        $oldLoad = $teachingLoad->fresh(['teacher', 'subject', 'group']);

        DB::transaction(function () use ($teachingLoad, $oldId, $newId) {
            Assignment::query()
                ->where('teacher_id', $oldId)
                ->where('subject_id', $teachingLoad->subject_id)
                ->whereHas('groups', fn ($q) => $q->where('groups.id', $teachingLoad->group_id))
                ->update(['teacher_id' => $newId]);

            $teachingLoad->update(['teacher_id' => $newId]);
        });

        $fresh = $teachingLoad->fresh(['teacher', 'subject', 'group']);
        if ($oldLoad) {
            app(AdminActionNotificationService::class)->notifyTeachingLoadRemoved($oldLoad, $request->user());
        }
        app(AdminActionNotificationService::class)->notifyTeachingLoadAssigned($fresh, $request->user());
        $this->log(
            $request,
            'transfer_teaching_load_teacher',
            'Передано назначение: '.AdminLogMessages::teachingLoadTriple(
                $fresh->teacher?->full_name,
                $fresh->subject?->name,
                $fresh->group?->name,
            ),
        );

        return response()->json([
            'success' => true,
            'teaching_load' => $this->teachingLoadListPayload(
                $fresh,
                $this->statsForTeachingLoadTriple($newId, (int) $fresh->subject_id, (int) $fresh->group_id)
            ),
        ]);
    }

    public function createTeachingLoad(Request $request, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'teacher_id' => ['required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
            'group_id' => ['required', 'exists:groups,id'],
            'status' => ['nullable', 'in:active,inactive'],
        ], [
            'teacher_id.required' => 'Выберите преподавателя.',
            'subject_id.required' => 'Выберите дисциплину.',
            'group_id.required' => 'Выберите группу.',
        ]);

        $programs->assertTeachingLoadAllowed(
            (int) $validated['teacher_id'],
            (int) $validated['subject_id'],
            (int) $validated['group_id']
        );

        $existing = TeachingLoad::where('teacher_id', (int) $validated['teacher_id'])
            ->where('subject_id', (int) $validated['subject_id'])
            ->where('group_id', (int) $validated['group_id'])
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Такое назначение уже есть: '.$programs->teachingLoadTripleLabel(
                    (int) $validated['subject_id'],
                    (int) $validated['group_id'],
                ).'.',
            ], 422);
        }

        $load = TeachingLoad::create([
            'teacher_id' => (int) $validated['teacher_id'],
            'subject_id' => (int) $validated['subject_id'],
            'group_id' => (int) $validated['group_id'],
            'status' => $validated['status'] ?? 'active',
        ])->load(['teacher', 'subject', 'group']);

        app(AdminActionNotificationService::class)->notifyTeachingLoadAssigned($load, $request->user());

        $this->log(
            $request,
            'create_teaching_load',
            'Создано назначение: '.AdminLogMessages::teachingLoadTriple(
                $load->teacher->full_name,
                $load->subject->name,
                $load->group->name,
            ),
        );

        return response()->json(['success' => true, 'teaching_load' => $load], 201);
    }

    public function updateTeachingLoad(Request $request, TeachingLoad $teachingLoad, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'teacher_id' => ['sometimes', 'required', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'teacher'))],
            'subject_id' => ['sometimes', 'required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
            'group_id' => ['sometimes', 'required', 'exists:groups,id'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $next = [
            'teacher_id' => (int) ($validated['teacher_id'] ?? $teachingLoad->teacher_id),
            'subject_id' => (int) ($validated['subject_id'] ?? $teachingLoad->subject_id),
            'group_id' => (int) ($validated['group_id'] ?? $teachingLoad->group_id),
            'status' => $validated['status'] ?? $teachingLoad->status,
        ];

        $pairChanged = $next['teacher_id'] !== (int) $teachingLoad->teacher_id
            || $next['subject_id'] !== (int) $teachingLoad->subject_id
            || $next['group_id'] !== (int) $teachingLoad->group_id;

        if ($pairChanged) {
            $programs->assertTeachingLoadAllowed($next['teacher_id'], $next['subject_id'], $next['group_id']);
        }

        $duplicateExists = TeachingLoad::where('teacher_id', $next['teacher_id'])
            ->where('subject_id', $next['subject_id'])
            ->where('group_id', $next['group_id'])
            ->where('id', '!=', $teachingLoad->id)
            ->exists();

        if ($duplicateExists) {
            return response()->json([
                'success' => false,
                'message' => 'Такое назначение уже есть: '.$programs->teachingLoadTripleLabel(
                    (int) $next['subject_id'],
                    (int) $next['group_id'],
                ).'.',
            ], 422);
        }

        $beforeLoad = $teachingLoad->fresh(['teacher', 'subject', 'group']);
        $teachingLoad->update($next);
        $freshLoad = $teachingLoad->fresh(['teacher', 'subject', 'group']);

        if ($beforeLoad && (
            (int) $beforeLoad->teacher_id !== (int) $freshLoad->teacher_id ||
            (int) $beforeLoad->subject_id !== (int) $freshLoad->subject_id ||
            (int) $beforeLoad->group_id !== (int) $freshLoad->group_id
        )) {
            app(AdminActionNotificationService::class)->notifyTeachingLoadRemoved($beforeLoad, $request->user());
            app(AdminActionNotificationService::class)->notifyTeachingLoadAssigned($freshLoad, $request->user());
        } elseif ($freshLoad->teacher) {
            app(AdminActionNotificationService::class)->notify(
                $freshLoad->teacher,
                $request->user(),
                'Назначение изменено',
                'Администратор изменил статус вашего назначения по дисциплине «'.($freshLoad->subject?->name ?? 'Дисциплина').'» для группы '.($freshLoad->group?->name ?? '—').'.',
                [
                    'action' => 'teaching_load_updated',
                    'teaching_load_id' => $freshLoad->id,
                    'subject_id' => $freshLoad->subject_id,
                    'group_id' => $freshLoad->group_id,
                ],
            );
        }

        $this->log(
            $request,
            'update_teaching_load',
            'Изменено назначение: '.AdminLogMessages::teachingLoadTriple(
                $freshLoad->teacher->full_name,
                $freshLoad->subject->name,
                $freshLoad->group->name,
            ),
        );

        return response()->json(['success' => true, 'teaching_load' => $freshLoad]);
    }

    public function deleteTeachingLoad(Request $request, TeachingLoad $teachingLoad)
    {
        $teachingLoad->load(['teacher', 'subject', 'group']);
        $details = AdminLogMessages::teachingLoadTriple(
            $teachingLoad->teacher?->full_name,
            $teachingLoad->subject?->name,
            $teachingLoad->group?->name,
        );
        $removedLoad = clone $teachingLoad;
        $teachingLoad->delete();

        app(AdminActionNotificationService::class)->notifyTeachingLoadRemoved($removedLoad, $request->user());

        $this->log($request, 'delete_teaching_load', "Удалено назначение: {$details}");

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
                'department' => $tl->teacher->department,
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
