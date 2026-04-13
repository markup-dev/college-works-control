<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentAllowedFormat extends Model
{
    protected $fillable = [
        'assignment_id',
        'format',
    ];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }
}
