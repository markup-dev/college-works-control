<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class TeacherRequestDocument extends Model
{
    protected $fillable = [
        'path',
        'name',
        'type',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function documentable(): MorphTo
    {
        return $this->morphTo();
    }
}
