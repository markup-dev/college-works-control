<?php

namespace App\Console\Commands;

use App\Models\Assignment;
use App\Models\Submission;
use App\Notifications\AssignmentDeadlineReminderNotification;
use App\Services\AssignmentNotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class SendAssignmentDeadlineReminders extends Command
{
    protected $signature = 'assignments:send-deadline-reminders';

    protected $description = 'Напоминания студентам о сроках сдачи (за 3 и 1 день), без спама — раз в сутки на пару задание+студент';

    public function handle(AssignmentNotificationService $assignmentNotificationService): int
    {
        $today = now()->startOfDay();
        $windows = [
            ['days' => 3, 'label' => '3'],
            ['days' => 1, 'label' => '1'],
        ];

        foreach ($windows as $window) {
            $targetDate = $today->copy()->addDays($window['days']);

            $assignments = Assignment::query()
                ->whereIn('status', ['active', 'inactive'])
                ->whereDate('deadline', $targetDate->toDateString())
                ->with(['groups:id'])
                ->get();

            foreach ($assignments as $assignment) {
                $students = $assignmentNotificationService->studentsForAssignment($assignment);

                foreach ($students as $student) {
                    if ($this->hasGradedSubmission($assignment->id, $student->id)) {
                        continue;
                    }

                    $cacheKey = sprintf(
                        'deadline_reminder:%d:%d:%s:%s',
                        $assignment->id,
                        $student->id,
                        $window['label'],
                        $today->toDateString()
                    );

                    if (! Cache::add($cacheKey, true, now()->addHours(48))) {
                        continue;
                    }

                    try {
                        $student->notify(new AssignmentDeadlineReminderNotification(
                            $assignment,
                            (int) $window['days']
                        ));
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }
            }
        }

        return self::SUCCESS;
    }

    private function hasGradedSubmission(int $assignmentId, int $studentId): bool
    {
        return Submission::query()
            ->where('assignment_id', $assignmentId)
            ->where('student_id', $studentId)
            ->where('status', 'graded')
            ->exists();
    }
}
