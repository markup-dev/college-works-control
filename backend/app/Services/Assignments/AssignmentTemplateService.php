<?php

namespace App\Services\Assignments;

use App\Models\Assignment;
use App\Models\AssignmentMaterial;
use App\Models\AssignmentTemplate;
use App\Models\AssignmentTemplateMaterial;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Шаблоны заданий: сериализация для API, копирование файлов между шаблоном и реальным заданием, синхронизация критериев и форматов.
 */
class AssignmentTemplateService
{
    /** @return array<string, mixed> */
    public function serializeTemplateSummary(AssignmentTemplate $t): array
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
            'subject' => $t->relationLoaded('subject') && $t->subject
                ? ['id' => $t->subject->id, 'name' => $t->subject->name]
                : null,
            'criteria_count' => (int) ($t->criteria_items_count ?? 0),
            'material_files_count' => (int) ($t->material_items_count ?? 0),
        ];
    }

    /** @return array<string, mixed> */
    public function serializeTemplate(AssignmentTemplate $t): array
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
            'subject' => $t->relationLoaded('subject') && $t->subject
                ? ['id' => $t->subject->id, 'name' => $t->subject->name]
                : null,
            'criteria' => $t->criteria,
            'allowed_formats' => $t->allowed_formats,
            'material_files' => $t->material_files,
        ];
    }

    public function copyAssignmentMaterialToTemplate(AssignmentMaterial $m, AssignmentTemplate $t): void
    {
        if (empty($m->file_path) || ! Storage::disk('public')->exists($m->file_path)) {
            return;
        }
        $dir = 'assignment-template-materials/' . $t->id;
        $base = basename($m->file_path);
        $target = $dir . '/' . $base;
        $i = 1;
        while (Storage::disk('public')->exists($target)) {
            $target = $dir . '/' . $i . '_' . $base;
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

    public function copyTemplateMaterialToAssignment(AssignmentTemplateMaterial $m, Assignment $a): void
    {
        if (empty($m->file_path) || ! Storage::disk('public')->exists($m->file_path)) {
            return;
        }

        $a->materialItems()->create([
            'file_name' => $m->file_name,
            'file_path' => $m->file_path,
            'file_size' => $m->file_size,
            'file_type' => $m->file_type,
        ]);
    }

    /** Удалить файл из storage, если на него больше нет ссылок в заданиях и заготовках. */
    public function deletePublicFileIfUnreferenced(string $filePath): void
    {
        if ($filePath === '' || ! Storage::disk('public')->exists($filePath)) {
            return;
        }

        $usedByAssignment = AssignmentMaterial::query()->where('file_path', $filePath)->exists();
        $usedByTemplate = AssignmentTemplateMaterial::query()->where('file_path', $filePath)->exists();

        if (! $usedByAssignment && ! $usedByTemplate) {
            Storage::disk('public')->delete($filePath);
        }
    }

    public function syncTemplateCriteria(AssignmentTemplate $template, array $criteria): void
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

    public function syncTemplateFormats(AssignmentTemplate $template, array $allowedFormats): void
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

    public function normalizeCriteriaInput(array $criteria): array
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

    public function createFromAssignment(Assignment $assignment, User $user): AssignmentTemplate
    {
        return DB::transaction(function () use ($assignment, $user) {
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
                $t->materialItems()->create([
                    'file_name' => $m->file_name,
                    'file_path' => $m->file_path,
                    'file_size' => $m->file_size,
                    'file_type' => $m->file_type,
                ]);
            }

            return $t->fresh([
                'subject:id,name',
                'criteriaItems:id,assignment_template_id,position,text,max_points',
                'allowedFormatItems:id,assignment_template_id,format',
                'materialItems:id,assignment_template_id,file_name,file_path,file_size,file_type,created_at',
            ]);
        });
    }

    /**
     * @param  array{deadline: string}  $validated  Поля publish после validate контроллера
     */
    public function createAssignmentFromTemplate(
        AssignmentTemplate $assignmentTemplate,
        User $user,
        array $validated,
        int $subjectId,
        array $groupIds,
    ): Assignment {
        return DB::transaction(function () use ($assignmentTemplate, $user, $validated, $subjectId, $groupIds) {
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

            $criteriaRows = $assignmentTemplate->criteriaItems
                ->map(fn ($c) => [
                    'position' => $c->position,
                    'text' => $c->text,
                    'max_points' => $c->max_points,
                ])
                ->values()
                ->all();
            if ($criteriaRows !== []) {
                $a->criteriaItems()->createMany($criteriaRows);
            }

            $formatRows = $assignmentTemplate->allowedFormatItems
                ->map(fn ($f) => ['format' => $f->format])
                ->values()
                ->all();
            if ($formatRows !== []) {
                $a->allowedFormatItems()->createMany($formatRows);
            }

            $materialRows = $assignmentTemplate->materialItems
                ->map(fn ($m) => [
                    'file_name' => $m->file_name,
                    'file_path' => $m->file_path,
                    'file_size' => $m->file_size,
                    'file_type' => $m->file_type,
                ])
                ->values()
                ->all();
            if ($materialRows !== []) {
                $a->materialItems()->createMany($materialRows);
            }

            return $a->load([
                'teacher:id,login,last_name,first_name,middle_name,grade_scale',
                'subject:id,name',
                'groups:id,name',
                'criteriaItems:id,assignment_id,position,text,max_points',
                'allowedFormatItems:id,assignment_id,format',
                'materialItems:id,assignment_id,file_name,file_path,file_size,file_type,created_at',
            ]);
        });
    }

    public function deleteTemplate(AssignmentTemplate $assignmentTemplate): void
    {
        $assignmentTemplate->loadMissing('materialItems');
        foreach ($assignmentTemplate->materialItems as $material) {
            $path = (string) ($material->file_path ?? '');
            $material->delete();
            if ($path !== '') {
                $this->deletePublicFileIfUnreferenced($path);
            }
        }
        $assignmentTemplate->delete();
    }
}
