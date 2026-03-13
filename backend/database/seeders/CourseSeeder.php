<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\User;
use Illuminate\Database\Seeder;

class CourseSeeder extends Seeder
{
    public function run(): void
    {
        $teacher = User::where('login', 'teacher_kartseva')->first();

        Course::create([
            'name' => 'Базы данных',
            'teacher_id' => $teacher->id,
            'students_count' => 25,
            'status' => 'active',
        ]);

        Course::create([
            'name' => 'Веб-программирование',
            'teacher_id' => $teacher->id,
            'students_count' => 28,
            'status' => 'active',
        ]);

        Course::create([
            'name' => 'Тестирование программного обеспечения',
            'teacher_id' => $teacher->id,
            'students_count' => 22,
            'status' => 'active',
        ]);
    }
}
