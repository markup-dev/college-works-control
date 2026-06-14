<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\GroupSubject;
use App\Models\Subject;
use App\Models\TeacherSubject;
use App\Models\User;
use App\Notifications\TeacherRequestAdminNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeacherRequestAdminNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_discipline_request_notifies_active_admins(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $teacher = User::factory()->create(['role' => 'teacher', 'is_active' => true]);
        $subject = Subject::create([
            'name' => 'Базы данных',
            'code' => 'DB-101',
            'status' => 'active',
        ]);

        Sanctum::actingAs($teacher);

        $this->postJson('/api/teacher/discipline-requests', [
            'subject_id' => $subject->id,
        ])->assertCreated();

        Notification::assertSentTo(
            $admin,
            TeacherRequestAdminNotification::class,
            fn (TeacherRequestAdminNotification $notification) => $notification->kind === 'teacher_discipline_request'
                && (int) $notification->request->subject_id === (int) $subject->id,
        );
    }

    public function test_teaching_load_request_notifies_active_admins(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $teacher = User::factory()->create(['role' => 'teacher', 'is_active' => true]);
        $subject = Subject::create([
            'name' => 'Программирование',
            'code' => 'PR-101',
            'status' => 'active',
        ]);
        $group = Group::create([
            'name' => 'ИС-301',
            'status' => 'active',
            'current_course' => 1,
        ]);

        TeacherSubject::create([
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'status' => 'active',
        ]);

        GroupSubject::create([
            'group_id' => $group->id,
            'subject_id' => $subject->id,
            'course' => 1,
            'status' => 'active',
        ]);

        Sanctum::actingAs($teacher);

        $this->postJson('/api/teacher/teaching-load-requests', [
            'subject_id' => $subject->id,
            'group_id' => $group->id,
        ])->assertCreated();

        Notification::assertSentTo(
            $admin,
            TeacherRequestAdminNotification::class,
            fn (TeacherRequestAdminNotification $notification) => $notification->kind === 'teacher_teaching_load_request'
                && (int) $notification->request->group_id === (int) $group->id,
        );
    }
}
