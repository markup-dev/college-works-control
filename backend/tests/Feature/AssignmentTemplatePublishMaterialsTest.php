<?php

namespace Tests\Feature;

use App\Models\AssignmentTemplate;
use App\Models\AssignmentTemplateMaterial;
use App\Models\Group;
use App\Models\Subject;
use App\Models\TeacherSubject;
use App\Models\TeachingLoad;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssignmentTemplatePublishMaterialsTest extends TestCase
{
    use RefreshDatabase;

    public function test_publish_from_bank_copies_materials_to_assignment(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('assignment-template-materials/1/guide.pdf', 'pdf-content');

        $teacher = $this->createTeacher();
        $group = Group::create([
            'name' => 'ИСП-BANK',
            'status' => 'active',
        ]);
        $subject = Subject::create([
            'name' => 'Программирование',
            'code' => 'PRG-' . uniqid(),
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

        $template = AssignmentTemplate::create([
            'teacher_id' => $teacher->id,
            'title' => 'Лабораторная работа',
            'subject_id' => $subject->id,
            'description' => 'Подробное описание лабораторной работы для студентов.',
            'submission_type' => 'file',
            'max_file_size' => 50,
        ]);

        AssignmentTemplateMaterial::create([
            'assignment_template_id' => $template->id,
            'file_name' => 'guide.pdf',
            'file_path' => 'assignment-template-materials/1/guide.pdf',
            'file_size' => '12 KB',
            'file_type' => 'application/pdf',
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->postJson("/api/assignment-bank/{$template->id}/publish", [
            'deadline' => now()->addDays(7)->toDateString(),
            'student_groups' => [$group->name],
        ]);

        $response
            ->assertCreated()
            ->assertJsonCount(1, 'assignment.material_files');

        $this->assertDatabaseHas('assignment_materials', [
            'file_name' => 'guide.pdf',
            'file_path' => 'assignment-template-materials/1/guide.pdf',
        ]);
    }

    private function createTeacher(): User
    {
        return User::create([
            'login' => 'teacher_' . uniqid(),
            'email' => uniqid('teacher_', true) . '@example.com',
            'password' => 'Password1',
            'last_name' => 'Иванов',
            'first_name' => 'Иван',
            'middle_name' => 'Иванович',
            'role' => 'teacher',
            'department' => 'Кафедра информатики',
            'phone' => '+7 (999) 123-45-67',
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }
}
