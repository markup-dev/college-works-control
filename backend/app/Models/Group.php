<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
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
        'specialty',
        'status',
    ];

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
}
