<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Справочник дисциплины: код, название, статус; задания и строки преподавательской нагрузки ссылаются на предмет.
 */
class Subject extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'status',
    ];

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class, 'subject_id');
    }

    public function teachingLoads(): HasMany
    {
        return $this->hasMany(TeachingLoad::class);
    }
}
