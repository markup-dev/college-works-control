<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Черновик/шаблон задания преподавателя (без дедлайна и статуса у студентов): структура как у Assignment, публикация создаёт реальное задание.
 */
class AssignmentTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'teacher_id',
        'source_assignment_id',
        'title',
        'subject_id',
        'description',
        'submission_type',
        'max_file_size',
    ];

    protected $appends = ['criteria', 'allowed_formats', 'material_files'];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class, 'subject_id');
    }

    public function sourceAssignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class, 'source_assignment_id');
    }

    public function criteriaItems(): HasMany
    {
        return $this->hasMany(AssignmentTemplateCriterion::class)->orderBy('position');
    }

    public function allowedFormatItems(): HasMany
    {
        return $this->hasMany(AssignmentTemplateAllowedFormat::class);
    }

    public function materialItems(): HasMany
    {
        return $this->hasMany(AssignmentTemplateMaterial::class);
    }

    public function getCriteriaAttribute(): array
    {
        $items = $this->relationLoaded('criteriaItems')
            ? $this->criteriaItems
            : $this->criteriaItems()->get();

        return $items->map(fn ($item) => [
            'text' => $item->text,
            'max_points' => (int) $item->max_points,
        ])->values()->all();
    }

    public function getAllowedFormatsAttribute(): array
    {
        $items = $this->relationLoaded('allowedFormatItems')
            ? $this->allowedFormatItems
            : $this->allowedFormatItems()->get();

        return $items->pluck('format')->values()->all();
    }

    public function getMaterialFilesAttribute(): array
    {
        $items = $this->relationLoaded('materialItems')
            ? $this->materialItems
            : $this->materialItems()->get();

        return $items->map(fn ($item) => [
            'id' => (int) $item->id,
            'file_name' => (string) $item->file_name,
            'file_size' => $item->file_size,
            'file_type' => $item->file_type,
            'created_at' => optional($item->created_at)->toISOString(),
        ])->values()->all();
    }
}
