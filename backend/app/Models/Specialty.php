<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Specialty extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'study_years',
        'status',
        'program_updated_at',
    ];

    protected $casts = [
        'study_years' => 'integer',
        'program_updated_at' => 'datetime',
    ];

    public function programSubjects(): HasMany
    {
        return $this->hasMany(SpecialtyProgramSubject::class);
    }

    public function programSnapshots(): HasMany
    {
        return $this->hasMany(SpecialtyProgramSnapshot::class);
    }

    public function groups(): HasMany
    {
        return $this->hasMany(Group::class);
    }
}
