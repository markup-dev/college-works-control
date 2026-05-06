<?php

namespace Database\Seeders;

use App\Models\Subject;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        $subjects = [
            ['name' => 'Базы данных', 'status' => 'active'],
            ['name' => 'Веб-программирование', 'status' => 'active'],
            ['name' => 'Тестирование программного обеспечения', 'status' => 'inactive'],
            ['name' => 'PHP-разработка', 'status' => 'active'],
            ['name' => 'Laravel Framework', 'status' => 'active'],
            ['name' => 'Backend API проектирование', 'status' => 'inactive'],
        ];

        foreach ($subjects as $subject) {
            Subject::updateOrCreate(
                ['name' => $subject['name']],
                ['status' => $subject['status']]
            );
        }
    }
}
