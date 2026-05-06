<?php

namespace App\Notifications;

use App\Models\Submission;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NewSubmissionTeacherNotification extends Notification
{
    public function __construct(public Submission $submission) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];
        if ($notifiable->wantsEmailNotifications()) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $this->submission->loadMissing([
            'assignment:id,title',
            'student:id,first_name,last_name,middle_name,group_id',
            'student.studentGroup:id,name',
        ]);
        $title = $this->submission->assignment?->title ?? 'Задание';
        $studentName = $this->submission->student?->full_name ?? 'Студент';
        $groupName = $this->submission->student?->studentGroup?->name;
        $url = rtrim(config('app.frontend_url'), '/').'/teacher';

        return (new MailMessage)
            ->subject('Новая работа на проверке: '.$title)
            ->greeting('Здравствуйте!')
            ->line($studentName.($groupName ? ' ('.$groupName.')' : '').' сдал(а) работу по заданию «'.$title.'».')
            ->action('Открыть дашборд преподавателя', $url);
    }

    public function toArray(object $notifiable): array
    {
        $this->submission->loadMissing([
            'assignment:id,title',
            'student:id,first_name,last_name,middle_name,group_id',
            'student.studentGroup:id,name',
        ]);
        $title = $this->submission->assignment?->title ?? 'Задание';
        $studentName = $this->submission->student?->full_name ?? 'Студент';
        $groupName = $this->submission->student?->studentGroup?->name;

        return [
            'title' => 'Новая работа на проверке',
            'body' => $studentName.($groupName ? ' ('.$groupName.')' : '').' — «'.$title.'»',
            'kind' => 'submission_submitted_teacher',
            'assignment_id' => $this->submission->assignment_id,
            'submission_id' => $this->submission->id,
            'student_group_name' => $groupName,
        ];
    }
}
