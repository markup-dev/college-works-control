<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Критерий в шаблоне задания (копируется в AssignmentCriterion при публикации шаблона).
 */
class AssignmentTemplateCriterion extends Model
{
    protected $fillable = [
        'assignment_template_id',
        'position',
        'text',
        'max_points',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'max_points' => 'integer',
        ];
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(AssignmentTemplate::class, 'assignment_template_id');
    }
}
