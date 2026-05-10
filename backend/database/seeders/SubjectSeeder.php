<?php

namespace Database\Seeders;

use App\Models\Subject;
use Illuminate\Database\Seeder;

/** Набор дисциплин с кодами для демонстрации фильтров и привязки к заданиям. */
class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        $subjects = [
            ['name' => 'Базы данных', 'code' => 'БД-301', 'status' => 'active'],
            ['name' => 'Веб-программирование', 'code' => 'WEB-201', 'status' => 'active'],
            ['name' => 'Тестирование программного обеспечения', 'code' => 'ТПО-102', 'status' => 'inactive'],
            ['name' => 'PHP-разработка', 'code' => 'PHP-205', 'status' => 'active'],
            ['name' => 'Laravel Framework', 'code' => 'LRV-310', 'status' => 'active'],
            ['name' => 'Backend API проектирование', 'code' => 'API-401', 'status' => 'inactive'],
        ];

        foreach ($subjects as $subject) {
            Subject::updateOrCreate(
                ['code' => $subject['code']],
                [
                    'name' => $subject['name'],
                    'status' => $subject['status'],
                ]
            );
        }
    }
}
