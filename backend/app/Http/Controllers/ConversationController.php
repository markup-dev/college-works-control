<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\Conversation;
use App\Models\Group;
use App\Models\Message;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Переписка студент ↔ преподаватель: список собеседников, диалоги, сообщения, архив с двух сторон.
 * Доступ к переписке завязан на User::canCommunicateWith и флаги архива по каждому участнику.
 */
class ConversationController extends Controller
{
    /**
     * Список пользователей, с которыми можно начать диалог.
     */
    public function partners(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'student') {
            // Студент видит преподавателей своей группы и тех, кто выдавал задания на эту группу.
            $teacherIds = collect();
            if ($user->group_id) {
                $group = Group::query()->find($user->group_id);
                if ($group && $group->teacher_id) {
                    $teacherIds->push((int) $group->teacher_id);
                }
                $teacherIds = $teacherIds->merge(
                    Assignment::query()
                        ->whereHas('groups', fn ($q) => $q->where('groups.id', $user->group_id))
                        ->pluck('teacher_id')
                );
            }
            $teacherIds = $teacherIds->unique()->filter()->values();
            $rows = User::query()
                ->where('role', 'teacher')
                ->where('is_active', true)
                ->whereIn('id', $teacherIds)
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get(['id', 'first_name', 'last_name', 'middle_name', 'role']);

            return response()->json([
                'data' => $rows->map(fn (User $u) => $this->formatUserBrief($u)),
                'teacher_groups' => [],
            ]);
        }

        $groupIds = $user->attachedTeachingGroupIds();

        // Преподаватель: студенты с «закреплённых» групп + те, с кем уже была сдача работ по его заданиям.
        $fromGroups = User::query()
            ->where('role', 'student')
            ->where('is_active', true)
            ->whereIn('group_id', $groupIds)
            ->pluck('id');

        $fromSubmissions = Submission::query()
            ->whereHas('assignment', fn ($q) => $q->where('teacher_id', $user->id))
            ->distinct()
            ->pluck('student_id');

        $studentIds = $fromGroups->merge($fromSubmissions)->unique()->filter()->values();
        $myGroupIds = $groupIds->map(fn ($id) => (int) $id)->all();

        $rows = User::query()
            ->where('role', 'student')
            ->where('is_active', true)
            ->whereIn('id', $studentIds)
            ->with('studentGroup:id,name')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name', 'middle_name', 'role', 'group_id']);

        $teacherGroupsPayload = $groupIds->isEmpty()
            ? collect()
            : Group::query()
                ->whereIn('id', $groupIds)
                ->withCount([
                    'students as students_active_count' => function ($q) {
                        $q->where('is_active', true)->where('role', 'student');
                    },
                ])
                ->orderBy('name')
                ->get()
                ->map(fn (Group $g) => [
                    'id' => $g->id,
                    'name' => $g->name,
                    'students_in_group' => (int) $g->students_active_count,
                ])
                ->values();

        return response()->json([
            'data' => $rows->map(function (User $u) use ($myGroupIds) {
                $inMyGroup = $u->group_id && in_array((int) $u->group_id, $myGroupIds, true);

                return $this->formatStudentPartner($u, $inMyGroup);
            }),
            'teacher_groups' => $teacherGroupsPayload,
        ]);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        // Активные беседы — без своей стороны архива; archived — только помеченные текущим пользователем.
        $scope = $request->query('scope', 'active');
        if (! in_array($scope, ['active', 'archived'], true)) {
            $scope = 'active';
        }

        $conversations = Conversation::query()
            ->where(function ($q) use ($user, $scope) {
                if ($scope === 'active') {
                    $q->where(function ($q2) use ($user) {
                        $q2->where('user_one_id', $user->id)
                            ->whereNull('user_one_archived_at');
                    })->orWhere(function ($q2) use ($user) {
                        $q2->where('user_two_id', $user->id)
                            ->whereNull('user_two_archived_at');
                    });
                } else {
                    $q->where(function ($q2) use ($user) {
                        $q2->where('user_one_id', $user->id)
                            ->whereNotNull('user_one_archived_at');
                    })->orWhere(function ($q2) use ($user) {
                        $q2->where('user_two_id', $user->id)
                            ->whereNotNull('user_two_archived_at');
                    });
                }
            })
            ->whereHas('messages')
            ->with(['userOne', 'userTwo'])
            ->get();

        $payload = $conversations->map(function (Conversation $c) use ($user) {
            $other = $c->otherParticipant($user);
            $unread = Message::query()
                ->where('conversation_id', $c->id)
                ->where('sender_id', '!=', $user->id)
                ->whereNull('read_at')
                ->count();
            $last = Message::query()
                ->where('conversation_id', $c->id)
                ->orderByDesc('id')
                ->first();

            return [
                'id' => $c->id,
                'other_user' => $other ? $this->formatUserBrief($other) : null,
                'last_message' => $last ? [
                    'body' => Str::limit($last->body, 160),
                    'sender_id' => $last->sender_id,
                    'created_at' => $last->created_at->toIso8601String(),
                ] : null,
                'unread_count' => $unread,
                '_sort' => $last ? $last->created_at->timestamp : 0,
            ];
        })
            ->sortByDesc('_sort')
            ->map(fn (array $row) => [
                'id' => $row['id'],
                'other_user' => $row['other_user'],
                'last_message' => $row['last_message'],
                'unread_count' => $row['unread_count'],
            ])
            ->values();

        return response()->json(['data' => $payload]);
    }

    /**
     * Создание диалога только вместе с первым сообщением (пустые беседы не храним).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'body' => ['required', 'string', 'max:8000'],
        ], [
            'body.required' => 'Введите текст сообщения.',
        ]);

        $me = $request->user();
        $other = User::query()->findOrFail($validated['user_id']);

        if (!$me->canCommunicateWith($other)) {
            return response()->json([
                'message' => 'Нельзя начать переписку с этим пользователем.',
            ], 403);
        }

        [$one, $two] = Conversation::orderedUserIds((int) $me->id, (int) $other->id);

        /** @var array{0: Conversation, 1: Message} $pair */
        $pair = DB::transaction(function () use ($one, $two, $me, $validated) {
            $conversation = Conversation::query()->firstOrCreate([
                'user_one_id' => $one,
                'user_two_id' => $two,
            ]);

            $message = Message::query()->create([
                'conversation_id' => $conversation->id,
                'sender_id' => $me->id,
                'body' => $validated['body'],
            ]);

            $conversation->touch();
            // Первое сообщение снимает архив с нашей стороны, чтобы диалог снова попал в активные.
            if ((int) $conversation->user_one_id === (int) $me->id) {
                $conversation->forceFill(['user_one_archived_at' => null])->save();
            } else {
                $conversation->forceFill(['user_two_archived_at' => null])->save();
            }

            return [$conversation, $message];
        });

        [$conversation, $message] = $pair;
        $message->load('sender:id,first_name,last_name,middle_name,role');

        return response()->json([
            'data' => [
                'conversation_id' => $conversation->id,
                'message' => $this->formatMessagePayload($message),
            ],
        ], 201);
    }

    public function messages(Request $request, Conversation $conversation)
    {
        $user = $request->user();
        if (!$conversation->involvesUser($user)) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        // При открытии истории помечаем входящие непрочитанные как прочитанные.
        Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $paginator = Message::query()
            ->where('conversation_id', $conversation->id)
            ->with('sender:id,first_name,last_name,middle_name,role')
            ->orderBy('id')
            ->paginate(80);

        $items = collect($paginator->items())->map(fn (Message $m) => $this->formatMessagePayload($m));

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function sendMessage(Request $request, Conversation $conversation)
    {
        $user = $request->user();
        if (!$conversation->involvesUser($user)) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:8000'],
        ], [
            'body.required' => 'Введите текст сообщения.',
        ]);

        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'body' => $validated['body'],
        ]);

        $conversation->touch();
        // Новое сообщение возвращает диалог из архива на стороне отправителя.
        if ((int) $conversation->user_one_id === (int) $user->id) {
            $conversation->forceFill(['user_one_archived_at' => null])->save();
        } else {
            $conversation->forceFill(['user_two_archived_at' => null])->save();
        }

        $message->load('sender:id,first_name,last_name,middle_name,role');

        return response()->json([
            'data' => $this->formatMessagePayload($message),
        ], 201);
    }

    public function archive(Request $request, Conversation $conversation)
    {
        $user = $request->user();
        if (! $conversation->involvesUser($user)) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        if ((int) $conversation->user_one_id === (int) $user->id) {
            $conversation->forceFill(['user_one_archived_at' => now()])->save();
        } else {
            $conversation->forceFill(['user_two_archived_at' => now()])->save();
        }

        return response()->json(['success' => true]);
    }

    public function unarchive(Request $request, Conversation $conversation)
    {
        $user = $request->user();
        if (! $conversation->involvesUser($user)) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        if ((int) $conversation->user_one_id === (int) $user->id) {
            $conversation->forceFill(['user_one_archived_at' => null])->save();
        } else {
            $conversation->forceFill(['user_two_archived_at' => null])->save();
        }

        return response()->json(['success' => true]);
    }

    private function formatMessagePayload(Message $m): array
    {
        return [
            'id' => $m->id,
            'conversation_id' => $m->conversation_id,
            'sender_id' => $m->sender_id,
            'body' => $m->body,
            'read_at' => $m->read_at?->toIso8601String(),
            'created_at' => $m->created_at->toIso8601String(),
            'sender' => $m->sender ? $this->formatUserBrief($m->sender) : null,
        ];
    }

    private function formatUserBrief(User $u): array
    {
        return [
            'id' => $u->id,
            'full_name' => $u->full_name,
            'role' => $u->role,
        ];
    }

    /**
     * @param  bool  $inMyGroup  Студент из группы, закреплённой за этим преподавателем
     */
    private function formatStudentPartner(User $u, bool $inMyGroup): array
    {
        return [
            'id' => $u->id,
            'full_name' => $u->full_name,
            'role' => $u->role,
            'group_id' => $u->group_id,
            'group_name' => $u->studentGroup?->name,
            'partner_source' => $inMyGroup ? 'my_group' : 'submission',
        ];
    }
}
