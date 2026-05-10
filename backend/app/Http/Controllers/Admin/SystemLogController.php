<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemLog;
use Illuminate\Http\Request;

/**
 * Админ: журнал системных и пользовательских событий с фильтрами и пагинацией.
 */
class SystemLogController extends Controller
{
    private const LOGS_PER_PAGE = 20;

    public function logs()
    {
        $validated = request()->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'action' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'in:student,teacher,admin,system'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'period' => ['nullable', 'in:all,today,week,month'],
            'sort' => ['nullable', 'in:newest,oldest'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = SystemLog::with('user:id,login,role,last_name,first_name,middle_name');

        $this->applySystemLogFilters($query, $validated);

        if (($validated['sort'] ?? 'newest') === 'oldest') {
            $query->oldest('created_at');
        } else {
            $query->latest('created_at');
        }

        $perPage = (int) ($validated['per_page'] ?? self::LOGS_PER_PAGE);
        $logs = $query->paginate($perPage)->withQueryString();

        $items = collect($logs->items())
            ->map(fn($log) => [
                'id' => $log->id,
                'timestamp' => $log->created_at,
                'user' => $log->user?->full_name ?: ($log->user?->login ?? 'Система'),
                'user_role' => $log->user?->role ?? 'system',
                'action' => $log->action,
                'details' => $log->details,
            ]);

        return response()->json([
            'data' => $items->values(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    public function exportLogsCsv(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'action' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'in:student,teacher,admin,system'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'period' => ['nullable', 'in:all,today,week,month'],
            'sort' => ['nullable', 'in:newest,oldest'],
        ]);

        $query = SystemLog::with('user:id,login,role,last_name,first_name,middle_name');
        $this->applySystemLogFilters($query, $validated);

        if (($validated['sort'] ?? 'newest') === 'oldest') {
            $query->oldest('created_at');
        } else {
            $query->latest('created_at');
        }

        $query->limit(5000);
        $rows = $query->get();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($out, ['id', 'created_at', 'user', 'role', 'action', 'details'], ';');
            foreach ($rows as $log) {
                fputcsv($out, [
                    $log->id,
                    $log->created_at?->format('Y-m-d H:i:s'),
                    (string) ($log->user?->full_name ?: ($log->user?->login ?? '')),
                    (string) ($log->user?->role ?? 'system'),
                    (string) $log->action,
                    (string) ($log->details ?? ''),
                ], ';');
            }
            fclose($out);
        }, 'system_logs.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function applySystemLogFilters(\Illuminate\Database\Eloquent\Builder $query, array $validated): void
    {
        if (!empty($validated['action']) && $validated['action'] !== 'all') {
            $query->where('action', 'like', '%' . trim((string) $validated['action']) . '%');
        }

        if (!empty($validated['user_id'])) {
            $query->where('user_id', (int) $validated['user_id']);
        }

        if (!empty($validated['role']) && $validated['role'] !== 'system') {
            $query->whereHas('user', fn ($userQuery) => $userQuery->where('role', $validated['role']));
        } elseif (($validated['role'] ?? null) === 'system') {
            $query->whereNull('user_id');
        }

        if (!empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(function ($builder) use ($term) {
                $builder
                    ->where('action', 'like', "%{$term}%")
                    ->orWhere('details', 'like', "%{$term}%")
                    ->orWhereHas('user', function ($userQuery) use ($term) {
                        $userQuery
                            ->where('login', 'like', "%{$term}%")
                            ->orWhere('last_name', 'like', "%{$term}%")
                            ->orWhere('first_name', 'like', "%{$term}%")
                            ->orWhere('middle_name', 'like', "%{$term}%");
                    });
            });
        }

        $period = $validated['period'] ?? 'all';
        if ($period !== 'all') {
            $from = now();
            if ($period === 'today') {
                $from = now()->startOfDay();
            } elseif ($period === 'week') {
                $from = now()->subDays(7);
            } elseif ($period === 'month') {
                $from = now()->subMonth();
            }
            $query->where('created_at', '>=', $from);
        }
    }
}
