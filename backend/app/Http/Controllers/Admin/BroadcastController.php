<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminBroadcast;
use App\Models\Conversation;
use App\Models\Group;
use App\Models\Message;
use App\Models\SystemLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Админ: массовые рассылки по ролям/группам — запись в БД, доставка писем и опционально сообщения в чатах.
 */
class BroadcastController extends Controller
{
    private const MAX_RECIPIENTS = 800;

    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 20);
        $query = AdminBroadcast::query()
            ->with('admin:id,last_name,first_name,middle_name,login')
            ->latest();

        if (! empty($validated['search'])) {
            $term = '%' . trim((string) $validated['search']) . '%';
            $query->where(fn ($q) => $q->where('subject', 'like', $term)->orWhere('body', 'like', $term));
        }

        $paginator = $query->paginate($perPage)->withQueryString();
        $data = collect($paginator->items())->map(fn (AdminBroadcast $b) => $this->serializeList($b))->values();

        return response()->json([
            'data' => $data,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $this->ensureAdmin($request);

        $validated = $request->validate([
            'audience_type' => ['required', Rule::in(['all', 'teachers', 'students', 'groups'])],
            'group_ids' => ['nullable', 'array', 'max:50'],
            'group_ids.*' => ['integer', 'exists:groups,id'],
            'subject' => ['required', 'string', 'min:3', 'max:255'],
            'body' => ['required', 'string', 'min:3', 'max:8000'],
            'copy_email' => ['nullable', 'boolean'],
        ], [
            'subject.required' => 'Укажите тему сообщения.',
            'body.required' => 'Введите текст сообщения.',
        ]);

        $admin = $request->user();
        $audience = (string) $validated['audience_type'];
        $groupIds = array_values(array_unique(array_map('intval', $validated['group_ids'] ?? [])));

        if ($audience === 'groups' && $groupIds === []) {
            throw ValidationException::withMessages(['group_ids' => 'Выберите хотя бы одну группу.']);
        }

        $recipients = $this->resolveRecipients($audience, $groupIds, (int) $admin->id);

        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'Не найдено получателей по выбранным условиям.'], 422);
        }

        if ($recipients->count() > self::MAX_RECIPIENTS) {
            return response()->json([
                'message' => 'Слишком много получателей ('.$recipients->count().'). Максимум за одну рассылку: '.self::MAX_RECIPIENTS.'. Сузьте аудиторию.',
            ], 422);
        }

        $messageText = $this->formatMessageBody($validated['subject'], $validated['body']);
        $copyEmail = (bool) ($validated['copy_email'] ?? false);

        $sent = $this->deliverMessages($admin, $recipients, $messageText);

        $broadcast = AdminBroadcast::create([
            'admin_id' => $admin->id,
            'audience_type' => $audience,
            'group_ids' => $audience === 'groups' ? $groupIds : null,
            'subject' => $validated['subject'],
            'body' => $validated['body'],
            'recipient_count' => $sent,
            'copy_email' => $copyEmail,
        ]);

        if ($copyEmail) {
            $this->sendEmailCopies($recipients, $validated['subject'], $validated['body'], $admin);
        }

        SystemLog::create([
            'user_id' => $admin->id,
            'action' => 'admin_broadcast',
            'details' => "Рассылка «{$broadcast->subject}», получателей: {$sent}",
        ]);

        return response()->json([
            'success' => true,
            'broadcast' => $this->serializeList($broadcast->load('admin:id,last_name,first_name,middle_name,login')),
            'sent' => $sent,
        ], 201);
    }

    public function show(Request $request, AdminBroadcast $broadcast)
    {
        $this->ensureAdmin($request);
        $broadcast->load('admin:id,last_name,first_name,middle_name,login,email');

        $groupNames = [];
        if (is_array($broadcast->group_ids) && $broadcast->group_ids !== []) {
            $groupNames = Group::query()
                ->whereIn('id', $broadcast->group_ids)
                ->orderBy('name')
                ->pluck('name')
                ->all();
        }

        return response()->json([
            'broadcast' => [
                'id' => $broadcast->id,
                'subject' => $broadcast->subject,
                'body' => $broadcast->body,
                'audience_type' => $broadcast->audience_type,
                'audience_label' => $this->audienceLabel($broadcast->audience_type, $groupNames),
                'group_names' => $groupNames,
                'recipient_count' => $broadcast->recipient_count,
                'copy_email' => $broadcast->copy_email,
                'created_at' => $broadcast->created_at?->toISOString(),
                'admin' => [
                    'short_name' => $broadcast->admin?->full_name ?? $broadcast->admin?->login,
                    'email' => $broadcast->admin?->email,
                ],
            ],
        ]);
    }

    public function resend(Request $request, AdminBroadcast $broadcast)
    {
        $this->ensureAdmin($request);
        $admin = $request->user();
        $groupIds = is_array($broadcast->group_ids) ? array_map('intval', $broadcast->group_ids) : [];

        $recipients = $this->resolveRecipients((string) $broadcast->audience_type, $groupIds, (int) $admin->id);
        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'Не найдено получателей.'], 422);
        }
        if ($recipients->count() > self::MAX_RECIPIENTS) {
            return response()->json(['message' => 'Слишком много получателей для повторной отправки.'], 422);
        }

        $messageText = $this->formatMessageBody($broadcast->subject, $broadcast->body);
        $sent = $this->deliverMessages($admin, $recipients, $messageText);

        if ($broadcast->copy_email) {
            $this->sendEmailCopies($recipients, $broadcast->subject, $broadcast->body, $admin);
        }

        SystemLog::create([
            'user_id' => $admin->id,
            'action' => 'admin_broadcast_resend',
            'details' => "Повтор рассылки #{$broadcast->id} «{$broadcast->subject}», отправлено: {$sent}",
        ]);

        return response()->json(['success' => true, 'sent' => $sent]);
    }

    private function ensureAdmin(Request $request): void
    {
        if ($request->user()?->role !== 'admin') {
            abort(403);
        }
    }

    private function resolveRecipients(string $audience, array $groupIds, int $adminId): Collection
    {
        $q = User::query()
            ->where('is_active', true)
            ->where('id', '!=', $adminId);

        if ($audience === 'teachers') {
            $q->where('role', 'teacher');
        } elseif ($audience === 'students') {
            $q->where('role', 'student');
        } elseif ($audience === 'groups') {
            $q->where('role', 'student')->whereIn('group_id', $groupIds);
        } else {
            $q->whereIn('role', ['student', 'teacher']);
        }

        return $q->orderBy('id')->pluck('id')->unique()->values();
    }

    private function formatMessageBody(string $subject, string $body): string
    {
        return "Рассылка: {$subject}\n\n".trim($body);
    }

    private function deliverMessages(User $admin, Collection $recipientIds, string $messageText): int
    {
        $sent = 0;
        foreach ($recipientIds as $otherId) {
            try {
                DB::transaction(function () use ($admin, $otherId, $messageText) {
                    [$one, $two] = Conversation::orderedUserIds((int) $admin->id, (int) $otherId);
                    $conversation = Conversation::query()->firstOrCreate([
                        'user_one_id' => $one,
                        'user_two_id' => $two,
                    ]);
                    Message::query()->create([
                        'conversation_id' => $conversation->id,
                        'sender_id' => $admin->id,
                        'body' => $messageText,
                    ]);
                    $conversation->touch();
                });
                $sent++;
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $sent;
    }

    private function sendEmailCopies(Collection $recipientIds, string $subject, string $body, User $admin): void
    {
        $users = User::query()->whereIn('id', $recipientIds)->whereNotNull('email')->get(['id', 'email']);
        foreach ($users as $user) {
            if (! $user->email) {
                continue;
            }
            try {
                Mail::raw(
                    "Здравствуйте!\n\n{$body}\n\n— {$admin->full_name}, администрация College Works Control",
                    fn ($message) => $message->to($user->email)->subject($subject)
                );
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }

    private function serializeList(AdminBroadcast $b): array
    {
        $b->loadMissing('admin:id,last_name,first_name,middle_name,login');
        $groupNames = [];
        if ($b->audience_type === 'groups' && is_array($b->group_ids) && $b->group_ids !== []) {
            $groupNames = Group::query()->whereIn('id', $b->group_ids)->orderBy('name')->pluck('name')->all();
        }

        return [
            'id' => $b->id,
            'subject' => $b->subject,
            'audience_type' => $b->audience_type,
            'audience_label' => $this->audienceLabel($b->audience_type, $groupNames),
            'recipient_count' => $b->recipient_count,
            'created_at' => $b->created_at?->toISOString(),
            'admin' => [
                'short_name' => $b->admin?->full_name ?? $b->admin?->login ?? '—',
            ],
        ];
    }

    private function audienceLabel(string $type, array $groupNames): string
    {
        if ($type === 'teachers') {
            return 'Преподаватели';
        }
        if ($type === 'students') {
            return 'Студенты';
        }
        if ($type === 'groups') {
            if ($groupNames === []) {
                return 'Группы';
            }
            $c = count($groupNames);
            if ($c <= 3) {
                return implode(', ', $groupNames);
            }

            return implode(', ', array_slice($groupNames, 0, 3)).' и ещё '.($c - 3);
        }

        return 'Все пользователи';
    }
}
