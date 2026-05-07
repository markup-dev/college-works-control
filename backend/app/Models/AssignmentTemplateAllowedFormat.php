<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentTemplateAllowedFormat extends Model
{
    protected $fillable = [
        'assignment_template_id',
        'format',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(AssignmentTemplate::class, 'assignment_template_id');
    }
}
