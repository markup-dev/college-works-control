<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Задание преподавателя: дедлайн, тип сдачи, привязка к группам и предмету; критерии, форматы файлов и материалы — отдельные таблицы.
 * Appends собирают вложенные структуры для API; syncCompletionStatus переводит в archived при полной сдаче и оценке всех студентов целевых групп.
 */
class Assignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'subject_id',
        'description',
        'deadline',
        'status',
        'max_score',
        'submission_type',
        'max_file_size',
        'teacher_id',
    ];

    protected $appends = [
        'criteria',
        'allowed_formats',
        'material_files',
        'is_completed',
    ];

    protected function casts(): array
    {
        return [
            'deadline' => 'date',
        ];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class, 'subject_id');
    }

    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(Group::class, 'assignment_group');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    public function criteriaItems(): HasMany
    {
        return $this->hasMany(AssignmentCriterion::class)->orderBy('position');
    }

    public function allowedFormatItems(): HasMany
    {
        return $this->hasMany(AssignmentAllowedFormat::class);
    }

    public function materialItems(): HasMany
    {
        return $this->hasMany(AssignmentMaterial::class);
    }

    public function getCriteriaAttribute(): array
    {
        $items = $this->relationLoaded('criteriaItems')
            ? $this->criteriaItems
            : $this->criteriaItems()->get();

        return $items->map(fn($item) => [
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

        return $items->map(fn($item) => [
            'id' => (int) $item->id,
            'file_name' => (string) $item->file_name,
            'file_size' => $item->file_size,
            'file_type' => $item->file_type,
            'created_at' => optional($item->created_at)->toISOString(),
        ])->values()->all();
    }

    public function getIsCompletedAttribute(): bool
    {
        return $this->status === 'archived';
    }

    public function getMaxScoreAttribute($value): int
    {
        return 100;
    }

    public function setMaxScoreAttribute($value): void
    {
        $this->attributes['max_score'] = 100;
    }

    public function calculateCompletionMetrics(): array
    {
        $this->loadMissing([
            'groups.students:id,role,group_id',
        ]);

        $targetStudentIds = $this->groups
            ->flatMap(fn($group) => $group->students)
            ->filter(fn($student) => $student->role === 'student')
            ->pluck('id')
            ->unique()
            ->values();

        if ($targetStudentIds->isEmpty()) {
            return [
                'total_students' => 0,
                'submitted_students' => 0,
                'graded_students' => 0,
                'pending_students' => 0,
                'returned_students' => 0,
                'completion_rate' => 0,
            ];
        }

        $latestSubmissionsByStudent = $this->submissions()
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->get(['id', 'assignment_id', 'student_id', 'status', 'submitted_at', 'created_at'])
            ->unique('student_id')
            ->keyBy('student_id');

        $latestForTargets = $targetStudentIds
            ->map(fn($studentId) => $latestSubmissionsByStudent->get($studentId))
            ->filter();

        $submittedStudents = $latestForTargets->count();
        $gradedStudents = $latestForTargets->where('status', 'graded')->count();
        $pendingStudents = $latestForTargets->where('status', 'submitted')->count();
        $returnedStudents = $latestForTargets->where('status', 'returned')->count();
        $totalStudents = $targetStudentIds->count();

        return [
            'total_students' => $totalStudents,
            'submitted_students' => $submittedStudents,
            'graded_students' => $gradedStudents,
            'pending_students' => $pendingStudents,
            'returned_students' => $returnedStudents,
            'completion_rate' => $totalStudents > 0 ? (int) round(($submittedStudents / $totalStudents) * 100) : 0,
        ];
    }

    public function syncCompletionStatus(): void
    {
        $metrics = $this->calculateCompletionMetrics();
        $totalStudents = (int) ($metrics['total_students'] ?? 0);
        $submittedStudents = (int) ($metrics['submitted_students'] ?? 0);
        $gradedStudents = (int) ($metrics['graded_students'] ?? 0);

        // Архив только когда у каждого студента из целевых групп есть сдача и последняя версия оценена.
        // Раньше при частичной eager-load связи submissions (например, только текущий студент) метрики
        // искажались и задание ошибочно уходило в archived — студент с просроченным дедлайном терял сдачу.
        $nextStatus = (
            $totalStudents > 0
            && $submittedStudents === $totalStudents
            && $gradedStudents === $totalStudents
        ) ? 'archived' : 'active';

        if ($this->status !== $nextStatus) {
            $this->update(['status' => $nextStatus]);
        }
    }

}
