<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Group;
use App\Models\Message;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\SystemLog;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Админ-дэшборд: агрегированная статистика по пользователям, группам, заданиям, сдачам и активности.
 */
class DashboardController extends Controller
{
    public function stats()
    {
        $usersByRole = User::selectRaw('role, COUNT(*) as total')
            ->groupBy('role')
            ->pluck('total', 'role');

        $today = now()->toDateString();
        $usersCreatedLast7Days = User::where('created_at', '>=', now()->subDays(7))->count();
        $groupsActive = Group::where('status', 'active')->count();
        $groupsInactive = Group::where('status', 'inactive')->count();
        $assignmentsActive = Assignment::where('status', 'active')->count();
        $assignmentsOverdue = Assignment::where('status', 'active')
            ->whereDate('deadline', '<', $today)
            ->count();
        $assignmentsActiveNotOverdue = Assignment::where('status', 'active')
            ->whereDate('deadline', '>=', $today)
            ->count();
        $submissionsStaleReview = Submission::where('status', 'submitted')
            ->whereNotNull('submitted_at')
            ->where('submitted_at', '<=', now()->subDays(3))
            ->count();

        $activityStart = now()->subDays(6)->startOfDay();
        $activityWeek = [
            'labels' => [],
            'logins' => [],
            'submissions' => [],
            'messages' => [],
        ];
        for ($i = 0; $i < 7; $i++) {
            $day = $activityStart->copy()->addDays($i);
            $d = $day->format('Y-m-d');
            $activityWeek['labels'][] = Str::ucfirst($day->locale('ru')->isoFormat('dd'));
            $activityWeek['logins'][] = SystemLog::whereDate('created_at', $d)->where('action', 'login')->count();
            $activityWeek['submissions'][] = Submission::whereDate('submitted_at', $d)->count();
            $activityWeek['messages'][] = Message::whereDate('created_at', $d)->count();
        }

        return response()->json([
            'total_users' => User::count(),
            'active_users' => User::where('is_active', true)->count(),
            'student_users' => (int) ($usersByRole['student'] ?? 0),
            'teacher_users' => (int) ($usersByRole['teacher'] ?? 0),
            'admin_users' => (int) ($usersByRole['admin'] ?? 0),
            'total_groups' => Group::count(),
            'total_subjects' => Subject::count(),
            'active_subjects' => Subject::where('status', 'active')->count(),
            'total_assignments' => Assignment::count(),
            'total_submissions' => Submission::count(),
            'pending_submissions' => Submission::where('status', 'submitted')->count(),
            'graded_submissions' => Submission::where('status', 'graded')->count(),
            'returned_submissions' => Submission::where('status', 'returned')->count(),
            'system_uptime' => '99.8%',
            'users_created_last_7_days' => $usersCreatedLast7Days,
            'groups_active' => $groupsActive,
            'groups_inactive' => $groupsInactive,
            'assignments_active' => $assignmentsActive,
            'assignments_overdue' => $assignmentsOverdue,
            'assignments_active_on_track' => $assignmentsActiveNotOverdue,
            'submissions_stale_review' => $submissionsStaleReview,
            'activity_week' => $activityWeek,
        ]);
    }
}
