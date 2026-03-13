<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Assignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'course',
        'description',
        'deadline',
        'status',
        'priority',
        'max_score',
        'submission_type',
        'criteria',
        'student_groups',
        'allowed_formats',
        'max_file_size',
        'teacher_id',
    ];

    protected function casts(): array
    {
        return [
            'criteria' => 'array',
            'student_groups' => 'array',
            'allowed_formats' => 'array',
            'deadline' => 'date',
        ];
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }
}
