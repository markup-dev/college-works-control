<?php

namespace App\Models;

use App\Traits\CamelCaseSerializable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Course extends Model
{
    use HasFactory, CamelCaseSerializable;

    protected $fillable = [
        'name',
        'teacher_id',
        'students_count',
        'status',
    ];

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }
}
