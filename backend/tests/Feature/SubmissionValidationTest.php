<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentAllowedFormat;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SubmissionValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_submission_rejects_file_with_disallowed_format_from_assignment_settings(): void
    {
        $teacher = $this->createUser('teacher');
        $student = $this->createUser('student');
        $assignment = $this->createAssignment($teacher->id, ['pdf'], 10);

        Sanctum::actingAs($student);

        $response = $this->postJson('/api/submissions', [
            'assignment_id' => $assignment->id,
            'file' => UploadedFile::fake()->create('work.docx', 100, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    public function test_submission_rejects_file_over_assignment_max_file_size(): void
    {
        $teacher = $this->createUser('teacher');
        $student = $this->createUser('student');
        $assignment = $this->createAssignment($teacher->id, ['pdf'], 1);

        Sanctum::actingAs($student);

        $response = $this->postJson('/api/submissions', [
            'assignment_id' => $assignment->id,
            'file' => UploadedFile::fake()->create('work.pdf', 2048, 'application/pdf'),
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    private function createAssignment(int $teacherId, array $formats, int $maxFileSizeMb): Assignment
    {
        $subject = Subject::create([
            'name' => 'Тестовый предмет ' . uniqid(),
            'teacher_id' => $teacherId,
            'status' => 'active',
        ]);

        $assignment = Assignment::create([
            'title' => 'Тестовое задание',
            'subject_id' => $subject->id,
            'description' => 'Описание тестового задания для проверки валидации файлов.',
            'deadline' => now()->addDays(7)->toDateString(),
            'status' => 'active',
            'priority' => 'medium',
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

        return $assignment;
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
