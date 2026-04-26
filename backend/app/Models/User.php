<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Collection;
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
        'is_active',
        'must_change_password',
        'last_login',
        'email_notifications_enabled',
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
            'email_notifications_enabled' => 'boolean',
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
        return [
            'email' => (bool) $this->email_notifications_enabled,
        ];
    }

    public function wantsEmailNotifications(): bool
    {
        return (bool) $this->email_notifications_enabled;
    }

    /**
     * Группы преподавателя: закреплённые за ним (groups.teacher_id) и группы из его заданий — тот же набор, что в форме задания.
     */
    public function attachedTeachingGroupIds(): Collection
    {
        if ($this->role !== 'teacher') {
            return collect();
        }

        return Group::query()
            ->where('teacher_id', $this->id)
            ->orWhereHas('assignments', fn (Builder $q) => $q->where('teacher_id', $this->id))
            ->pluck('id')
            ->unique()
            ->values();
    }

    /**
     * Студент связан с преподавателем: группа закреплена за преподом, есть его задание на группу студента или была сдача.
     */
    public function isLinkedToTeacher(User $teacher): bool
    {
        if ($teacher->role !== 'teacher' || $this->role !== 'student') {
            return false;
        }

        if ($this->group_id) {
            $group = $this->relationLoaded('studentGroup')
                ? $this->studentGroup
                : $this->studentGroup()->first();

            if ($group && (int) $group->teacher_id === (int) $teacher->id) {
                return true;
            }

            $hasAssignment = Assignment::query()
                ->where('teacher_id', $teacher->id)
                ->whereHas('groups', fn (Builder $q) => $q->where('groups.id', $this->group_id))
                ->exists();

            if ($hasAssignment) {
                return true;
            }
        }

        return Submission::query()
            ->where('student_id', $this->id)
            ->whereHas('assignment', fn (Builder $q) => $q->where('teacher_id', $teacher->id))
            ->exists();
    }

    public function canCommunicateWith(User $other): bool
    {
        if ((int) $this->id === (int) $other->id) {
            return false;
        }

        $roles = [$this->role, $other->role];
        sort($roles);

        if ($roles !== ['student', 'teacher']) {
            return false;
        }

        $student = $this->role === 'student' ? $this : $other;
        $teacher = $this->role === 'teacher' ? $this : $other;

        return $student->isLinkedToTeacher($teacher);
    }

}
