<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Учебная группа: студенты через group_id, Many-to-Many с заданиями, нагрузка преподавателей по группе.
 */
class Group extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'specialty_id',
        'specialty',
        'admission_year',
        'graduation_year',
        'study_years',
        'current_course',
        'status',
    ];

    protected $casts = [
        'admission_year' => 'integer',
        'graduation_year' => 'integer',
        'study_years' => 'integer',
        'current_course' => 'integer',
    ];

    public function specialtyRef(): BelongsTo
    {
        return $this->belongsTo(Specialty::class, 'specialty_id');
    }

    public function students(): HasMany
    {
        return $this->hasMany(User::class, 'group_id');
    }

    public function assignments(): BelongsToMany
    {
        return $this->belongsToMany(Assignment::class, 'assignment_group');
    }

    public function teachingLoads(): HasMany
    {
        return $this->hasMany(TeachingLoad::class);
    }

    public function groupSubjects(): HasMany
    {
        return $this->hasMany(GroupSubject::class);
    }

    public function activeGroupSubjects(): HasMany
    {
        return $this->hasMany(GroupSubject::class)
            ->where('status', 'active');
    }
}
