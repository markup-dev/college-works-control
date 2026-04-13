<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
}
