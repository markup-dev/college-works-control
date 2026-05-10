<?php

namespace App\Http\Controllers\Admin\Concerns;

use App\Models\SystemLog;
use Illuminate\Http\Request;

/**
 * Трейт для админ-контроллеров: пишет запись в system_logs после значимых действий.
 */
trait LogsAdminActions
{
    /**
     * Зафиксировать действие текущего администратора в журнале.
     */
    protected function log(Request $request, string $action, string $details): void
    {
        $user = $request->user();
        SystemLog::create([
            'user_id' => $user->id,
            'action' => $action,
            'details' => $details,
        ]);
    }
}
