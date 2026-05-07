<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssignmentTemplateMaterial extends Model
{
    protected $fillable = [
        'assignment_template_id',
        'file_name',
        'file_path',
        'file_size',
        'file_type',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(AssignmentTemplate::class, 'assignment_template_id');
    }
}
