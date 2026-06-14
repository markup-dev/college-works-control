<?php

namespace App\Services;

use App\Jobs\SendAssignmentNotificationsJob;
use App\Models\Assignment;
use App\Models\User;
use App\Notifications\AssignmentAnnouncedNotification;
use App\Notifications\AssignmentUpdatedNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Рассылка событий по заданиям студентам целевых групп.
 * Отправка вынесена в очередь, чтобы не блокировать сохранение задания преподавателем.
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
        if ($assignmentId <= 0) {
            return;
        }

        dispatch(function () use ($assignmentId, $notificationClass) {
            (new SendAssignmentNotificationsJob($assignmentId, $notificationClass))
                ->handle(app(self::class));
        })->afterResponse();
    }
}
