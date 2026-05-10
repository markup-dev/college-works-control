<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\AssignmentMaterial;
use App\Models\User;
use App\Services\AssignmentNotificationService;
use App\Services\Assignments\AssignmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * REST по заданиям: списки и карточки для студента/преподавателя, CRUD и материалы — только преподаватель-владелец.
 * Тяжёлая выборка и фильтрация делегированы в AssignmentService; уведомления студентам — AssignmentNotificationService.
 */
class AssignmentController extends Controller
{
    public function __construct(
        private readonly AssignmentService $assignments,
    ) {}

    public function meta(Request $request)
    {
        return response()->json($this->assignments->metaPayload($request->user()));
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive,archived,not_archived,not_submitted,submitted,graded,returned,urgent'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'subject' => ['nullable', 'string', 'max:255'],
            'teacher_id' => ['nullable', 'integer', 'exists:users,id'],
            'teacher' => ['nullable', 'string', 'max:255'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'group' => ['nullable', 'string', 'max:100'],
            'work_filter' => ['nullable', 'in:needs_review,no_submissions,all_reviewed'],
            'deadline_filter' => ['nullable', 'in:overdue,due_3d,due_week,not_urgent'],
            'sort' => ['nullable', 'in:deadline,deadline_desc,newest,oldest,title,subject,status,pending_desc,pending_asc'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $requestedPage = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 0);
        $shouldPaginate = $perPage > 0 || array_key_exists('page', $validated);
        if ($shouldPaginate && $perPage <= 0) {
            $perPage = AssignmentService::DEFAULT_PER_PAGE;
        }

        if (! empty($validated['group_id']) && $user->role === 'teacher') {
            $allowedGroupIds = $user->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
            if (! in_array((int) $validated['group_id'], $allowedGroupIds, true)) {
                throw ValidationException::withMessages([
                    'group_id' => 'Нет доступа к этой группе.',
                ]);
            }
        }

        return response()->json(
            $this->assignments->indexPayload($user, $validated, $requestedPage, $perPage, $shouldPaginate)
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate(
            [
                'title' => ['required', 'string', 'min:3', 'max:255'],
                'subject_id' => ['required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
                'description' => ['required', 'string', 'min:10', 'max:5000'],
                'deadline' => ['required', 'date', 'after_or_equal:today'],
                'submission_type' => ['nullable', 'in:file,demo'],
                'criteria' => ['nullable', 'array', 'max:20'],
                'criteria.*.text' => ['nullable', 'string', 'max:500'],
                'criteria.*.max_points' => ['nullable', 'integer', 'min:1', 'max:100'],
                'student_groups' => ['nullable', 'array', 'max:20'],
                'student_groups.*' => ['string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
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
                'student_groups.*.regex' => 'Название группы может содержать только буквы, цифры и дефис.',
            ]
        );

        $groupNames = $request->input('student_groups', []);
        $criteria = $this->assignments->normalizeCriteriaInput(
            is_array($request->input('criteria', [])) ? $request->input('criteria', []) : []
        );
        $allowedFormats = $request->input('allowed_formats', []);
        $subjectId = (int) $validated['subject_id'];

        if (! $this->assignments->teacherCanTeachSubject($request->user()->id, $subjectId)) {
            return response()->json(['message' => 'Выберите дисциплину из назначенной учебной нагрузки.'], 422);
        }

        $groupIds = collect($groupNames)
            ->map(fn ($name) => $this->assignments->normalizeGroupName((string) $name))
            ->filter()
            ->unique()
            ->map(function ($groupName) use ($request, $subjectId) {
                return $this->assignments->resolveGroupIdByName($groupName, $request->user()->id, $subjectId);
            })
            ->values()
            ->all();

        if (empty($groupIds)) {
            return response()->json(['message' => 'Выберите хотя бы одну группу из назначенной учебной нагрузки.'], 422);
        }

        unset($validated['student_groups'], $validated['criteria'], $validated['allowed_formats'], $validated['max_score']);

        $assignment = Assignment::create([
            ...$validated,
            'max_score' => 100,
            'submission_type' => $validated['submission_type'] ?? 'file',
            'status' => 'active',
            'teacher_id' => $request->user()->id,
        ]);

        $assignment->groups()->sync($groupIds);

        $this->assignments->syncCriteria($assignment, is_array($criteria) ? $criteria : []);
        $this->assignments->syncAllowedFormats($assignment, is_array($allowedFormats) ? $allowedFormats : []);

        $assignment->load([
            'teacher:id,login,last_name,first_name,middle_name,grade_scale',
            'subject:id,name',
            'groups:id,name',
            'criteriaItems:id,assignment_id,position,text,max_points',
            'allowedFormatItems:id,assignment_id,format',
            'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
        ]);

        try {
            app(AssignmentNotificationService::class)->notifyNewAssignment($assignment);
        } catch (\Throwable $e) {
            report($e);
        }

        return response()
            ->json([
                'success' => true,
                'assignment_id' => $assignment->id,
                'assignment' => $assignment,
            ], 201)
            ->header('X-Created-Assignment-Id', (string) $assignment->id);
    }

    public function show(Request $request, Assignment $assignment)
    {
        $user = $request->user();

        if ($user->role === 'teacher' && (int) $assignment->teacher_id !== (int) $user->id) {
            return response()->json(['message' => 'Недостаточно прав для просмотра задания.'], 403);
        }

        if ($user->role === 'student') {
            if (! $user->group_id
                || ! $assignment->groups()->where('groups.id', $user->group_id)->exists()) {
                return response()->json(['message' => 'Недостаточно прав для просмотра задания.'], 403);
            }

            $assignment->load([
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
            ]);
            $assignment->loadCount([
                'submissions',
                'submissions as pending_count' => fn ($q) => $q->where('status', 'submitted'),
            ]);

            return response()->json($this->assignments->transformStudentAssignmentPayload($assignment, $user));
        }

        $assignment->load([
            'teacher:id,login,last_name,first_name,middle_name,grade_scale',
            'subject:id,name',
            'groups:id,name',
            'criteriaItems:id,assignment_id,position,text,max_points',
            'allowedFormatItems:id,assignment_id,format',
            'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
        ]);
        $assignment->loadCount([
            'submissions',
            'submissions as pending_count' => fn ($q) => $q->where('status', 'submitted'),
        ]);

        return response()->json($assignment);
    }

    public function update(Request $request, Assignment $assignment)
    {
        $validated = $request->validate(
            [
                'title' => ['sometimes', 'required', 'string', 'min:3', 'max:255'],
                'subject_id' => ['sometimes', 'required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
                'description' => ['nullable', 'string', 'min:10', 'max:5000'],
                'deadline' => ['sometimes', 'required', 'date', 'after_or_equal:today'],
                'status' => ['nullable', 'in:active,inactive,archived'],
                'submission_type' => ['nullable', 'in:file,demo'],
                'criteria' => ['nullable', 'array', 'max:20'],
                'criteria.*.text' => ['nullable', 'string', 'max:500'],
                'criteria.*.max_points' => ['nullable', 'integer', 'min:1', 'max:100'],
                'student_groups' => ['nullable', 'array', 'max:20'],
                'student_groups.*' => ['string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
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
                'student_groups.*.regex' => 'Название группы может содержать только буквы, цифры и дефис.',
            ]
        );

        $newGroupIds = null;
        $subjectId = (int) ($validated['subject_id'] ?? $assignment->subject_id);
        if (! $this->assignments->teacherCanTeachSubject($request->user()->id, $subjectId)) {
            return response()->json(['message' => 'Выберите дисциплину из назначенной учебной нагрузки.'], 422);
        }

        if ($request->has('student_groups')) {
            $newGroupIds = collect($request->input('student_groups', []))
                ->map(fn ($name) => $this->assignments->normalizeGroupName((string) $name))
                ->filter()
                ->unique()
                ->map(function ($groupName) use ($assignment, $subjectId) {
                    return $this->assignments->resolveGroupIdByName($groupName, $assignment->teacher_id, $subjectId);
                })
                ->values()
                ->all();

            if (empty($newGroupIds)) {
                return response()->json(['message' => 'Выберите хотя бы одну группу из назначенной учебной нагрузки.'], 422);
            }
        }

        $newCriteria = $request->has('criteria')
            ? $this->assignments->normalizeCriteriaInput(is_array($request->input('criteria', [])) ? $request->input('criteria', []) : [])
            : null;
        $newAllowedFormats = $request->has('allowed_formats') ? $request->input('allowed_formats', []) : null;

        unset($validated['student_groups'], $validated['criteria'], $validated['allowed_formats'], $validated['max_score']);
        $validated['max_score'] = 100;
        $assignment->update($validated);
        if (is_array($newGroupIds)) {
            $assignment->groups()->sync($newGroupIds);
        }
        if (is_array($newCriteria)) {
            $this->assignments->syncCriteria($assignment, $newCriteria);
        }
        if (is_array($newAllowedFormats)) {
            $this->assignments->syncAllowedFormats($assignment, $newAllowedFormats);
        }

        $fresh = $assignment->fresh()->load([
            'teacher:id,login,last_name,first_name,middle_name,grade_scale',
            'subject:id,name',
            'groups:id,name',
            'criteriaItems:id,assignment_id,position,text,max_points',
            'allowedFormatItems:id,assignment_id,format',
            'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
        ]);

        $shouldNotifyUpdate = $fresh->status !== 'archived'
            && (
                is_array($newGroupIds)
                || isset($validated['deadline'])
                || isset($validated['title'])
                || isset($validated['description'])
                || isset($validated['status'])
            );

        if ($shouldNotifyUpdate) {
            try {
                app(AssignmentNotificationService::class)->notifyAssignmentUpdated($fresh);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'success' => true,
            'assignment' => $fresh,
        ]);
    }

    public function destroy(Assignment $assignment)
    {
        $assignment->loadMissing('materialItems');
        foreach ($assignment->materialItems as $material) {
            if (! empty($material->file_path) && Storage::disk('public')->exists($material->file_path)) {
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
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($removeIds->isNotEmpty()) {
            $materialsToDelete = $assignment->materialItems()
                ->whereIn('id', $removeIds->all())
                ->get();

            foreach ($materialsToDelete as $material) {
                if (! empty($material->file_path) && Storage::disk('public')->exists($material->file_path)) {
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
                'file_size' => $this->assignments->formatFileSize($file->getSize()),
                'file_type' => $file->getClientMimeType(),
            ]);
        }

        return response()->json([
            'success' => true,
            'assignment' => $assignment->fresh()->load([
                'teacher:id,login,last_name,first_name,middle_name,grade_scale',
                'subject:id,name',
                'groups:id,name',
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

        if (! $canDownload) {
            return response()->json(['message' => 'Недостаточно прав для скачивания материала.'], 403);
        }

        if (empty($material->file_path) || ! Storage::disk('public')->exists($material->file_path)) {
            return response()->json(['message' => 'Файл не найден.'], 404);
        }

        return Storage::disk('public')->download(
            $material->file_path,
            $material->file_name ?: basename($material->file_path)
        );
    }
}
