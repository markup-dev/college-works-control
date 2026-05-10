<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Сдача работы студентом по заданию: файл или демонстрация, статусы submitted/graded/returned, баллы и разбивка по критериям.
 * Цепочка пересдач через previous_submission_id; текстовая оценка (метка) берётся со шкалы преподавателя задания.
 */
class Submission extends Model
{
    use HasFactory;

    protected $fillable = [
        'assignment_id',
        'student_id',
        'status',
        'score',
        'comment',
        'teacher_comment',
        'criterion_scores',
        'file_name',
        'file_path',
        'file_size',
        'file_type',
        'is_resubmission',
        'previous_submission_id',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'is_resubmission' => 'boolean',
            'submitted_at' => 'datetime',
            'score' => 'integer',
            'criterion_scores' => 'array',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function previousSubmission(): BelongsTo
    {
        return $this->belongsTo(Submission::class, 'previous_submission_id');
    }

    public function gradeLabel(): ?string
    {
        if ($this->score === null) {
            return null;
        }

        $assignment = $this->relationLoaded('assignment')
            ? $this->assignment
            : $this->assignment()->with('teacher')->first();

        if (! $assignment) {
            return null;
        }

        $teacher = $assignment->relationLoaded('teacher')
            ? $assignment->teacher
            : $assignment->teacher()->first();

        return $teacher?->gradeLabelForScore((int) $this->score);
    }
}
