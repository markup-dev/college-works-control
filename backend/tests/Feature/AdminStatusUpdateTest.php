<?php

namespace Tests\Feature;

use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminStatusUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_deactivate_user(): void
    {
        $admin = $this->createUser('admin');
        $student = $this->createUser('student');

        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/admin/users/{$student->id}", [
            'is_active' => false,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'is_active' => 0,
        ]);
    }

    public function test_admin_can_deactivate_subject(): void
    {
        $admin = $this->createUser('admin');
        $teacher = $this->createUser('teacher');
        $subject = Subject::create([
            'name' => 'Математика',
            'teacher_id' => $teacher->id,
            'status' => 'active',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/admin/subjects/{$subject->id}", [
            'status' => 'inactive',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('subject.status', 'inactive');

        $this->assertDatabaseHas('subjects', [
            'id' => $subject->id,
            'status' => 'inactive',
        ]);
    }

    private function createUser(string $role): User
    {
        return User::create([
            'login' => $role . '_' . uniqid(),
            'email' => uniqid($role . '_', true) . '@example.com',
            'password' => 'Password1',
            'last_name' => 'Иванов',
            'first_name' => 'Иван',
            'middle_name' => 'Иванович',
            'role' => $role,
            'group_id' => null,
            'department' => null,
            'phone' => '+7 (999) 123-45-67',
            'theme' => 'system',
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
