<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentTemplate;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssignmentTemplateFromAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_assignment_with_criteria_is_copied_to_bank_template(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('assignment-materials/task-material.pdf', 'pdf-content');

        $teacher = $this->createTeacher();
        $assignment = $this->createAssignmentWithCriteria($teacher);

        Sanctum::actingAs($teacher);

        $response = $this->postJson("/api/assignment-bank/from-assignment/{$assignment->id}");

        $response
            ->assertCreated()
            ->assertJsonPath('created', true)
            ->assertJsonCount(3, 'template.criteria')
            ->assertJsonCount(1, 'template.material_files');

        $this->assertDatabaseHas('assignment_template_criteria', [
            'text' => 'Качество реализации',
            'max_points' => 40,
        ]);
        $this->assertDatabaseHas('assignment_template_materials', [
            'file_name' => 'task-material.pdf',
        ]);

        $templatePath = AssignmentTemplate::query()->first()?->materialItems()->value('file_path');
        $this->assertNotSame('assignment-materials/task-material.pdf', $templatePath);
        $this->assertStringStartsWith('assignment-template-materials/', (string) $templatePath);
        Storage::disk('public')->assertExists((string) $templatePath);
    }

    public function test_existing_bank_template_is_refreshed_from_assignment_criteria(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('assignment-materials/task-material.pdf', 'pdf-content');

        $teacher = $this->createTeacher();
        $assignment = $this->createAssignmentWithCriteria($teacher);

        $template = AssignmentTemplate::create([
            'teacher_id' => $teacher->id,
            'source_assignment_id' => $assignment->id,
            'title' => 'Старая версия',
            'subject_id' => $assignment->subject_id,
            'description' => 'Без критериев',
            'submission_type' => 'file',
            'max_file_size' => 50,
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->postJson("/api/assignment-bank/from-assignment/{$assignment->id}");

        $response
            ->assertOk()
            ->assertJsonPath('created', false)
            ->assertJsonCount(3, 'template.criteria')
            ->assertJsonCount(1, 'template.material_files')
            ->assertJsonPath('template.title', $assignment->title);

        $this->assertSame(1, AssignmentTemplate::query()->where('source_assignment_id', $assignment->id)->count());
        $this->assertSame(3, $template->criteriaItems()->count());
        $this->assertSame(1, $template->materialItems()->count());
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

    private function createAssignmentWithCriteria(User $teacher): Assignment
    {
        $subject = Subject::create([
            'name' => 'Веб-программирование',
            'code' => 'WEB-' . uniqid(),
            'status' => 'active',
        ]);

        $assignment = Assignment::create([
            'title' => 'Проект с критериями',
            'subject_id' => $subject->id,
            'description' => 'Подготовить учебный проект с отчётом и исходным кодом.',
            'deadline' => now()->addWeek()->toDateString(),
            'status' => 'active',
            'max_score' => 100,
            'submission_type' => 'file',
            'max_file_size' => 50,
            'teacher_id' => $teacher->id,
        ]);

        $assignment->criteriaItems()->createMany([
            ['position' => 0, 'text' => 'Функциональность', 'max_points' => 35],
            ['position' => 1, 'text' => 'Качество реализации', 'max_points' => 40],
            ['position' => 2, 'text' => 'Оформление', 'max_points' => 25],
        ]);
        $assignment->allowedFormatItems()->createMany([
            ['format' => '.zip'],
            ['format' => '.pdf'],
        ]);
        $assignment->materialItems()->create([
            'file_name' => 'task-material.pdf',
            'file_path' => 'assignment-materials/task-material.pdf',
            'file_size' => '128 KB',
            'file_type' => 'application/pdf',
        ]);

        return $assignment;
    }
}
