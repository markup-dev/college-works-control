<?php

namespace App\Services;

use App\Models\TeacherSubjectRequest;
use App\Models\TeachingLoadRequest;
use App\Models\User;
use App\Notifications\TeacherRequestAdminNotification;
use Throwable;

class TeacherRequestNotificationService
{
    public function notifyAdminsOfDisciplineRequest(TeacherSubjectRequest $request): void
    {
        $this->notifyAdmins(new TeacherRequestAdminNotification('teacher_discipline_request', $request));
    }

    public function notifyAdminsOfTeachingLoadRequest(TeachingLoadRequest $request): void
    {
        $this->notifyAdmins(new TeacherRequestAdminNotification('teacher_teaching_load_request', $request));
    }

    private function notifyAdmins(TeacherRequestAdminNotification $notification): void
    {
        User::query()
            ->where('role', 'admin')
            ->where('is_active', true)
            ->orderBy('id')
            ->cursor()
            ->each(function (User $admin) use ($notification): void {
                try {
                    $admin->notify($notification);
                } catch (Throwable) {
                    // Уведомление не должно ломать создание заявки.
                }
            });
    }
}
