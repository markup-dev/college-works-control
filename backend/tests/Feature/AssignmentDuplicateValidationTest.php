<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentTemplate;
use App\Models\Group;
use App\Models\Subject;
use App\Models\TeacherSubject;
use App\Models\TeachingLoad;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssignmentDuplicateValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_create_rejects_duplicate_for_same_group_and_deadline(): void
    {
        [$teacher, $group, $subject, $deadline] = $this->seedTeacherWithGroupAndSubject();
        $this->createAssignment($teacher, $group, $subject, $deadline, 'Лабораторная работа №1');

        Sanctum::actingAs($teacher);

        $response = $this->postJson('/api/assignments', [
            'title' => 'Лабораторная работа №1',
            'subject_id' => $subject->id,
            'description' => 'Повторная выдача того же задания на ту же дату.',
            'deadline' => $deadline,
            'student_groups' => [$group->name],
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['student_groups']);

        $this->assertSame(1, Assignment::query()->count());
    }

    public function test_manual_create_allows_same_title_for_different_deadline(): void
    {
        [$teacher, $group, $subject, $deadline] = $this->seedTeacherWithGroupAndSubject();
        $this->createAssignment($teacher, $group, $subject, $deadline, 'Лабораторная работа №1');

        Sanctum::actingAs($teacher);

        $response = $this->postJson('/api/assignments', [
            'title' => 'Лабораторная работа №1',
            'subject_id' => $subject->id,
            'description' => 'Та же тема, но другой срок сдачи.',
            'deadline' => now()->addDays(14)->toDateString(),
            'student_groups' => [$group->name],
        ]);

        $response->assertCreated();
        $this->assertSame(2, Assignment::query()->count());
    }

    public function test_bank_publish_rejects_duplicate_for_same_group_and_deadline(): void
    {
        [$teacher, $group, $subject, $deadline] = $this->seedTeacherWithGroupAndSubject();
        $this->createAssignment($teacher, $group, $subject, $deadline, 'Курсовой проект');

        $template = AssignmentTemplate::create([
            'teacher_id' => $teacher->id,
            'title' => 'Курсовой проект',
            'subject_id' => $subject->id,
            'description' => 'Подготовить курсовой проект по теме дисциплины.',
            'submission_type' => 'file',
            'max_file_size' => 50,
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->postJson("/api/assignment-bank/{$template->id}/publish", [
            'deadline' => $deadline,
            'student_groups' => [$group->name],
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['student_groups']);

        $this->assertSame(1, Assignment::query()->count());
    }

    public function test_bank_publish_allows_same_template_for_different_deadline(): void
    {
        [$teacher, $group, $subject, $deadline] = $this->seedTeacherWithGroupAndSubject();
        $this->createAssignment($teacher, $group, $subject, $deadline, 'Курсовой проект');

        $template = AssignmentTemplate::create([
            'teacher_id' => $teacher->id,
            'title' => 'Курсовой проект',
            'subject_id' => $subject->id,
            'description' => 'Подготовить курсовой проект по теме дисциплины.',
            'submission_type' => 'file',
            'max_file_size' => 50,
        ]);

        Sanctum::actingAs($teacher);

        $response = $this->postJson("/api/assignment-bank/{$template->id}/publish", [
            'deadline' => now()->addDays(21)->toDateString(),
            'student_groups' => [$group->name],
        ]);

        $response->assertCreated();
        $this->assertSame(2, Assignment::query()->count());
    }

    /**
     * @return array{0: User, 1: Group, 2: Subject, 3: string}
     */
    private function seedTeacherWithGroupAndSubject(): array
    {
        $teacher = $this->createTeacher();
        $group = Group::create([
            'name' => 'ИСП-DUP',
            'status' => 'active',
        ]);
        $subject = Subject::create([
            'name' => 'Программирование',
            'code' => 'PRG-' . uniqid(),
            'status' => 'active',
        ]);
        $deadline = now()->addDays(7)->toDateString();

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

        return [$teacher, $group, $subject, $deadline];
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

    private function createAssignment(User $teacher, Group $group, Subject $subject, string $deadline, string $title): Assignment
    {
        $assignment = Assignment::create([
            'title' => $title,
            'subject_id' => $subject->id,
            'description' => 'Описание задания для проверки дубликатов.',
            'deadline' => $deadline,
            'status' => 'active',
            'max_score' => 100,
            'submission_type' => 'file',
            'max_file_size' => 50,
            'teacher_id' => $teacher->id,
        ]);
        $assignment->groups()->sync([$group->id]);

        return $assignment;
    }
}
