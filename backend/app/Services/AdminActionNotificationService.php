<?php

namespace App\Services;

use App\Models\Group;
use App\Models\TeachingLoad;
use App\Models\User;
use App\Notifications\AdminActionNotification;
use Illuminate\Support\Collection;
use Throwable;

class AdminActionNotificationService
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function notify(User $user, User $admin, string $title, string $body, array $context = []): void
    {
        try {
            $user->notify(new AdminActionNotification($title, $body, $admin, $context));
        } catch (Throwable) {
            // Уведомление не должно ломать административное действие.
        }
    }

    /**
     * @param  iterable<User>  $users
     * @param  array<string, mixed>  $context
     */
    public function notifyMany(iterable $users, User $admin, string $title, string $body, array $context = []): void
    {
        foreach ($users as $user) {
            if ($user instanceof User) {
                $this->notify($user, $admin, $title, $body, $context);
            }
        }
    }

    public function notifyTeachingLoadAssigned(TeachingLoad $teachingLoad, User $admin): void
    {
        $teachingLoad->loadMissing(['teacher', 'subject', 'group']);
        if (! $teachingLoad->teacher) {
            return;
        }

        $this->notify(
            $teachingLoad->teacher,
            $admin,
            'Вам добавлено назначение',
            'Администратор назначил вам дисциплину «'.($teachingLoad->subject?->name ?? 'Дисциплина').'» для группы '.($teachingLoad->group?->name ?? '—').'.',
            [
                'action' => 'teaching_load_assigned',
                'teaching_load_id' => $teachingLoad->id,
                'subject_id' => $teachingLoad->subject_id,
                'group_id' => $teachingLoad->group_id,
            ],
        );
    }

    public function notifyTeachingLoadRemoved(TeachingLoad $teachingLoad, User $admin): void
    {
        $teachingLoad->loadMissing(['teacher', 'subject', 'group']);
        if (! $teachingLoad->teacher) {
            return;
        }

        $this->notify(
            $teachingLoad->teacher,
            $admin,
            'Назначение снято',
            'Администратор снял назначение по дисциплине «'.($teachingLoad->subject?->name ?? 'Дисциплина').'» для группы '.($teachingLoad->group?->name ?? '—').'.',
            [
                'action' => 'teaching_load_removed',
                'teaching_load_id' => $teachingLoad->id,
                'subject_id' => $teachingLoad->subject_id,
                'group_id' => $teachingLoad->group_id,
            ],
        );
    }

    public function notifyGroupChanged(Group $group, User $admin, string $body): void
    {
        $students = User::query()
            ->where('role', 'student')
            ->where('group_id', $group->id)
            ->get();

        $this->notifyMany(
            $students,
            $admin,
            'Изменения по вашей группе',
            $body,
            [
                'action' => 'group_changed',
                'group_id' => $group->id,
            ],
        );
    }

    /**
     * @param  Collection<int, User>|array<int, User>  $students
     */
    public function notifyStudentsMovedToGroup(Collection|array $students, Group $group, User $admin): void
    {
        $this->notifyMany(
            $students,
            $admin,
            'Вам изменили группу',
            'Администратор перевёл вас в группу '.$group->name.'.',
            [
                'action' => 'student_group_changed',
                'group_id' => $group->id,
            ],
        );
    }
}
