<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Notification;

/**
 * Персональное уведомление о действии администратора, которое изменило данные пользователя.
 */
class AdminActionNotification extends Notification
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        public string $title,
        public string $body,
        public ?User $admin = null,
        public array $context = [],
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return array_merge([
            'title' => $this->title,
            'body' => $this->body,
            'kind' => 'admin_action',
            'admin_name' => $this->admin?->full_name ?? $this->admin?->login ?? 'Администратор',
        ], $this->context);
    }
}
