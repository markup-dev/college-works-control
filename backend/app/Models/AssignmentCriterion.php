<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Критерий оценивания задания: порядок, формулировка, максимум баллов по пункту рубрики.
 */
class AssignmentCriterion extends Model
{
    protected $fillable = [
        'assignment_id',
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

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }
}
