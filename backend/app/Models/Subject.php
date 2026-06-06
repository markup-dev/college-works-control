<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Справочник дисциплины: код, название, статус; задания и строки преподавательской нагрузки ссылаются на дисциплина.
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

    public function specialtyProgramSubjects(): HasMany
    {
        return $this->hasMany(SpecialtyProgramSubject::class);
    }

    public function groupSubjects(): HasMany
    {
        return $this->hasMany(GroupSubject::class);
    }

    public function teacherSubjects(): HasMany
    {
        return $this->hasMany(TeacherSubject::class);
    }
}
