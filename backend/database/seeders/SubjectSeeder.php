<?php

namespace Database\Seeders;

use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        $teacherJs = User::where('login', 'teacher_kartseva')->first();
        $teacherPhp = User::where('login', 'teacher_karevskiy')->first();
        if (!$teacherJs || !$teacherPhp) {
            return;
        }

        $subjects = [
            ['name' => 'Базы данных', 'teacher_id' => $teacherJs->id, 'status' => 'active'],
            ['name' => 'Веб-программирование', 'teacher_id' => $teacherJs->id, 'status' => 'active'],
            ['name' => 'Тестирование программного обеспечения', 'teacher_id' => $teacherJs->id, 'status' => 'inactive'],
            ['name' => 'PHP-разработка', 'teacher_id' => $teacherPhp->id, 'status' => 'active'],
            ['name' => 'Laravel Framework', 'teacher_id' => $teacherPhp->id, 'status' => 'active'],
            ['name' => 'Backend API проектирование', 'teacher_id' => $teacherPhp->id, 'status' => 'inactive'],
        ];

        foreach ($subjects as $subject) {
            Subject::updateOrCreate(
                ['name' => $subject['name'], 'teacher_id' => $subject['teacher_id']],
                ['status' => $subject['status']]
            );
        }
    }
}
