<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\User;
use Illuminate\Database\Seeder;

class AssignmentSeeder extends Seeder
{
    public function run(): void
    {
        $teacher = User::where('login', 'teacher_kartseva')->first();

        Assignment::create([
            'title' => 'Курсовая работа по базам данных',
            'course' => 'Базы данных',
            'description' => 'Разработка схемы БД для информационной системы колледжа.',
            'deadline' => '2025-12-25',
            'status' => 'active',
            'priority' => 'high',
            'max_score' => 100,
            'submission_type' => 'file',
            'criteria' => [
                'Качество проектирования БД - 40 баллов',
                'Нормализация - 30 баллов',
                'Документация - 30 баллов',
            ],
            'student_groups' => ['ИСП-029'],
            'teacher_id' => $teacher->id,
        ]);

        Assignment::create([
            'title' => 'React приложение',
            'course' => 'Веб-программирование',
            'description' => 'Разработка клиентской части системы контроля учебных работ.',
            'deadline' => '2025-12-20',
            'status' => 'active',
            'priority' => 'medium',
            'max_score' => 100,
            'submission_type' => 'file',
            'criteria' => [
                'Функциональность - 40 баллов',
                'Интерфейс - 30 баллов',
                'Код - 30 баллов',
            ],
            'student_groups' => ['ИСП-029'],
            'teacher_id' => $teacher->id,
        ]);

        Assignment::create([
            'title' => 'Тестирование ПО',
            'course' => 'Тестирование программного обеспечения',
            'description' => 'Написание тестов для модуля аутентификации.',
            'deadline' => '2025-12-18',
            'status' => 'active',
            'priority' => 'low',
            'max_score' => 100,
            'submission_type' => 'file',
            'criteria' => [
                'Покрытие кода - 50 баллов',
                'Качество тестов - 50 баллов',
            ],
            'student_groups' => ['ИСП-029'],
            'teacher_id' => $teacher->id,
        ]);
    }
}
