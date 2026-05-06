<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentAllowedFormat;
use App\Models\Group;
use App\Models\Subject;
use App\Models\Submission;
use App\Models\TeachingLoad;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SubmissionIndexTeacherFiltersTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_list_submissions_with_status_and_deadline_filter_and_review_queue_sort(): void
    {
        $teacher = $this->createUser('teacher');
        $group = Group::create([
            'name' => 'Тест-' . uniqid(),
            'status' => 'active',
        ]);
        $student = $this->createUser('student', $group->id);
        $assignment = $this->createAssignment($teacher->id, ['pdf'], 10, $group, now()->subDay()->toDateString());

        $submission = Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $student->id,
            'status' => 'submitted',
            'file_name' => 'work.pdf',
            'file_path' => 'path/work.pdf',
            'submitted_at' => now(),
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->getJson('/api/submissions?' . http_build_query([
            'sort' => 'review_queue',
            'status' => 'submitted',
            'deadline_filter' => 'overdue',
            'per_page' => 20,
            'page' => 1,
        ]));

        $response->assertOk();
        $response->assertJsonPath('data.0.id', $submission->id);
    }

    public function test_overdue_deadline_filter_excludes_graded_submission_submitted_on_time(): void
    {
        $teacher = $this->createUser('teacher');
        $group = Group::create([
            'name' => 'Тест-' . uniqid(),
            'status' => 'active',
        ]);
        $student = $this->createUser('student', $group->id);
        $pastDeadline = now()->subDays(5)->toDateString();
        $assignment = $this->createAssignment($teacher->id, ['pdf'], 10, $group, $pastDeadline);

        $gradedOnTime = Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $student->id,
            'status' => 'graded',
            'score' => 100,
            'file_name' => 'ok.pdf',
            'file_path' => 'path/ok.pdf',
            'submitted_at' => now()->subDays(9),
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->getJson('/api/submissions?' . http_build_query([
            'deadline_filter' => 'overdue',
            'per_page' => 20,
            'page' => 1,
        ]));

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertNotContains($gradedOnTime->id, $ids);
    }

    public function test_overdue_deadline_filter_includes_graded_submission_submitted_late(): void
    {
        $teacher = $this->createUser('teacher');
        $group = Group::create([
            'name' => 'Тест-' . uniqid(),
            'status' => 'active',
        ]);
        $student = $this->createUser('student', $group->id);
        $pastDeadline = now()->subDays(7)->toDateString();
        $assignment = $this->createAssignment($teacher->id, ['pdf'], 10, $group, $pastDeadline);

        $gradedLate = Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $student->id,
            'status' => 'graded',
            'score' => 80,
            'file_name' => 'late.pdf',
            'file_path' => 'path/late.pdf',
            'submitted_at' => now()->subDays(2),
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->getJson('/api/submissions?' . http_build_query([
            'deadline_filter' => 'overdue',
            'per_page' => 20,
            'page' => 1,
        ]));

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($gradedLate->id, $ids);
    }

    private function createAssignment(
        int $teacherId,
        array $formats,
        int $maxFileSizeMb,
        ?Group $group = null,
        ?string $deadline = null
    ): Assignment {
        $subject = Subject::create([
            'name' => 'Тестовый предмет ' . uniqid(),
            'status' => 'active',
        ]);

        if ($group) {
            TeachingLoad::create([
                'teacher_id' => $teacherId,
                'subject_id' => $subject->id,
                'group_id' => $group->id,
                'status' => 'active',
            ]);
        }

        $assignment = Assignment::create([
            'title' => 'Тестовое задание',
            'subject_id' => $subject->id,
            'description' => 'Описание.',
            'deadline' => $deadline ?? now()->addDays(7)->toDateString(),
            'status' => 'active',
            'max_score' => 100,
            'submission_type' => 'file',
            'max_file_size' => $maxFileSizeMb,
            'teacher_id' => $teacherId,
        ]);

        foreach ($formats as $format) {
            AssignmentAllowedFormat::create([
                'assignment_id' => $assignment->id,
                'format' => '.' . ltrim((string) $format, '.'),
            ]);
        }

        if ($group) {
            $assignment->groups()->attach($group->id);
        }

        return $assignment;
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
            'department' => null,
            'phone' => '+7 (999) 123-45-67',
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
