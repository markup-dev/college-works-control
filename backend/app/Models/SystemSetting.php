<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Ключ–значение настроек платформы: одна строка с полем data (массив), читается через SystemSettingsService.
 */
class SystemSetting extends Model
{
    protected $fillable = [
        'data',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
        ];
    }
}
