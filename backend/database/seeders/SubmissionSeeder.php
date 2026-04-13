<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Database\Seeder;

class SubmissionSeeder extends Seeder
{
    public function run(): void
    {
        $studentMain = User::where('login', 'st_029_24')->first();
        $studentSecond = User::where('login', 'st_029_01')->first();
        $studentThird = User::where('login', 'st_0029_01')->first();
        if (!$studentMain || !$studentSecond || !$studentThird) {
            return;
        }

        $assignmentDb = Assignment::where('title', 'Курсовой проект БД колледжа')->first();
        $assignmentSpa = Assignment::where('title', 'SPA на React для расписания')->first();
        $assignmentPhp = Assignment::where('title', 'CRUD модуль на чистом PHP')->first();
        $assignmentApi = Assignment::where('title', 'REST API на Laravel')->first();
        if (!$assignmentDb || !$assignmentSpa || !$assignmentPhp || !$assignmentApi) {
            return;
        }

        Submission::updateOrCreate([
            'assignment_id' => $assignmentDb->id,
            'student_id' => $studentMain->id,
        ], [
            'status' => 'submitted',
            'comment' => null,
            'teacher_comment' => null,
            'file_name' => 'db_course_project.pdf',
            'file_path' => 'submissions/db_course_project.pdf',
            'file_size' => '3.2 MB',
            'file_type' => 'application/pdf',
            'submitted_at' => now()->subDays(1),
        ]);

        Submission::updateOrCreate([
            'assignment_id' => $assignmentSpa->id,
            'student_id' => $studentMain->id,
        ], [
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

        Submission::updateOrCreate([
            'assignment_id' => $assignmentPhp->id,
            'student_id' => $studentThird->id,
        ], [
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

        Submission::updateOrCreate([
            'assignment_id' => $assignmentApi->id,
            'student_id' => $studentSecond->id,
        ], [
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
    }
}
