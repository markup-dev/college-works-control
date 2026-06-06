<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SpecialtyProgramSnapshot extends Model
{
    protected $fillable = [
        'specialty_id',
        'effective_from',
        'effective_to',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function specialty(): BelongsTo
    {
        return $this->belongsTo(Specialty::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SpecialtyProgramSnapshotItem::class, 'snapshot_id');
    }
}
