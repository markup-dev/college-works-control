<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentTemplateCriterion extends Model
{
    protected $fillable = [
        'assignment_template_id',
        'position',
        'text',
        'max_points',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(AssignmentTemplate::class, 'assignment_template_id');
    }
}
