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

class StudentAssignmentVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_archived_assignment_without_student_result_is_hidden_from_student_list(): void
    {
        [$student, $teacher, $group, $subject] = $this->createUsersAndSubject();
        $activeOverdue = $this->createAssignment($teacher, $subject, $group, [
            'title' => 'Активная просрочка',
            'status' => 'active',
            'deadline' => now()->subDays(5)->toDateString(),
        ]);
        $archivedWithoutResult = $this->createAssignment($teacher, $subject, $group, [
            'title' => 'Архив без результата',
            'status' => 'archived',
            'deadline' => now()->subDays(10)->toDateString(),
        ]);

        Sanctum::actingAs($student);

        $response = $this->getJson('/api/assignments?per_page=20');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();

        $this->assertContains($activeOverdue->id, $ids);
        $this->assertNotContains($archivedWithoutResult->id, $ids);
        $this->assertSame(1, $response->json('meta.counts.all'));
        $this->assertSame(1, $response->json('meta.counts.not_submitted'));
    }

    public function test_archived_assignment_with_graded_result_is_visible_in_graded_filter(): void
    {
        [$student, $teacher, $group, $subject] = $this->createUsersAndSubject();
        $assignment = $this->createAssignment($teacher, $subject, $group, [
            'title' => 'Архив с оценкой',
            'status' => 'archived',
            'deadline' => now()->subDays(10)->toDateString(),
        ]);

        Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $student->id,
            'status' => 'graded',
            'score' => 95,
            'file_name' => 'work.pdf',
            'file_path' => 'submissions/work.pdf',
            'file_size' => '120 KB',
            'file_type' => 'application/pdf',
            'submitted_at' => now()->subDays(2),
        ]);

        Sanctum::actingAs($student);

        $response = $this->getJson('/api/assignments?status=graded&per_page=20');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $assignment->id)
            ->assertJsonPath('data.0.status', 'graded')
            ->assertJsonPath('meta.counts.graded', 1);
    }

    public function test_student_status_counts_respect_subject_filter(): void
    {
        [$student, $teacher, $group, $subject] = $this->createUsersAndSubject();
        $otherSubject = Subject::create([
            'name' => 'Другая дисциплина',
            'code' => 'OTHER-' . uniqid(),
            'status' => 'active',
        ]);

        $targetNotSubmitted = $this->createAssignment($teacher, $subject, $group, [
            'title' => 'Не сдано по выбранной дисциплине',
            'status' => 'active',
        ]);
        $targetSubmitted = $this->createAssignment($teacher, $subject, $group, [
            'title' => 'На проверке по выбранной дисциплине',
            'status' => 'active',
        ]);
        $otherAssignment = $this->createAssignment($teacher, $otherSubject, $group, [
            'title' => 'Задание другой дисциплины',
            'status' => 'active',
        ]);

        Submission::create([
            'assignment_id' => $targetSubmitted->id,
            'student_id' => $student->id,
            'status' => 'submitted',
            'file_name' => 'selected.pdf',
            'file_path' => 'submissions/selected.pdf',
            'file_size' => '120 KB',
            'file_type' => 'application/pdf',
            'submitted_at' => now(),
        ]);
        Submission::create([
            'assignment_id' => $otherAssignment->id,
            'student_id' => $student->id,
            'status' => 'graded',
            'score' => 90,
            'file_name' => 'other.pdf',
            'file_path' => 'submissions/other.pdf',
            'file_size' => '120 KB',
            'file_type' => 'application/pdf',
            'submitted_at' => now(),
        ]);

        Sanctum::actingAs($student);

        $response = $this->getJson('/api/assignments?subject_id='.$subject->id.'&per_page=20');

        $response
            ->assertOk()
            ->assertJsonPath('meta.counts.all', 2)
            ->assertJsonPath('meta.counts.not_submitted', 1)
            ->assertJsonPath('meta.counts.submitted', 1)
            ->assertJsonPath('meta.counts.graded', 0);

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($targetNotSubmitted->id, $ids);
        $this->assertContains($targetSubmitted->id, $ids);
        $this->assertNotContains($otherAssignment->id, $ids);
    }

    private function createUsersAndSubject(): array
    {
        $group = Group::create([
            'name' => 'Тест-' . uniqid(),
            'status' => 'active',
        ]);
        $teacher = User::create([
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
        $student = User::create([
            'login' => 'student_' . uniqid(),
            'email' => uniqid('student_', true) . '@example.com',
            'password' => 'Password1',
            'last_name' => 'Петров',
            'first_name' => 'Пётр',
            'middle_name' => 'Петрович',
            'role' => 'student',
            'group_id' => $group->id,
            'phone' => '+7 (999) 123-45-67',
            'is_active' => true,
            'must_change_password' => false,
        ]);
        $subject = Subject::create([
            'name' => 'Тестовая дисциплина',
            'code' => 'TST-' . uniqid(),
            'status' => 'active',
        ]);

        return [$student, $teacher, $group, $subject];
    }

    private function createAssignment(User $teacher, Subject $subject, Group $group, array $overrides = []): Assignment
    {
        $assignment = Assignment::create([
            'title' => $overrides['title'] ?? 'Тестовое задание',
            'subject_id' => $subject->id,
            'description' => 'Описание тестового задания для проверки списка студента.',
            'deadline' => $overrides['deadline'] ?? now()->addDays(7)->toDateString(),
            'status' => $overrides['status'] ?? 'active',
            'max_score' => 100,
            'submission_type' => 'file',
            'max_file_size' => 50,
            'teacher_id' => $teacher->id,
        ]);
        $assignment->groups()->attach($group->id);

        return $assignment;
    }
}
