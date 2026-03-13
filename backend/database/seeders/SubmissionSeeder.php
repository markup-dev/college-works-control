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
        $student = User::where('login', 'student_zabiryuchenko')->first();
        $assignments = Assignment::all();

        Submission::create([
            'assignment_id' => $assignments[0]->id,
            'student_id' => $student->id,
            'status' => 'submitted',
            'comment' => 'Прикрепляю курсовую работу по базам данных.',
            'file_name' => 'kursovaya_bd.pdf',
            'file_path' => 'submissions/kursovaya_bd.pdf',
            'file_size' => '2.5 MB',
            'file_type' => 'application/pdf',
        ]);

        Submission::create([
            'assignment_id' => $assignments[1]->id,
            'student_id' => $student->id,
            'status' => 'graded',
            'score' => 85,
            'comment' => 'Отправляю React-приложение.',
            'file_name' => 'react_app.zip',
            'file_path' => 'submissions/react_app.zip',
            'file_size' => '5.1 MB',
            'file_type' => 'application/zip',
        ]);
    }
}
