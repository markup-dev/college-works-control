<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\Subject;
use App\Models\TeacherSubject;
use App\Models\TeachingLoad;
use App\Models\User;
use App\Notifications\AssignmentAnnouncedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssignmentAnnouncedNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_assignment_notifies_students_in_target_groups(): void
    {
        Notification::fake();

        $teacher = $this->createUser('teacher');
        $group = Group::create([
            'name' => 'ИСП-TEST',
            'status' => 'active',
        ]);
        $student = $this->createUser('student', $group->id);
        $subject = Subject::create([
            'name' => 'Базы данных',
            'code' => 'DB-' . uniqid(),
            'status' => 'active',
        ]);

        TeachingLoad::create([
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'group_id' => $group->id,
            'status' => 'active',
        ]);

        TeacherSubject::create([
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'status' => 'active',
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->postJson('/api/assignments', [
            'title' => 'Нормализация учебной базы данных',
            'subject_id' => $subject->id,
            'description' => 'Подготовьте отчёт по нормализации схемы базы данных.',
            'deadline' => now()->addDays(7)->toDateString(),
            'student_groups' => [$group->name],
            'allowed_formats' => ['pdf'],
        ]);

        $response->assertCreated();

        Notification::assertSentTo(
            $student,
            AssignmentAnnouncedNotification::class,
            fn (AssignmentAnnouncedNotification $notification) => $notification->viaChannels === ['database']
        );
    }

    private function createUser(string $role, ?int $groupId = null): User
    {
        return User::create([
            'login' => $role . '_' . uniqid(),
            'email' => uniqid($role . '_', true) . '@example.com',
            'password' => 'Password1',
            'last_name' => 'Иванов',
            'first_name' => 'Иван',
            'middle_name' => 'Иванович',
            'role' => $role,
            'group_id' => $groupId,
            'department' => $role === 'teacher' ? 'Кафедра информатики' : null,
            'phone' => '+7 (999) 123-45-67',
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
