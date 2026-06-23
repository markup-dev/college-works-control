<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Group;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssignmentMaterialUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_upload_assignment_material_via_multipart_form(): void
    {
        Storage::fake('public');

        $teacher = $this->createUser('teacher');
        $subject = Subject::create([
            'name' => 'Дисциплина',
            'code' => 'SUB-' . uniqid(),
            'status' => 'active',
        ]);

        $assignment = Assignment::create([
            'title' => 'Задание с материалом',
            'subject_id' => $subject->id,
            'description' => 'Описание задания для проверки загрузки материала.',
            'deadline' => now()->addDays(7)->toDateString(),
            'status' => 'active',
            'max_score' => 100,
            'submission_type' => 'file',
            'teacher_id' => $teacher->id,
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->post("/api/assignments/{$assignment->id}/materials", [
            'files' => [UploadedFile::fake()->create('methodology.pdf', 128, 'application/pdf')],
        ]);

        $response->assertOk();
        $this->assertDatabaseCount('assignment_materials', 1);
        $this->assertDatabaseHas('assignment_materials', [
            'assignment_id' => $assignment->id,
            'file_name' => 'methodology.pdf',
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
            'department' => $role === 'teacher' ? 'Кафедра информатики' : null,
            'phone' => '+7 (999) 123-45-67',
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
