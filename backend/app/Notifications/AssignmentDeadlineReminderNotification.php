<?php

namespace App\Notifications;

use App\Models\Assignment;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Студенту: напоминание о приближающемся дедлайне (запускается планировщиком/командой по числу оставшихся дней).
 */
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
        $when = self::deadlineRelativePhrase($this->daysRemaining);
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
        $this->assignment->loadMissing('teacher:id,login,last_name,first_name,middle_name');
        $deadline = $this->assignment->deadline?->format('d.m.Y') ?? '—';
        $when = self::deadlineRelativePhrase($this->daysRemaining);
        $teacherName = $this->assignment->teacher?->full_name ?? 'Не указан';

        return [
            'title' => 'Срок сдачи',
            'body' => '«'.$this->assignment->title.'» — '.$when.' ('.$deadline.').',
            'kind' => 'assignment_deadline_reminder',
            'assignment_id' => $this->assignment->id,
            'days_remaining' => $this->daysRemaining,
            'teacher_name' => $teacherName,
        ];
    }

    /** Относительная формулировка до дедлайна (русские склонения «день/дня/дней»). */
    private static function deadlineRelativePhrase(int $daysRemaining): string
    {
        if ($daysRemaining <= 0) {
            return 'сегодня';
        }

        if ($daysRemaining === 1) {
            return 'завтра';
        }

        $n = $daysRemaining;
        $mod100 = $n % 100;
        $mod10 = $n % 10;

        if ($mod100 >= 11 && $mod100 <= 14) {
            $word = 'дней';
        } elseif ($mod10 === 1) {
            $word = 'день';
        } elseif ($mod10 >= 2 && $mod10 <= 4) {
            $word = 'дня';
        } else {
            $word = 'дней';
        }

        return "через {$n} {$word}";
    }
}
