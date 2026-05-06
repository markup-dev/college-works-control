<?php

namespace App\Notifications;

use App\Models\Submission;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SubmissionGradedStudentNotification extends Notification
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
            'assignment:id,title,max_score,teacher_id',
            'assignment.teacher:id,grade_scale',
        ]);
        $title = $this->submission->assignment?->title ?? 'Задание';
        $score = $this->submission->score;
        $max = $this->submission->assignment?->max_score ?? 100;
        $gradeLabel = $this->submission->gradeLabel();
        $url = rtrim(config('app.frontend_url'), '/').'/student';

        return (new MailMessage)
            ->subject('Работа зачтена: '.$title)
            ->greeting('Здравствуйте!')
            ->line('Работа по заданию «'.$title.'» проверена.')
            ->line('Оценка: '.$score.' из '.$max.($gradeLabel ? " ({$gradeLabel})" : '').'.')
            ->action('Открыть дашборд', $url);
    }

    public function toArray(object $notifiable): array
    {
        $this->submission->loadMissing([
            'assignment:id,title,max_score,teacher_id',
            'assignment.teacher:id,login,last_name,first_name,middle_name,grade_scale',
        ]);
        $title = $this->submission->assignment?->title ?? 'Задание';
        $score = $this->submission->score;
        $max = $this->submission->assignment?->max_score ?? 100;
        $gradeLabel = $this->submission->gradeLabel();
        $teacherName = $this->submission->assignment?->teacher?->full_name ?? 'Не указан';

        return [
            'title' => 'Работа зачтена',
            'body' => '«'.$title.'». Оценка: '.$score.' / '.$max.($gradeLabel ? ' · '.$gradeLabel : ''),
            'kind' => 'submission_graded',
            'assignment_id' => $this->submission->assignment_id,
            'submission_id' => $this->submission->id,
            'teacher_name' => $teacherName,
        ];
    }
}
