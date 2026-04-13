<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        'login',
        'email',
        'password',
        'last_name',
        'first_name',
        'middle_name',
        'role',
        'group_id',
        'department',
        'phone',
        'theme',
        'is_active',
        'must_change_password',
        'last_login',
    ];

    protected $appends = [
        'full_name',
        'notifications',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'must_change_password' => 'boolean',
            'last_login' => 'datetime',
        ];
    }

    public function studentGroup(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'group_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class, 'teacher_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class, 'student_id');
    }

    public function subjects(): HasMany
    {
        return $this->hasMany(Subject::class, 'teacher_id');
    }

    public function teachingGroups(): HasMany
    {
        return $this->hasMany(Group::class, 'teacher_id');
    }

    public function systemLogs(): HasMany
    {
        return $this->hasMany(SystemLog::class);
    }

    public function notificationSettings(): HasMany
    {
        return $this->hasMany(UserNotificationSetting::class);
    }

    public function getFullNameAttribute(): string
    {
        return trim(implode(' ', array_filter([
            $this->last_name,
            $this->first_name,
            $this->middle_name,
        ])));
    }

    public function getNotificationsAttribute(): array
    {
        $settings = $this->relationLoaded('notificationSettings')
            ? $this->notificationSettings
            : $this->notificationSettings()->get();

        $notifications = [
            'email' => true,
            'push' => true,
            'sms' => false,
        ];

        foreach ($settings as $setting) {
            $notifications[$setting->channel] = (bool) $setting->enabled;
        }

        return $notifications;
    }

}
