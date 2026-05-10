<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * История админской рассылки: аудитория, тема/текст, число получателей, опция копии на почту админа.
 */
class AdminBroadcast extends Model
{
    protected $fillable = [
        'admin_id',
        'audience_type',
        'group_ids',
        'subject',
        'body',
        'recipient_count',
        'copy_email',
    ];

    protected function casts(): array
    {
        return [
            'group_ids' => 'array',
            'copy_email' => 'boolean',
        ];
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
