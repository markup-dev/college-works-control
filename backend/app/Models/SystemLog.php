<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Запись журнала аудита: кто (user_id), какое действие, произвольные детали JSON/текст, время события (без updated_at).
 */
class SystemLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'action',
        'details',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
