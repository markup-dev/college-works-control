<?php

namespace App\Notifications;

use App\Models\Assignment;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Уведомление студенту о новом задании: запись в БД для колокольчика и при включённой почте — письмо со ссылкой на дашборд.
 * Параметр конструктора viaChannels позволяет сервису отправить только БД или только почту отдельными вызовами.
 */
class AssignmentAnnouncedNotification extends Notification
{
    /**
     * @param  list<string>|null  $viaChannels  Если задано — уведомление идёт только по перечисленным каналам (database, mail).
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
        $subject = 'Новое задание: '.$this->assignment->title;
        $deadline = $this->assignment->deadline?->format('d.m.Y') ?? '—';
        $url = rtrim(config('app.frontend_url'), '/').'/student';

        return (new MailMessage)
            ->subject($subject)
            ->greeting('Здравствуйте!')
            ->line('Вам назначено задание «'.$this->assignment->title.'».')
            ->line('Срок сдачи: '.$deadline)
            ->action('Открыть дашборд', $url);
    }

    public function toArray(object $notifiable): array
    {
        $this->assignment->loadMissing('teacher:id,login,last_name,first_name,middle_name');
        $deadline = $this->assignment->deadline?->format('d.m.Y') ?? '—';
        $teacherName = $this->assignment->teacher?->full_name ?? 'Не указан';

        return [
            'title' => 'Новое задание',
            'body' => '«'.$this->assignment->title.'». Срок сдачи: '.$deadline,
            'kind' => 'assignment_announced',
            'assignment_id' => $this->assignment->id,
            'teacher_name' => $teacherName,
        ];
    }
}
