<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\User;
use App\Services\Teacher\TeacherStudentService;
use Illuminate\Http\Request;

/**
 * Эндпоинты преподавателя «мои студенты и группы»: сводки, карточка студента, детали группы.
 * Логика агрегаций в TeacherStudentService.
 */
class TeacherStudentController extends Controller
{
    public function __construct(
        private readonly TeacherStudentService $teacherStudents,
    ) {}

    public function index(Request $request)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher') {
            abort(403);
        }

        return response()->json($this->teacherStudents->studentsIndexData($teacher));
    }

    public function show(Request $request, User $user)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher' || $user->role !== 'student') {
            abort(404);
        }

        $allowed = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        $g = $user->group_id ? (int) $user->group_id : null;
        if (! $g || ! in_array($g, $allowed, true)) {
            abort(403, 'Нет доступа к данному студенту.');
        }

        return response()->json($this->teacherStudents->studentShowData($teacher, $user));
    }

    public function groupsOverview(Request $request)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher') {
            abort(403);
        }

        return response()->json($this->teacherStudents->groupsOverviewData($teacher));
    }

    public function groupDetails(Request $request, Group $group)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher') {
            abort(403);
        }
        $allowed = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        if (! in_array((int) $group->id, $allowed, true)) {
            abort(403, 'Нет доступа к этой группе.');
        }

        $subjectId = (int) $request->query('subject_id', 0);
        $assignmentId = (int) $request->query('assignment_id', 0);
        $debtOnly = (bool) ((int) $request->query('debt_only', 0));
        $search = trim((string) $request->query('search', ''));

        return response()->json(
            $this->teacherStudents->groupDetailsData($teacher, $group, $subjectId, $assignmentId, $debtOnly, $search)
        );
    }

    public function studentDetails(Request $request, Group $group, User $user)
    {
        $teacher = $request->user();
        if ($teacher->role !== 'teacher' || $user->role !== 'student') {
            abort(404);
        }
        $allowed = $teacher->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
        if (! in_array((int) $group->id, $allowed, true) || (int) $user->group_id !== (int) $group->id) {
            abort(403, 'Нет доступа к данным этого студента.');
        }

        $subjectId = (int) $request->query('subject_id', 0);
        $status = (string) $request->query('status', 'all');
        $debtOnly = (bool) ((int) $request->query('debt_only', 0));
        $periodDays = (int) $request->query('period_days', 0);

        return response()->json(
            $this->teacherStudents->studentDetailsData($teacher, $group, $user, $subjectId, $status, $debtOnly, $periodDays)
        );
    }
}
