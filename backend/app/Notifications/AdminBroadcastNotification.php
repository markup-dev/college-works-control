<?php

namespace App\Notifications;

use App\Models\AdminBroadcast;
use App\Models\User;
use Illuminate\Notifications\Notification;

/**
 * Админская рассылка: только центр уведомлений, без диалогов в сообщениях.
 */
class AdminBroadcastNotification extends Notification
{
    public function __construct(
        public AdminBroadcast $broadcast,
        public User $admin,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->broadcast->subject,
            'body' => $this->broadcast->body,
            'kind' => 'admin_broadcast',
            'broadcast_id' => $this->broadcast->id,
            'admin_name' => $this->admin->full_name ?? $this->admin->login ?? 'Администратор',
        ];
    }
}
