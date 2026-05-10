<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Прикреплённый к заданию файл методички/инструкции (путь в storage и метаданные).
 */
class AssignmentMaterial extends Model
{
    use HasFactory;

    protected $fillable = [
        'assignment_id',
        'file_name',
        'file_path',
        'file_size',
        'file_type',
    ];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }
}
