<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpecialtyProgramSubject extends Model
{
    use HasFactory;

    protected $fillable = [
        'specialty_id',
        'subject_id',
        'course',
        'position',
        'note',
    ];

    protected $casts = [
        'course' => 'integer',
        'position' => 'integer',
    ];

    public function specialty(): BelongsTo
    {
        return $this->belongsTo(Specialty::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }
}
