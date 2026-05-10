<?php

namespace App\Notifications;

use App\Models\Assignment;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Студенту: задание изменено преподавателем (актуальный дедлайн в письме и в payload для UI).
 * viaChannels — опционально ограничить каналы (аналогично AssignmentAnnouncedNotification).
 */
class AssignmentUpdatedNotification extends Notification
{
    /**
     * @param  list<string>|null  $viaChannels  Если задано — уведомление только по этим каналам.
     */
    public function __construct(
        public Assignment $assignment,
        public ?array $viaChannels = null,
    ) {}

    public function via(object $notifiable): array
    {
        if ($this->viaChannels !== null) {
            return $this->viaChannels;
        }

        $channels = ['database'];
        if ($notifiable->wantsEmailNotifications()) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $subject = 'Задание обновлено: '.$this->assignment->title;
        $deadline = $this->assignment->deadline?->format('d.m.Y') ?? '—';
        $url = rtrim(config('app.frontend_url'), '/').'/student';

        return (new MailMessage)
            ->subject($subject)
            ->greeting('Здравствуйте!')
            ->line('Задание «'.$this->assignment->title.'» было изменено преподавателем.')
            ->line('Актуальный срок сдачи: '.$deadline)
            ->action('Открыть дашборд', $url);
    }

    public function toArray(object $notifiable): array
    {
        $this->assignment->loadMissing('teacher:id,login,last_name,first_name,middle_name');
        $deadline = $this->assignment->deadline?->format('d.m.Y') ?? '—';
        $teacherName = $this->assignment->teacher?->full_name ?? 'Не указан';

        return [
            'title' => 'Задание обновлено',
            'body' => '«'.$this->assignment->title.'». Срок: '.$deadline,
            'kind' => 'assignment_updated',
            'assignment_id' => $this->assignment->id,
            'teacher_name' => $teacherName,
        ];
    }
}
