<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Collection;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Пользователь платформы (Sanctum): роли, группа студента, нагрузка преподавателя, шкала оценок (JSON), связи для заданий и сдач.
 * notification_settings — виртуальный атрибут для API; канал уведомлений Laravel — трейт Notifiable.
 */
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
        'grade_scale',
        'is_active',
        'must_change_password',
        'last_login',
        'email_notifications_enabled',
    ];

    protected $appends = [
        'full_name',
        'notification_settings',
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

    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'teaching_loads', 'teacher_id', 'subject_id')
            ->withPivot(['group_id', 'status'])
            ->withTimestamps();
    }

    public function teachingGroups(): BelongsToMany
    {
        return $this->belongsToMany(Group::class, 'teaching_loads', 'teacher_id', 'group_id')
            ->withPivot(['subject_id', 'status'])
            ->withTimestamps();
    }

    public function teachingLoads(): HasMany
    {
        return $this->hasMany(TeachingLoad::class, 'teacher_id');
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

    public function getNotificationSettingsAttribute(): array
    {
        return [
            'email' => (bool) $this->email_notifications_enabled,
        ];
    }

    public static function defaultGradeScale(): array
    {
        return [
            ['label' => '5', 'min_score' => 95],
            ['label' => '5-', 'min_score' => 90],
            ['label' => '4+', 'min_score' => 85],
            ['label' => '4', 'min_score' => 75],
            ['label' => '4-', 'min_score' => 70],
            ['label' => '3+', 'min_score' => 65],
            ['label' => '3', 'min_score' => 55],
            ['label' => '3-', 'min_score' => 50],
            ['label' => '2', 'min_score' => 0],
        ];
    }

    public static function normalizeGradeScale(?array $scale): array
    {
        $items = collect($scale ?: [])
            ->filter(fn ($item) => is_array($item))
            ->map(function ($item) {
                $label = trim((string) ($item['label'] ?? ''));
                $minScore = (int) ($item['min_score'] ?? $item['minScore'] ?? -1);

                if (! preg_match('/^[1-5][+-]?$/u', $label) || $minScore < 0 || $minScore > 100) {
                    return null;
                }

                return [
                    'label' => $label,
                    'min_score' => $minScore,
                ];
            })
            ->filter()
            ->unique(fn ($item) => $item['label'] . ':' . $item['min_score'])
            ->sortByDesc('min_score')
            ->values()
            ->all();

        return count($items) > 0 ? $items : self::defaultGradeScale();
    }

    public function getGradeScaleAttribute($value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;
        return self::normalizeGradeScale(is_array($decoded) ? $decoded : null);
    }

    public function setGradeScaleAttribute($value): void
    {
        $this->attributes['grade_scale'] = json_encode(
            self::normalizeGradeScale(is_array($value) ? $value : null),
            JSON_UNESCAPED_UNICODE
        );
    }

    public function gradeLabelForScore(?int $score): ?string
    {
        if ($score === null) {
            return null;
        }

        $normalizedScore = max(0, min(100, $score));
        foreach ($this->grade_scale as $scaleItem) {
            if ($normalizedScore >= (int) $scaleItem['min_score']) {
                return (string) $scaleItem['label'];
            }
        }

        return null;
    }

    public function wantsEmailNotifications(): bool
    {
        return (bool) $this->email_notifications_enabled;
    }

    public function attachedTeachingGroupIds(): Collection
    {
        if ($this->role !== 'teacher') {
            return collect();
        }

        return TeachingLoad::query()
            ->where('teacher_id', $this->id)
            ->where('status', 'active')
            ->pluck('group_id')
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
            $hasTeachingLoad = TeachingLoad::query()
                ->where('teacher_id', $teacher->id)
                ->where('group_id', $this->group_id)
                ->where('status', 'active')
                ->exists();

            if ($hasTeachingLoad) {
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
