<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\User;
use App\Notifications\AssignmentAnnouncedNotification;
use App\Notifications\AssignmentUpdatedNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Рассылка событий по заданиям студентам целевых групп.
 * Уведомления в колокольчик создаются пакетной записью, без обхода Eloquent-моделей по одному студенту.
 */
class AssignmentNotificationService
{
    /** Активные студенты из групп, привязанных к заданию через assignment_group. */
    public function studentsForAssignment(Assignment $assignment): Collection
    {
        $groupIds = DB::table('assignment_group')
            ->where('assignment_id', $assignment->getKey())
            ->pluck('group_id')
            ->filter()
            ->unique()
            ->values();

        if ($groupIds->isEmpty()) {
            return collect();
        }

        return User::query()
            ->where('role', 'student')
            ->where('is_active', true)
            ->whereNotNull('group_id')
            ->whereIn('group_id', $groupIds->all())
            ->get();
    }

    public function notifyNewAssignment(Assignment $assignment): void
    {
        $this->dispatchAfterResponse(
            (int) $assignment->getKey(),
            AssignmentAnnouncedNotification::class,
        );
    }

    public function notifyAssignmentUpdated(Assignment $assignment): void
    {
        $this->dispatchAfterResponse(
            (int) $assignment->getKey(),
            AssignmentUpdatedNotification::class,
        );
    }

    /**
     * @param  class-string<AssignmentAnnouncedNotification|AssignmentUpdatedNotification>  $notificationClass
     */
    private function dispatchAfterResponse(int $assignmentId, string $notificationClass): void
    {
        $this->insertDatabaseNotifications($assignmentId, $notificationClass);
    }

    /**
     * Массовая запись уведомлений без создания Eloquent-моделей на каждого студента.
     *
     * @param  class-string<AssignmentAnnouncedNotification|AssignmentUpdatedNotification>  $notificationClass
     */
    private function insertDatabaseNotifications(int $assignmentId, string $notificationClass): void
    {
        $assignment = Assignment::query()
            ->with(['teacher:id,login,last_name,first_name,middle_name'])
            ->find($assignmentId);

        if (! $assignment) {
            return;
        }

        $students = $this->studentsForAssignment($assignment);
        if ($students->isEmpty()) {
            return;
        }

        $deadline = $assignment->deadline?->format('d.m.Y') ?? '—';
        $teacherName = $assignment->teacher?->full_name ?? 'Не указан';
        $isUpdate = $notificationClass === AssignmentUpdatedNotification::class;
        $now = now();
        $payload = [
            'title' => $isUpdate ? 'Задание обновлено' : 'Новое задание',
            'body' => $isUpdate
                ? '«'.$assignment->title.'». Срок: '.$deadline
                : '«'.$assignment->title.'». Срок сдачи: '.$deadline,
            'kind' => $isUpdate ? 'assignment_updated' : 'assignment_announced',
            'assignment_id' => $assignment->id,
            'teacher_name' => $teacherName,
        ];

        $rows = $students
            ->map(fn (User $student) => [
                'id' => (string) Str::uuid(),
                'type' => $notificationClass,
                'notifiable_type' => User::class,
                'notifiable_id' => $student->id,
                'data' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                'read_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->all();

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('notifications')->insert($chunk);
        }
    }
}
