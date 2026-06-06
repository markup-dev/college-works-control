<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class TeachingLoadRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'teacher_id',
        'subject_id',
        'group_id',
        'comment',
        'document_path',
        'document_name',
        'document_type',
        'status',
        'resolved_by',
        'resolved_at',
        'admin_comment',
        'teaching_load_id',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    protected $appends = [
        'document_url',
    ];

    public function getDocumentUrlAttribute(): ?string
    {
        if (! $this->document_path) {
            return null;
        }

        return URL::to(Storage::disk('public')->url($this->document_path));
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function teachingLoad(): BelongsTo
    {
        return $this->belongsTo(TeachingLoad::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
