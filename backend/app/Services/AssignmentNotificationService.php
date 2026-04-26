<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\User;
use App\Notifications\AssignmentAnnouncedNotification;
use App\Notifications\AssignmentUpdatedNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AssignmentNotificationService
{
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
        $assignment->loadMissing(['subjectRelation:id,name']);
        $students = $this->studentsForAssignment($assignment);
        foreach ($students as $student) {
            try {
                $student->notify(new AssignmentAnnouncedNotification($assignment, ['database']));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $assignmentId = (int) $assignment->getKey();
        $mailStudentIds = $students
            ->filter(fn (User $s) => $s->wantsEmailNotifications())
            ->pluck('id')
            ->all();
        if ($mailStudentIds !== []) {
            dispatch(function () use ($assignmentId, $mailStudentIds) {
                $fresh = Assignment::query()->find($assignmentId);
                if (! $fresh) {
                    return;
                }
                foreach (User::query()->whereIn('id', $mailStudentIds)->cursor() as $student) {
                    if (! $student->wantsEmailNotifications()) {
                        continue;
                    }
                    try {
                        $student->notify(new AssignmentAnnouncedNotification($fresh, ['mail']));
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }
            })->afterResponse();
        }
    }

    public function notifyAssignmentUpdated(Assignment $assignment): void
    {
        $assignment->loadMissing(['subjectRelation:id,name']);
        $students = $this->studentsForAssignment($assignment);
        foreach ($students as $student) {
            try {
                $student->notify(new AssignmentUpdatedNotification($assignment, ['database']));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $assignmentId = (int) $assignment->getKey();
        $mailStudentIds = $students
            ->filter(fn (User $s) => $s->wantsEmailNotifications())
            ->pluck('id')
            ->all();
        if ($mailStudentIds !== []) {
            dispatch(function () use ($assignmentId, $mailStudentIds) {
                $fresh = Assignment::query()->find($assignmentId);
                if (! $fresh) {
                    return;
                }
                foreach (User::query()->whereIn('id', $mailStudentIds)->cursor() as $student) {
                    if (! $student->wantsEmailNotifications()) {
                        continue;
                    }
                    try {
                        $student->notify(new AssignmentUpdatedNotification($fresh, ['mail']));
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }
            })->afterResponse();
        }
    }
}
