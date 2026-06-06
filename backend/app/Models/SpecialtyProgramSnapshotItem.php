<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpecialtyProgramSnapshotItem extends Model
{
    protected $fillable = [
        'snapshot_id',
        'subject_id',
        'course',
        'position',
        'note',
    ];

    protected $casts = [
        'course' => 'integer',
        'position' => 'integer',
    ];

    public function snapshot(): BelongsTo
    {
        return $this->belongsTo(SpecialtyProgramSnapshot::class, 'snapshot_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
