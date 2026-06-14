<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentMaterial;
use App\Models\Group;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssignmentMaterialDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_get_signed_download_url_for_assignment_material(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('materials/test.pdf', 'pdf-content');

        $teacher = $this->createUser('teacher');
        $group = Group::create([
            'name' => 'ИСП-DL',
            'status' => 'active',
        ]);
        $student = $this->createUser('student', $group->id);
        $subject = Subject::create([
            'name' => 'Дисциплина',
            'code' => 'DL-' . uniqid(),
            'status' => 'active',
        ]);

        $assignment = Assignment::create([
            'title' => 'Задание с материалом',
            'subject_id' => $subject->id,
            'description' => 'Описание задания для проверки скачивания материала.',
            'deadline' => now()->addDays(7)->toDateString(),
            'status' => 'active',
            'max_score' => 100,
            'submission_type' => 'file',
            'teacher_id' => $teacher->id,
        ]);
        $assignment->groups()->sync([$group->id]);

        $material = AssignmentMaterial::create([
            'assignment_id' => $assignment->id,
            'file_name' => 'methodology.pdf',
            'file_path' => 'materials/test.pdf',
            'file_size' => '12 KB',
            'file_type' => 'application/pdf',
        ]);

        Sanctum::actingAs($student);

        $response = $this->getJson("/api/assignments/{$assignment->id}/materials/{$material->id}/download-url");

        $response->assertOk();
        $response->assertJsonPath('file_name', 'methodology.pdf');
        $this->assertNotEmpty($response->json('url'));

        URL::forceRootUrl('http://localhost');
        $signedResponse = $this->get($response->json('url'));
        $signedResponse->assertOk();
        $signedResponse->assertDownload('methodology.pdf');
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
