<?php

namespace App\Notifications;

use App\Models\Submission;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SubmissionReturnedStudentNotification extends Notification
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
        $this->submission->loadMissing('assignment:id,title');
        $title = $this->submission->assignment?->title ?? 'Задание';
        $url = rtrim(config('app.frontend_url'), '/').'/student';

        return (new MailMessage)
            ->subject('Работа возвращена на доработку: '.$title)
            ->greeting('Здравствуйте!')
            ->line('Работа по заданию «'.$title.'» возвращена на доработку.')
            ->line('Откройте задание на дашборде, чтобы увидеть комментарий преподавателя.')
            ->action('Открыть дашборд', $url);
    }

    public function toArray(object $notifiable): array
    {
        $this->submission->loadMissing('assignment:id,title');
        $title = $this->submission->assignment?->title ?? 'Задание';

        return [
            'title' => 'Возврат на доработку',
            'body' => '«'.$title.'». Требуется доработать и сдать снова.',
            'kind' => 'submission_returned',
            'assignment_id' => $this->submission->assignment_id,
            'submission_id' => $this->submission->id,
        ];
    }
}
