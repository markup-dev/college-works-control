<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\Group;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Database\Seeder;

/** Демо-сдачи с разными статусами (в т.ч. пересдачи) для отчётов и списков проверки. */
class SubmissionSeeder extends Seeder
{
    public function run(): void
    {
        $group029 = Group::where('name', 'ИСП-029')->first();
        $group0029 = Group::where('name', 'ИСП-0029')->first();
        if (!$group029 || !$group0029) {
            return;
        }

        $students029 = User::where('role', 'student')->where('group_id', $group029->id)->orderBy('id')->get();
        $students0029 = User::where('role', 'student')->where('group_id', $group0029->id)->orderBy('id')->get();

        $studentMain = User::where('login', 'zabiriucenko_ka')->first() ?: $students029->first();
        $studentSecond = $students029->skip(1)->first() ?: $students029->first();
        $studentThird = $students0029->first();
        if (!$studentMain || !$studentSecond || !$studentThird) {
            return;
        }

        $requiredTitles = [
            'Курсовой проект БД колледжа',
            'SPA на React для расписания',
            'CRUD модуль на чистом PHP',
            'REST API на Laravel',
            'Очереди и фоновые задачи',
            'Миграции и сидеры Laravel',
        ];
        $assignmentsByTitle = Assignment::whereIn('title', $requiredTitles)
            ->get()
            ->keyBy('title');
        if ($assignmentsByTitle->isEmpty()) {
            return;
        }

        $this->seedIfAssignmentExists($assignmentsByTitle->get('Курсовой проект БД колледжа'), $studentMain->id, [
            'status' => 'submitted',
            'comment' => null,
            'teacher_comment' => null,
            'file_name' => 'db_course_project.pdf',
            'file_path' => 'submissions/db_course_project.pdf',
            'file_size' => '3.2 MB',
            'file_type' => 'application/pdf',
            'submitted_at' => now()->subDays(1),
        ]);

        $this->seedIfAssignmentExists($assignmentsByTitle->get('SPA на React для расписания'), $studentMain->id, [
            'status' => 'graded',
            'score' => 92,
            'comment' => null,
            'teacher_comment' => 'Отличная работа, добавить проверку граничных кейсов.',
            'file_name' => 'spa_schedule.zip',
            'file_path' => 'submissions/spa_schedule.zip',
            'file_size' => '7.8 MB',
            'file_type' => 'application/zip',
            'submitted_at' => now()->subDays(3),
        ]);

        $this->seedIfAssignmentExists($assignmentsByTitle->get('CRUD модуль на чистом PHP'), $studentThird->id, [
            'status' => 'returned',
            'score' => null,
            'comment' => null,
            'teacher_comment' => 'Нужно доработать валидацию и защиту от SQL-инъекций.',
            'file_name' => 'php_crud_v1.zip',
            'file_path' => 'submissions/php_crud_v1.zip',
            'file_size' => '4.9 MB',
            'file_type' => 'application/zip',
            'submitted_at' => now()->subDays(2),
            'is_resubmission' => false,
        ]);

        $this->seedIfAssignmentExists($assignmentsByTitle->get('REST API на Laravel'), $studentSecond->id, [
            'status' => 'graded',
            'score' => 88,
            'comment' => null,
            'teacher_comment' => 'API контракт хороший, дополните примеры 422 ответов.',
            'file_name' => 'laravel_api_project.zip',
            'file_path' => 'submissions/laravel_api_project.zip',
            'file_size' => '6.3 MB',
            'file_type' => 'application/zip',
            'submitted_at' => now()->subDays(6),
            'is_resubmission' => true,
        ]);

        $this->seedIfAssignmentExists($assignmentsByTitle->get('Очереди и фоновые задачи'), $studentThird->id, [
            'status' => 'submitted',
            'score' => null,
            'comment' => null,
            'teacher_comment' => null,
            'file_name' => 'queues_background_tasks.zip',
            'file_path' => 'submissions/queues_background_tasks.zip',
            'file_size' => '5.7 MB',
            'file_type' => 'application/zip',
            'submitted_at' => now()->subHours(8),
            'is_resubmission' => false,
        ]);

        $this->seedIfAssignmentExists($assignmentsByTitle->get('Миграции и сидеры Laravel'), $studentMain->id, [
            'status' => 'submitted',
            'score' => null,
            'comment' => null,
            'teacher_comment' => null,
            'file_name' => 'laravel_migrations_seeders.zip',
            'file_path' => 'submissions/laravel_migrations_seeders.zip',
            'file_size' => '6.1 MB',
            'file_type' => 'application/zip',
            'submitted_at' => now()->subHours(2),
            'is_resubmission' => false,
        ]);
    }

    private function seedIfAssignmentExists(?Assignment $assignment, int $studentId, array $payload): void
    {
        if (!$assignment) {
            return;
        }

        Submission::updateOrCreate([
            'assignment_id' => $assignment->id,
            'student_id' => $studentId,
        ], $payload);
    }
}
