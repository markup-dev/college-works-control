<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\GroupSubject;
use App\Models\Subject;
use App\Models\TeacherSubject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BlockedTeacherAdminActionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_add_discipline_to_blocked_teacher(): void
    {
        $admin = $this->createUser('admin');
        $teacher = $this->createUser('teacher');
        $teacher->forceFill(['is_active' => false])->save();
        $subject = Subject::create([
            'name' => 'Дисциплина ' . uniqid(),
            'code' => 'SUB' . substr(uniqid(), -6),
            'status' => 'active',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson("/api/admin/teachers/{$teacher->id}/disciplines", [
            'subject_id' => $subject->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('teacher_id');
    }

    public function test_admin_cannot_create_teaching_load_for_blocked_teacher(): void
    {
        $admin = $this->createUser('admin');
        $teacher = $this->createUser('teacher');
        $teacher->forceFill(['is_active' => false])->save();

        $subject = Subject::create([
            'name' => 'Нагрузка ' . uniqid(),
            'code' => 'LD' . substr(uniqid(), -6),
            'status' => 'active',
        ]);

        $group = Group::create([
            'name' => 'Г-' . uniqid(),
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

        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/teaching-loads', [
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'group_id' => $group->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('teacher_id');
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
            'group_id' => $role === 'student' ? $groupId : null,
            'department' => $role === 'teacher' ? 'Кафедра информатики' : null,
            'phone' => '+7 (999) 123-45-67',
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
