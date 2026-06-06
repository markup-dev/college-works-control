<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Group;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NaturallyClosedAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_edit_naturally_closed_assignment(): void
    {
        $admin = $this->createUser('admin');
        $assignment = $this->createNaturallyClosedAssignment();

        Sanctum::actingAs($admin);

        $this->putJson("/api/admin/assignments/{$assignment->id}", [
            'title' => 'Новое название',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    private function createNaturallyClosedAssignment(): Assignment
    {
        $teacher = $this->createUser('teacher');
        $group = Group::create([
            'name' => 'Г-' . uniqid(),
            'status' => 'active',
            'current_course' => 1,
        ]);
        $student = $this->createUser('student', $group->id);
        $subject = Subject::create([
            'name' => 'Дисциплина ' . uniqid(),
            'code' => 'SUB' . substr(uniqid(), -6),
            'status' => 'active',
        ]);

        $assignment = Assignment::create([
            'title' => 'Завершённое задание',
            'subject_id' => $subject->id,
            'description' => 'Описание задания для проверки блокировки редактирования.',
            'deadline' => now()->subDay()->toDateString(),
            'status' => 'archived',
            'max_score' => 100,
            'submission_type' => 'file',
            'teacher_id' => $teacher->id,
        ]);
        $assignment->groups()->sync([$group->id]);

        Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $student->id,
            'status' => 'graded',
            'score' => 5,
            'submitted_at' => now()->subDays(2),
        ]);

        return $assignment->fresh();
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
