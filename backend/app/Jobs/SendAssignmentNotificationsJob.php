<?php

namespace App\Jobs;

use App\Models\Assignment;
use App\Notifications\AssignmentAnnouncedNotification;
use App\Notifications\AssignmentUpdatedNotification;
use App\Services\AssignmentNotificationService;

class SendAssignmentNotificationsJob
{
    /**
     * @param  class-string<AssignmentAnnouncedNotification|AssignmentUpdatedNotification>  $notificationClass
     */
    public function __construct(
        public int $assignmentId,
        public string $notificationClass,
    ) {}

    public function handle(AssignmentNotificationService $notifications): void
    {
        if ($this->assignmentId <= 0) {
            return;
        }

        $assignment = Assignment::query()
            ->with('subject:id,name')
            ->find($this->assignmentId);

        if (! $assignment) {
            return;
        }

        $students = $notifications->studentsForAssignment($assignment);

        foreach ($students as $student) {
            try {
                $student->notify(new $this->notificationClass($assignment, ['database']));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        foreach ($students as $student) {
            if (! $student->wantsEmailNotifications()) {
                continue;
            }

            try {
                $student->notify(new $this->notificationClass($assignment, ['mail']));
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }
}
