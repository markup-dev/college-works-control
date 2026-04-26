<?php

namespace App\Notifications;

use App\Models\Assignment;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AssignmentDeadlineReminderNotification extends Notification
{
    public function __construct(
        public Assignment $assignment,
        public int $daysRemaining
    ) {}

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
        $deadline = $this->assignment->deadline?->format('d.m.Y') ?? '—';
        $when = $this->daysRemaining === 1 ? 'завтра' : "через {$this->daysRemaining} дня";
        $subject = 'Напоминание о сроке: '.$this->assignment->title;
        $url = rtrim(config('app.frontend_url'), '/').'/student';

        return (new MailMessage)
            ->subject($subject)
            ->greeting('Здравствуйте!')
            ->line('Напоминаем: срок сдачи задания «'.$this->assignment->title.'» — '.$when.' ('.$deadline.').')
            ->action('Открыть дашборд', $url);
    }

    public function toArray(object $notifiable): array
    {
        $deadline = $this->assignment->deadline?->format('d.m.Y') ?? '—';
        $when = $this->daysRemaining === 1 ? 'завтра' : "через {$this->daysRemaining} дня";

        return [
            'title' => 'Срок сдачи',
            'body' => '«'.$this->assignment->title.'» — '.$when.' ('.$deadline.').',
            'kind' => 'assignment_deadline_reminder',
            'assignment_id' => $this->assignment->id,
            'days_remaining' => $this->daysRemaining,
        ];
    }
}
