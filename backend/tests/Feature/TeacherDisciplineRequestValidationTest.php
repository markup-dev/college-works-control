<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\GroupSubject;
use App\Models\Subject;
use App\Models\TeacherSubject;
use App\Models\TeachingLoad;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeacherDisciplineRequestValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_cannot_request_discipline_already_allowed(): void
    {
        $teacher = $this->createUser('teacher');
        $subject = $this->createSubject();

        TeacherSubject::create([
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'status' => 'active',
        ]);

        Sanctum::actingAs($teacher);

        $this->postJson('/api/teacher/discipline-requests', [
            'subject_id' => $subject->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('subject_id');
    }

    public function test_teacher_cannot_request_existing_teaching_load(): void
    {
        $teacher = $this->createUser('teacher');
        $subject = $this->createSubject();
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

        TeachingLoad::create([
            'teacher_id' => $teacher->id,
            'subject_id' => $subject->id,
            'group_id' => $group->id,
            'status' => 'active',
        ]);

        Sanctum::actingAs($teacher);

        $this->postJson('/api/teacher/teaching-load-requests', [
            'subject_id' => $subject->id,
            'group_id' => $group->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('group_id');
    }

    private function createUser(string $role): User
    {
        return User::factory()->create([
            'role' => $role,
            'is_active' => true,
        ]);
    }

    private function createSubject(): Subject
    {
        return Subject::create([
            'name' => 'Дисциплина ' . uniqid(),
            'code' => 'SUB' . substr(uniqid(), -6),
            'status' => 'active',
        ]);
    }
}
