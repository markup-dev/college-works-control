<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\AssignmentMaterial;
use App\Models\AssignmentTemplate;
use App\Models\AssignmentTemplateMaterial;
use App\Models\Group;
use App\Models\Subject;
use App\Models\TeachingLoad;
use App\Services\AssignmentNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AssignmentTemplateController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'teacher') {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $templates = AssignmentTemplate::query()
            ->where('teacher_id', $user->id)
            ->with([
                'subjectRelation:id,name',
                'criteriaItems:id,assignment_template_id,position,text,max_points',
                'allowedFormatItems:id,assignment_template_id,format',
                'materialItems:id,assignment_template_id,file_name,file_path,file_size,file_type,created_at',
            ])
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'data' => $templates->map(fn (AssignmentTemplate $t) => $this->serializeTemplate($t)),
        ]);
    }

    public function show(Request $request, AssignmentTemplate $assignmentTemplate)
    {
        $this->authorizeTemplate($request, $assignmentTemplate);
        $assignmentTemplate->load([
            'subjectRelation:id,name',
            'criteriaItems:id,assignment_template_id,position,text,max_points',
            'allowedFormatItems:id,assignment_template_id,format',
            'materialItems:id,assignment_template_id,file_name,file_path,file_size,file_type,created_at',
        ]);

        return response()->json($this->serializeTemplate($assignmentTemplate));
    }

    public function storeFromAssignment(Request $request, Assignment $assignment)
    {
        $user = $request->user();
        if ($user->role !== 'teacher' || (int) $assignment->teacher_id !== (int) $user->id) {
            return response()->json(['message' => 'Недостаточно прав'], 403);
        }

        $assignment->load([
            'criteriaItems',
            'allowedFormatItems',
            'materialItems',
        ]);

        $alreadyInBank = AssignmentTemplate::query()
            ->where('teacher_id', $user->id)
            ->where('source_assignment_id', $assignment->id)
            ->exists();

        if ($alreadyInBank) {
            return response()->json([
                'message' => 'Это задание уже добавлено в банк. Откройте «Банк заданий», чтобы изменить заготовку.',
            ], 422);
        }

        $template = DB::transaction(function () use ($assignment, $user) {
            $t = AssignmentTemplate::create([
                'teacher_id' => $user->id,
                'source_assignment_id' => $assignment->id,
                'title' => $assignment->title,
                'subject_id' => $assignment->subject_id,
                'description' => $assignment->description,
                'submission_type' => $assignment->submission_type ?? 'file',
                'max_file_size' => $assignment->max_file_size,
            ]);

            foreach ($assignment->criteriaItems as $c) {
                $t->criteriaItems()->create([
                    'position' => $c->position,
                    'text' => $c->text,
                    'max_points' => $c->max_points,
                ]);
            }
            foreach ($assignment->allowedFormatItems as $f) {
                $t->allowedFormatItems()->create(['format' => $f->format]);
            }
            foreach ($assignment->materialItems as $m) {
                $this->copyMaterialRowToTemplate($m, $t);
            }

            return $t->fresh([
                'subjectRelation:id,name',
                'criteriaItems:id,assignment_template_id,position,text,max_points',
                'allowedFormatItems:id,assignment_template_id,format',
                'materialItems:id,assignment_template_id,file_name,file_path,file_size,file_type,created_at',
            ]);
        });

        return response()->json([
            'success' => true,
            'template' => $this->serializeTemplate($template),
        ], 201);
    }

    public function update(Request $request, AssignmentTemplate $assignmentTemplate)
    {
        $this->authorizeTemplate($request, $assignmentTemplate);

        $validated = $request->validate(
            [
                'title' => ['sometimes', 'required', 'string', 'min:3', 'max:255'],
                'subject_id' => ['sometimes', 'required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
                'description' => ['nullable', 'string', 'min:10', 'max:5000'],
                'submission_type' => ['nullable', 'in:file,demo'],
                'criteria' => ['nullable', 'array', 'max:20'],
                'criteria.*.text' => ['nullable', 'string', 'max:500'],
                'criteria.*.max_points' => ['nullable', 'integer', 'min:1', 'max:100'],
                'allowed_formats' => ['nullable', 'array', 'max:20'],
                'allowed_formats.*' => ['string', 'max:30'],
                'max_file_size' => ['nullable', 'integer', 'min:1', 'max:102400'],
            ],
            [
                'title.required' => 'Введите название.',
                'description.min' => 'Описание должно содержать минимум 10 символов.',
            ]
        );

        $subjectId = (int) ($validated['subject_id'] ?? $assignmentTemplate->subject_id);
        if (! $this->teacherCanTeachSubject($request->user()->id, $subjectId)) {
            return response()->json(['message' => 'Выберите дисциплину из назначенной учебной нагрузки.'], 422);
        }

        $criteria = $request->has('criteria')
            ? $this->normalizeCriteriaInput(is_array($request->input('criteria', [])) ? $request->input('criteria', []) : [])
            : null;
        $formats = $request->has('allowed_formats') ? $request->input('allowed_formats', []) : null;

        unset($validated['criteria'], $validated['allowed_formats']);
        $assignmentTemplate->update($validated);

        if (is_array($criteria)) {
            $this->syncTemplateCriteria($assignmentTemplate, $criteria);
        }
        if (is_array($formats)) {
            $this->syncTemplateFormats($assignmentTemplate, $formats);
        }

        $fresh = $assignmentTemplate->fresh()->load([
            'subjectRelation:id,name',
            'criteriaItems:id,assignment_template_id,position,text,max_points',
            'allowedFormatItems:id,assignment_template_id,format',
            'materialItems:id,assignment_template_id,file_name,file_path,file_size,file_type,created_at',
        ]);

        return response()->json([
            'success' => true,
            'template' => $this->serializeTemplate($fresh),
        ]);
    }

    public function destroy(Request $request, AssignmentTemplate $assignmentTemplate)
    {
        $this->authorizeTemplate($request, $assignmentTemplate);
        $assignmentTemplate->loadMissing('materialItems');
        foreach ($assignmentTemplate->materialItems as $material) {
            if (! empty($material->file_path) && Storage::disk('public')->exists($material->file_path)) {
                Storage::disk('public')->delete($material->file_path);
            }
        }
        $assignmentTemplate->delete();

        return response()->json(['success' => true]);
    }

    public function publish(Request $request, AssignmentTemplate $assignmentTemplate)
    {
        $this->authorizeTemplate($request, $assignmentTemplate);
        $user = $request->user();

        $validated = $request->validate(
            [
                'deadline' => ['required', 'date', 'after_or_equal:today'],
                'student_groups' => ['required', 'array', 'min:1', 'max:20'],
                'student_groups.*' => ['string', 'max:50', 'regex:/^[А-ЯЁA-Z0-9-]+$/iu'],
            ],
            [
                'deadline.after_or_equal' => 'Срок сдачи не может быть в прошлом.',
                'student_groups.*.regex' => 'Название группы может содержать только буквы, цифры и дефис.',
            ]
        );

        $assignmentTemplate->load([
            'criteriaItems',
            'allowedFormatItems',
            'materialItems',
            'subjectRelation:id,name',
        ]);

        $subjectId = (int) $assignmentTemplate->subject_id;
        if ($subjectId < 1 || ! Subject::query()->where('id', $subjectId)->where('status', 'active')->exists()) {
            return response()->json(['message' => 'У заготовки не указан действующий предмет. Отредактируйте её в банке.'], 422);
        }

        if (! $this->teacherCanTeachSubject($user->id, $subjectId)) {
            return response()->json(['message' => 'Нет прав выдавать задание по этому предмету.'], 422);
        }

        $description = trim((string) $assignmentTemplate->description);
        if ($description === '' || mb_strlen($description) < 10) {
            return response()->json(['message' => 'Добавьте описание заготовки (минимум 10 символов) в банке.'], 422);
        }

        $groupIds = collect($validated['student_groups'])
            ->map(fn ($name) => $this->normalizeGroupName((string) $name))
            ->filter()
            ->unique()
            ->map(function ($groupName) use ($user, $subjectId) {
                return $this->resolveGroupIdByName($groupName, $user->id, $subjectId);
            })
            ->values()
            ->all();

        $criteriaRows = $assignmentTemplate->criteriaItems->map(fn ($c) => [
            'text' => $c->text,
            'max_points' => (int) $c->max_points,
        ])->values()->all();
        if (! empty($criteriaRows)) {
            $total = collect($criteriaRows)->sum('max_points');
            if ($total !== 100) {
                return response()->json(['message' => "Сумма баллов по критериям в заготовке должна быть 100 (сейчас {$total})."], 422);
            }
        }

        $assignment = DB::transaction(function () use ($assignmentTemplate, $user, $validated, $subjectId, $groupIds) {
            $a = Assignment::create([
                'title' => $assignmentTemplate->title,
                'subject_id' => $subjectId,
                'description' => $assignmentTemplate->description,
                'deadline' => $validated['deadline'],
                'status' => 'active',
                'max_score' => 100,
                'submission_type' => $assignmentTemplate->submission_type ?? 'file',
                'max_file_size' => $assignmentTemplate->max_file_size,
                'teacher_id' => $user->id,
            ]);
            $a->groups()->sync($groupIds);

            foreach ($assignmentTemplate->criteriaItems as $c) {
                $a->criteriaItems()->create([
                    'position' => $c->position,
                    'text' => $c->text,
                    'max_points' => $c->max_points,
                ]);
            }
            foreach ($assignmentTemplate->allowedFormatItems as $f) {
                $a->allowedFormatItems()->create(['format' => $f->format]);
            }
            foreach ($assignmentTemplate->materialItems as $m) {
                $this->copyTemplateMaterialToAssignment($m, $a);
            }

            return $a->fresh([
                'teacher:id,login,last_name,first_name,middle_name,grade_scale',
                'subjectRelation:id,name',
                'groups:id,name',
                'criteriaItems:id,assignment_id,position,text,max_points',
                'allowedFormatItems:id,assignment_id,format',
                'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
            ]);
        });

        try {
            app(AssignmentNotificationService::class)->notifyNewAssignment($assignment);
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'success' => true,
            'assignment_id' => $assignment->id,
            'assignment' => $assignment,
        ], 201)->header('X-Created-Assignment-Id', (string) $assignment->id);
    }

    public function uploadMaterials(Request $request, AssignmentTemplate $assignmentTemplate)
    {
        $this->authorizeTemplate($request, $assignmentTemplate);

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
                'files.*.mimes' => 'Недопустимый формат файла.',
            ]
        );

        $removeIds = collect($validated['remove_ids'] ?? [])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($removeIds->isNotEmpty()) {
            $toDelete = $assignmentTemplate->materialItems()
                ->whereIn('id', $removeIds->all())
                ->get();
            foreach ($toDelete as $material) {
                if (! empty($material->file_path) && Storage::disk('public')->exists($material->file_path)) {
                    Storage::disk('public')->delete($material->file_path);
                }
                $material->delete();
            }
        }

        foreach ($request->file('files', []) as $file) {
            $storedPath = $file->store('assignment-template-materials', 'public');
            $assignmentTemplate->materialItems()->create([
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $storedPath,
                'file_size' => $this->formatFileSize($file->getSize()),
                'file_type' => $file->getClientMimeType(),
            ]);
        }

        $assignmentTemplate->touch();

        return response()->json([
            'success' => true,
            'template' => $this->serializeTemplate($assignmentTemplate->fresh()->load([
                'subjectRelation:id,name',
                'criteriaItems:id,assignment_template_id,position,text,max_points',
                'allowedFormatItems:id,assignment_template_id,format',
                'materialItems:id,assignment_template_id,file_name,file_path,file_size,file_type,created_at',
            ])),
        ]);
    }

    public function downloadMaterial(
        Request $request,
        AssignmentTemplate $assignmentTemplate,
        AssignmentTemplateMaterial $material
    ) {
        $this->authorizeTemplate($request, $assignmentTemplate);
        if ((int) $material->assignment_template_id !== (int) $assignmentTemplate->id) {
            return response()->json(['message' => 'Материал не принадлежит заготовке.'], 404);
        }
        if (empty($material->file_path) || ! Storage::disk('public')->exists($material->file_path)) {
            return response()->json(['message' => 'Файл не найден.'], 404);
        }

        return Storage::disk('public')->download(
            $material->file_path,
            $material->file_name ?: basename($material->file_path)
        );
    }

    private function authorizeTemplate(Request $request, AssignmentTemplate $assignmentTemplate): void
    {
        $user = $request->user();
        if ($user->role !== 'teacher' || (int) $assignmentTemplate->teacher_id !== (int) $user->id) {
            abort(response()->json(['message' => 'Недостаточно прав'], 403));
        }
    }

    private function serializeTemplate(AssignmentTemplate $t): array
    {
        return [
            'id' => $t->id,
            'teacher_id' => $t->teacher_id,
            'source_assignment_id' => $t->source_assignment_id,
            'title' => $t->title,
            'subject_id' => $t->subject_id,
            'description' => $t->description,
            'submission_type' => $t->submission_type,
            'max_file_size' => $t->max_file_size,
            'created_at' => $t->created_at?->toIso8601String(),
            'updated_at' => $t->updated_at?->toIso8601String(),
            'subject_relation' => $t->relationLoaded('subjectRelation') && $t->subjectRelation
                ? ['id' => $t->subjectRelation->id, 'name' => $t->subjectRelation->name]
                : null,
            'criteria' => $t->criteria,
            'allowed_formats' => $t->allowed_formats,
            'material_files' => $t->material_files,
        ];
    }

    private function copyMaterialRowToTemplate(AssignmentMaterial $m, AssignmentTemplate $t): void
    {
        if (empty($m->file_path) || ! Storage::disk('public')->exists($m->file_path)) {
            return;
        }
        $dir = 'assignment-template-materials/'.$t->id;
        $base = basename($m->file_path);
        $target = $dir.'/'.$base;
        $i = 1;
        while (Storage::disk('public')->exists($target)) {
            $target = $dir.'/'.$i.'_'.$base;
            $i++;
        }
        Storage::disk('public')->copy($m->file_path, $target);
        $t->materialItems()->create([
            'file_name' => $m->file_name,
            'file_path' => $target,
            'file_size' => $m->file_size,
            'file_type' => $m->file_type,
        ]);
    }

    private function copyTemplateMaterialToAssignment(AssignmentTemplateMaterial $m, Assignment $a): void
    {
        if (empty($m->file_path) || ! Storage::disk('public')->exists($m->file_path)) {
            return;
        }
        $storedPath = 'assignment-materials/'.uniqid('tmpl_', true).'_'.preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($m->file_path));
        Storage::disk('public')->copy($m->file_path, $storedPath);
        $a->materialItems()->create([
            'file_name' => $m->file_name,
            'file_path' => $storedPath,
            'file_size' => $m->file_size,
            'file_type' => $m->file_type,
        ]);
    }

    private function syncTemplateCriteria(AssignmentTemplate $template, array $criteria): void
    {
        $template->criteriaItems()->delete();
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
            $template->criteriaItems()->createMany($rows);
        }
    }

    private function syncTemplateFormats(AssignmentTemplate $template, array $allowedFormats): void
    {
        $template->allowedFormatItems()->delete();
        $rows = collect($allowedFormats)
            ->filter(fn ($format) => is_string($format) && trim($format) !== '')
            ->map(fn ($format) => ['format' => trim($format)])
            ->unique('format')
            ->values()
            ->all();

        if (! empty($rows)) {
            $template->allowedFormatItems()->createMany($rows);
        }
    }

    private function normalizeCriteriaInput(array $criteria): array
    {
        $rows = collect($criteria)
            ->filter(fn ($criterion) => is_array($criterion))
            ->map(function ($criterion, $index) {
                $text = trim((string) ($criterion['text'] ?? ''));

                return [
                    'position' => (int) $index,
                    'text' => $text,
                    'max_points' => (int) ($criterion['max_points'] ?? $criterion['maxPoints'] ?? 0),
                ];
            })
            ->filter(fn ($row) => $row['text'] !== '')
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

    private function formatFileSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1).' MB';
        }

        return round($bytes / 1024, 1).' KB';
    }

    private function normalizeGroupName(string $name): string
    {
        $normalized = trim($name);
        $normalized = preg_replace('/\s+/u', ' ', $normalized) ?? $normalized;
        $normalized = str_replace(['—', '–', '−'], '-', $normalized);

        return mb_strtoupper($normalized);
    }

    private function resolveGroupIdByName(string $groupName, int $teacherId, int $subjectId): int
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

    private function teacherCanTeachSubject(int $teacherId, int $subjectId): bool
    {
        return TeachingLoad::where('teacher_id', $teacherId)
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->exists();
    }
}
