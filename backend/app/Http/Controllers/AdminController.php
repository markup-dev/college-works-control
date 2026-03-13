<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Course;
use App\Models\Assignment;
use App\Models\Submission;
use App\Models\SystemLog;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function stats()
    {
        return response()->json([
            'total_users' => User::count(),
            'active_users' => User::where('is_active', true)->count(),
            'total_courses' => Course::count(),
            'active_courses' => Course::where('status', 'active')->count(),
            'total_assignments' => Assignment::count(),
            'pending_submissions' => Submission::where('status', 'submitted')->count(),
            'system_uptime' => '99.8%',
        ]);
    }

    // --- Users ---

    public function users()
    {
        return response()->json(User::all());
    }

    public function createUser(Request $request)
    {
        $validated = $request->validate([
            'login' => 'required|string|unique:users,login',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'name' => 'required|string|max:255',
            'role' => 'required|in:student,teacher,admin',
            'group' => 'nullable|string',
            'department' => 'nullable|string',
            'teacher_login' => 'nullable|string',
        ]);

        $user = User::create([
            ...$validated,
            'is_active' => true,
            'notifications' => ['email' => true, 'push' => true, 'sms' => false],
            'theme' => 'system',
        ]);

        $this->log($request, 'create_user', "Создан пользователь {$user->name}");

        return response()->json(['success' => true, 'user' => $user], 201);
    }

    public function updateUser(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => "sometimes|email|unique:users,email,{$user->id}",
            'role' => 'sometimes|in:student,teacher,admin',
            'group' => 'nullable|string',
            'department' => 'nullable|string',
            'phone' => 'nullable|string',
            'bio' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
            'teacher_login' => 'nullable|string',
        ]);

        $user->update($validated);

        $this->log($request, 'update_user', "Изменены данные пользователя {$user->name}");

        return response()->json(['success' => true, 'user' => $user->fresh()]);
    }

    public function deleteUser(Request $request, User $user)
    {
        $name = $user->name;
        $user->delete();

        $this->log($request, 'delete_user', "Удален пользователь {$name}");

        return response()->json(['success' => true]);
    }

    // --- Courses ---

    public function courses()
    {
        return response()->json(Course::with('teacher:id,name,login')->get());
    }

    public function createCourse(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'teacher_id' => 'nullable|exists:users,id',
            'students_count' => 'nullable|integer|min:0',
            'status' => 'nullable|in:active,inactive',
        ]);

        $course = Course::create([
            ...$validated,
            'status' => $validated['status'] ?? 'active',
            'students_count' => $validated['students_count'] ?? 0,
        ]);

        $this->log($request, 'create_course', "Создан курс {$course->name}");

        return response()->json(['success' => true, 'course' => $course->load('teacher:id,name,login')], 201);
    }

    public function updateCourse(Request $request, Course $course)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'teacher_id' => 'nullable|exists:users,id',
            'students_count' => 'nullable|integer|min:0',
            'status' => 'nullable|in:active,inactive',
        ]);

        $course->update($validated);

        $this->log($request, 'update_course', "Изменен курс {$course->name}");

        return response()->json(['success' => true, 'course' => $course->fresh()->load('teacher:id,name,login')]);
    }

    public function deleteCourse(Request $request, Course $course)
    {
        $name = $course->name;
        $course->delete();

        $this->log($request, 'delete_course', "Удален курс {$name}");

        return response()->json(['success' => true]);
    }

    // --- Assignments (admin) ---

    public function deleteAssignment(Request $request, Assignment $assignment)
    {
        $title = $assignment->title;
        $assignment->delete();

        $this->log($request, 'delete_assignment', "Удалено задание {$title}");

        return response()->json(['success' => true]);
    }

    // --- Logs ---

    public function logs()
    {
        $logs = SystemLog::latest('created_at')
            ->limit(100)
            ->get()
            ->map(fn($log) => [
                'id' => $log->id,
                'timestamp' => $log->created_at,
                'user' => $log->user_login,
                'user_role' => $log->user_role,
                'action' => $log->action,
                'details' => $log->details,
            ]);

        return response()->json($logs);
    }

    private function log(Request $request, string $action, string $details): void
    {
        $user = $request->user();
        SystemLog::create([
            'user_id' => $user->id,
            'user_login' => $user->login,
            'user_role' => $user->role,
            'action' => $action,
            'details' => $details,
        ]);
    }
}
