<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\AssignmentTemplate;
use App\Models\AssignmentTemplateMaterial;
use App\Models\Subject;
use App\Services\AssignmentNotificationService;
use App\Services\Assignments\AssignmentService;
use App\Services\Assignments\AssignmentTemplateService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Банк шаблонов заданий преподавателя: CRUD, материалы, публикация шаблона в реальное задание с уведомлениями.
 */
class AssignmentTemplateController extends Controller
{
    public function __construct(
        private readonly AssignmentService $assignments,
        private readonly AssignmentTemplateService $templates,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'teacher') {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $items = AssignmentTemplate::query()
            ->where('teacher_id', $user->id)
            ->with([
                'subject:id,name',
                'criteriaItems:id,assignment_template_id,position,text,max_points',
                'allowedFormatItems:id,assignment_template_id,format',
                'materialItems:id,assignment_template_id,file_name,file_path,file_size,file_type,created_at',
            ])
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'data' => $items->map(fn (AssignmentTemplate $t) => $this->templates->serializeTemplate($t)),
        ]);
    }

    public function show(Request $request, AssignmentTemplate $assignmentTemplate)
    {
        $this->authorizeTemplate($request, $assignmentTemplate);
        $assignmentTemplate->load([
            'subject:id,name',
            'criteriaItems:id,assignment_template_id,position,text,max_points',
            'allowedFormatItems:id,assignment_template_id,format',
            'materialItems:id,assignment_template_id,file_name,file_path,file_size,file_type,created_at',
        ]);

        return response()->json($this->templates->serializeTemplate($assignmentTemplate));
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

        $template = $this->templates->createFromAssignment($assignment, $user);

        return response()->json([
            'success' => true,
            'template' => $this->templates->serializeTemplate($template),
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
        if (! $this->assignments->teacherCanTeachSubject($request->user()->id, $subjectId)) {
            return response()->json(['message' => 'Выберите дисциплину из назначенной учебной нагрузки.'], 422);
        }

        $criteria = $request->has('criteria')
            ? $this->templates->normalizeCriteriaInput(is_array($request->input('criteria', [])) ? $request->input('criteria', []) : [])
            : null;
        $formats = $request->has('allowed_formats') ? $request->input('allowed_formats', []) : null;

        unset($validated['criteria'], $validated['allowed_formats']);
        $assignmentTemplate->update($validated);

        if (is_array($criteria)) {
            $this->templates->syncTemplateCriteria($assignmentTemplate, $criteria);
        }
        if (is_array($formats)) {
            $this->templates->syncTemplateFormats($assignmentTemplate, $formats);
        }

        $fresh = $assignmentTemplate->fresh()->load([
            'subject:id,name',
            'criteriaItems:id,assignment_template_id,position,text,max_points',
            'allowedFormatItems:id,assignment_template_id,format',
            'materialItems:id,assignment_template_id,file_name,file_path,file_size,file_type,created_at',
        ]);

        return response()->json([
            'success' => true,
            'template' => $this->templates->serializeTemplate($fresh),
        ]);
    }

    public function destroy(Request $request, AssignmentTemplate $assignmentTemplate)
    {
        $this->authorizeTemplate($request, $assignmentTemplate);
        $this->templates->deleteTemplate($assignmentTemplate);

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
            'subject:id,name',
        ]);

        $subjectId = (int) $assignmentTemplate->subject_id;
        if ($subjectId < 1 || ! Subject::query()->where('id', $subjectId)->where('status', 'active')->exists()) {
            return response()->json(['message' => 'У заготовки не указан действующий предмет. Отредактируйте её в банке.'], 422);
        }

        if (! $this->assignments->teacherCanTeachSubject($user->id, $subjectId)) {
            return response()->json(['message' => 'Нет прав выдавать задание по этому предмету.'], 422);
        }

        $description = trim((string) $assignmentTemplate->description);
        if ($description === '' || mb_strlen($description) < 10) {
            return response()->json(['message' => 'Добавьте описание заготовки (минимум 10 символов) в банке.'], 422);
        }

        $groupIds = collect($validated['student_groups'])
            ->map(fn ($name) => $this->assignments->normalizeGroupName((string) $name))
            ->filter()
            ->unique()
            ->map(function ($groupName) use ($user, $subjectId) {
                return $this->assignments->resolveGroupIdByName($groupName, $user->id, $subjectId);
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

        $assignment = $this->templates->createAssignmentFromTemplate(
            $assignmentTemplate,
            $user,
            $validated,
            $subjectId,
            $groupIds
        );

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
                'file_size' => $this->assignments->formatFileSize($file->getSize()),
                'file_type' => $file->getClientMimeType(),
            ]);
        }

        $assignmentTemplate->touch();

        return response()->json([
            'success' => true,
            'template' => $this->templates->serializeTemplate($assignmentTemplate->fresh()->load([
                'subject:id,name',
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
}
