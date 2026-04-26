<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TeacherBroadcastMessageController extends Controller
{
    private const MAX_RECIPIENTS = 50;

    public function store(Request $request)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher') {
            abort(403);
        }

        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1', 'max:' . self::MAX_RECIPIENTS],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'body' => ['required', 'string', 'max:8000'],
        ], [
            'body.required' => 'Введите текст сообщения.',
            'user_ids.required' => 'Выберите хотя бы одного получателя.',
        ]);

        $body = trim($validated['body']);
        if ($body === '') {
            return response()->json(['message' => 'Введите текст сообщения.'], 422);
        }

        $ids = array_values(array_unique(array_map('intval', $validated['user_ids'])));

        $sent = 0;
        $skipped = 0;

        foreach ($ids as $otherId) {
            if ($otherId === (int) $teacher->id) {
                $skipped++;

                continue;
            }

            $other = User::query()->find($otherId);
            if (! $other || $other->role !== 'student') {
                $skipped++;

                continue;
            }

            if (! $teacher->canCommunicateWith($other)) {
                $skipped++;

                continue;
            }

            try {
                DB::transaction(function () use ($teacher, $other, $body) {
                    [$one, $two] = Conversation::orderedUserIds((int) $teacher->id, (int) $other->id);
                    $conversation = Conversation::query()->firstOrCreate([
                        'user_one_id' => $one,
                        'user_two_id' => $two,
                    ]);
                    Message::query()->create([
                        'conversation_id' => $conversation->id,
                        'sender_id' => $teacher->id,
                        'body' => $body,
                    ]);
                    $conversation->touch();
                });
                $sent++;
            } catch (\Throwable $e) {
                report($e);
                $skipped++;
            }
        }

        return response()->json([
            'data' => [
                'sent' => $sent,
                'skipped' => $skipped,
            ],
        ]);
    }
}
