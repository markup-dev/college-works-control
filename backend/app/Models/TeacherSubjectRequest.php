<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class TeacherSubjectRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'teacher_id',
        'subject_id',
        'comment',
        'status',
        'resolved_by',
        'resolved_at',
        'admin_comment',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(TeacherRequestDocument::class, 'documentable')
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
