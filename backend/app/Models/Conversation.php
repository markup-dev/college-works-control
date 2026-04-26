<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    protected $fillable = [
        'user_one_id',
        'user_two_id',
    ];

    public function userOne(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_one_id');
    }

    public function userTwo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_two_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function otherParticipant(User $user): ?User
    {
        if ((int) $this->user_one_id === (int) $user->id) {
            return $this->userTwo;
        }
        if ((int) $this->user_two_id === (int) $user->id) {
            return $this->userOne;
        }

        return null;
    }

    public function involvesUser(User $user): bool
    {
        return (int) $this->user_one_id === (int) $user->id
            || (int) $this->user_two_id === (int) $user->id;
    }

    /**
     * @return array{0: int, 1: int}
     */
    public static function orderedUserIds(int $a, int $b): array
    {
        return $a < $b ? [$a, $b] : [$b, $a];
    }
}
