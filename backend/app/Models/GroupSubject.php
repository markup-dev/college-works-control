<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GroupSubject extends Model
{
    use HasFactory;

    protected $fillable = [
        'group_id',
        'subject_id',
        'specialty_program_subject_id',
        'course',
        'position',
        'status',
        'closed_at',
        'note',
    ];

    protected $casts = [
        'course' => 'integer',
        'position' => 'integer',
        'closed_at' => 'datetime',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function sourceProgramSubject(): BelongsTo
    {
        return $this->belongsTo(SpecialtyProgramSubject::class, 'specialty_program_subject_id');
    }
}
