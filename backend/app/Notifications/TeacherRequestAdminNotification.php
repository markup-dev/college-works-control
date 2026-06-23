<?php

namespace App\Notifications;

use App\Models\TeacherSubjectRequest;
use App\Models\TeachingLoadRequest;
use Illuminate\Notifications\Notification;

/**
 * Администраторам: новая заявка преподавателя на допуск к дисциплине или назначение на группу.
 */
class TeacherRequestAdminNotification extends Notification
{
    public function __construct(
        public string $kind,
        public TeacherSubjectRequest|TeachingLoadRequest $request,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        // Связь group есть только у TeachingLoadRequest; для заявки на дисциплину
        // её загрузка бросила бы BadMethodCallException и уведомление потерялось бы.
        $this->request->loadMissing(['teacher', 'subject']);

        $teacherName = $this->request->teacher?->full_name
            ?? $this->request->teacher?->login
            ?? 'Преподаватель';
        $subjectName = $this->request->subject?->name ?? 'Дисциплина';

        if ($this->kind === 'teacher_discipline_request') {
            return [
                'title' => 'Заявка на допуск к дисциплине',
                'body' => $teacherName.' запросил допуск к дисциплине «'.$subjectName.'».',
                'kind' => $this->kind,
                'request_id' => $this->request->id,
                'teacher_id' => $this->request->teacher_id,
                'subject_id' => $this->request->subject_id,
                'teacher_name' => $teacherName,
            ];
        }

        $this->request->loadMissing('group');
        $groupName = $this->request->group?->name ?? '—';

        return [
            'title' => 'Заявка на назначение',
            'body' => $teacherName.' запросил назначение: «'.$subjectName.'», группа '.$groupName.'.',
            'kind' => $this->kind,
            'request_id' => $this->request->id,
            'teacher_id' => $this->request->teacher_id,
            'subject_id' => $this->request->subject_id,
            'group_id' => $this->request->group_id,
            'teacher_name' => $teacherName,
        ];
    }
}
