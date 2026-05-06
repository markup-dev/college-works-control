<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\Submission;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $paginator = $request->user()
            ->notifications()
            ->orderByDesc('created_at')
            ->paginate(40);

        $notifications = collect($paginator->items());
        $payloads = $notifications->map(fn (DatabaseNotification $n) => [
            'id' => $n->id,
            'type' => class_basename($n->type),
            'data' => $n->data,
            'read_at' => $n->read_at?->toIso8601String(),
            'created_at' => $n->created_at->toIso8601String(),
        ]);

        $assignmentIdsForTeacher = $payloads
            ->pluck('data')
            ->filter(fn ($data) => is_array($data)
                && !empty($data['assignment_id'])
                && (
                    empty($data['teacher_name'])
                    || $data['teacher_name'] === 'Не указан'
                ))
            ->pluck('assignment_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $teachersByAssignment = $assignmentIdsForTeacher->isEmpty()
            ? collect()
            : Assignment::query()
                ->with('teacher:id,login,last_name,first_name,middle_name')
                ->whereIn('id', $assignmentIdsForTeacher)
                ->get(['id', 'teacher_id'])
                ->mapWithKeys(fn (Assignment $assignment) => [
                    (int) $assignment->id => $assignment->teacher?->full_name,
                ]);

        $submissionIdsForGroup = $payloads
            ->pluck('data')
            ->filter(fn ($data) => is_array($data)
                && ($data['kind'] ?? null) === 'submission_submitted_teacher'
                && !empty($data['submission_id'])
                && empty($data['student_group_name']))
            ->pluck('submission_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $submissionsById = $submissionIdsForGroup->isEmpty()
            ? collect()
            : Submission::query()
                ->with([
                    'assignment:id,title',
                    'student:id,group_id,last_name,first_name,middle_name',
                    'student.studentGroup:id,name',
                ])
                ->whereIn('id', $submissionIdsForGroup)
                ->get(['id', 'assignment_id', 'student_id'])
                ->keyBy('id');

        $items = $payloads->map(function (array $item) use ($teachersByAssignment, $submissionsById) {
            $data = is_array($item['data'] ?? null) ? $item['data'] : [];

            $assignmentId = isset($data['assignment_id']) ? (int) $data['assignment_id'] : null;
            if ($assignmentId && (empty($data['teacher_name']) || $data['teacher_name'] === 'Не указан')) {
                $teacherName = $teachersByAssignment->get($assignmentId);
                if ($teacherName) {
                    $data['teacher_name'] = $teacherName;
                }
            }

            $submissionId = isset($data['submission_id']) ? (int) $data['submission_id'] : null;
            if (($data['kind'] ?? null) === 'submission_submitted_teacher' && $submissionId) {
                /** @var Submission|null $submission */
                $submission = $submissionsById->get($submissionId);
                $groupName = $submission?->student?->studentGroup?->name;
                if ($groupName) {
                    $data['student_group_name'] = $groupName;
                    $studentName = $submission->student?->full_name ?? 'Студент';
                    $title = $submission->assignment?->title ?? 'Задание';
                    $data['body'] = $studentName.' ('.$groupName.') — «'.$title.'»';
                }
            }

            $item['data'] = $data;
            return $item;
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function unreadCount(Request $request)
    {
        $count = $request->user()->unreadNotifications()->count();

        return response()->json(['count' => $count]);
    }

    public function markRead(Request $request, string $id)
    {
        /** @var DatabaseNotification|null $notification */
        $notification = $request->user()->notifications()->where('id', $id)->first();

        if (! $notification) {
            return response()->json(['message' => 'Уведомление не найдено'], 404);
        }

        if ($notification->read_at === null) {
            $notification->markAsRead();
        }

        return response()->json(['success' => true]);
    }

    public function markAllRead(Request $request)
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['success' => true]);
    }

    /**
     * Удалить все записи уведомлений пользователя из БД.
     */
    public function destroyAll(Request $request)
    {
        $request->user()->notifications()->delete();

        return response()->json(['success' => true]);
    }
}
