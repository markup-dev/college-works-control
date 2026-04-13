<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\Group;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Seeder;

class AssignmentSeeder extends Seeder
{
    public function run(): void
    {
        $teacherJs = User::where('login', 'teacher_kartseva')->first();
        $teacherPhp = User::where('login', 'teacher_karevskiy')->first();
        if (!$teacherJs || !$teacherPhp) {
            return;
        }

        $group029 = Group::firstOrCreate(['name' => 'ИСП-029'], ['teacher_id' => $teacherJs->id, 'status' => 'active']);
        $group0029 = Group::firstOrCreate(['name' => 'ИСП-0029'], ['teacher_id' => $teacherPhp->id, 'status' => 'active']);

        $subjectDb = Subject::firstOrCreate(['name' => 'Базы данных', 'teacher_id' => $teacherJs->id], ['status' => 'active']);
        $subjectWeb = Subject::firstOrCreate(['name' => 'Веб-программирование', 'teacher_id' => $teacherJs->id], ['status' => 'active']);
        $subjectQa = Subject::firstOrCreate(['name' => 'Тестирование программного обеспечения', 'teacher_id' => $teacherJs->id], ['status' => 'inactive']);
        $subjectPhp = Subject::firstOrCreate(['name' => 'PHP-разработка', 'teacher_id' => $teacherPhp->id], ['status' => 'active']);
        $subjectLaravel = Subject::firstOrCreate(['name' => 'Laravel Framework', 'teacher_id' => $teacherPhp->id], ['status' => 'active']);
        $subjectApi = Subject::firstOrCreate(['name' => 'Backend API проектирование', 'teacher_id' => $teacherPhp->id], ['status' => 'inactive']);

        $this->seedAssignment([
            'title' => 'Курсовой проект БД колледжа',
            'subject_id' => $subjectDb->id,
            'teacher_id' => $teacherJs->id,
            'description' => 'Спроектировать структуру БД колледжа, ER-диаграмму и SQL-скрипты.',
            'deadline' => now()->addDays(7)->toDateString(),
            'status' => 'active',
            'priority' => 'high',
            'max_score' => 100,
            'submission_type' => 'file',
            'max_file_size' => 20,
            'group_ids' => [$group029->id],
            'criteria' => [
                ['text' => 'ER-модель и связи', 'max_points' => 35],
                ['text' => 'Нормализация и ограничения', 'max_points' => 35],
                ['text' => 'SQL-скрипты и документация', 'max_points' => 30],
            ],
            'formats' => ['.pdf', '.docx', '.zip'],
        ]);

        $this->seedAssignment([
            'title' => 'SPA на React для расписания',
            'subject_id' => $subjectWeb->id,
            'teacher_id' => $teacherJs->id,
            'description' => 'Реализовать SPA-приложение с фильтрацией расписания и личным кабинетом студента.',
            'deadline' => now()->addDays(12)->toDateString(),
            'status' => 'active',
            'priority' => 'medium',
            'max_score' => 100,
            'submission_type' => 'file',
            'max_file_size' => 50,
            'group_ids' => [$group029->id, $group0029->id],
            'criteria' => [
                ['text' => 'Функциональность интерфейса', 'max_points' => 40],
                ['text' => 'Качество кода и структуры', 'max_points' => 35],
                ['text' => 'UX и адаптивность', 'max_points' => 25],
            ],
            'formats' => ['.zip', '.pdf'],
        ]);

        $this->seedAssignment([
            'title' => 'Тест-план модуля авторизации',
            'subject_id' => $subjectQa->id,
            'teacher_id' => $teacherJs->id,
            'description' => 'Подготовить тест-план и кейсы для backend/frontend авторизации.',
            'deadline' => now()->addDays(18)->toDateString(),
            'status' => 'inactive',
            'priority' => 'low',
            'max_score' => 60,
            'submission_type' => 'file',
            'max_file_size' => 10,
            'group_ids' => [$group029->id],
            'criteria' => [
                ['text' => 'Полнота тест-кейсов', 'max_points' => 30],
                ['text' => 'Качество сценариев', 'max_points' => 30],
            ],
            'formats' => ['.pdf', '.docx'],
        ]);

        $this->seedAssignment([
            'title' => 'CRUD модуль на чистом PHP',
            'subject_id' => $subjectPhp->id,
            'teacher_id' => $teacherPhp->id,
            'description' => 'Разработать CRUD-модуль учета заявок с валидацией и аутентификацией.',
            'deadline' => now()->addDays(5)->toDateString(),
            'status' => 'active',
            'priority' => 'high',
            'max_score' => 100,
            'submission_type' => 'file',
            'max_file_size' => 30,
            'group_ids' => [$group0029->id],
            'criteria' => [
                ['text' => 'Backend-логика и архитектура', 'max_points' => 45],
                ['text' => 'Безопасность и валидация', 'max_points' => 35],
                ['text' => 'Документация', 'max_points' => 20],
            ],
            'formats' => ['.zip', '.pdf'],
        ]);

        $this->seedAssignment([
            'title' => 'REST API на Laravel',
            'subject_id' => $subjectLaravel->id,
            'teacher_id' => $teacherPhp->id,
            'description' => 'Сделать REST API для сущностей студентов и групп с токен-авторизацией.',
            'deadline' => now()->subDays(4)->toDateString(),
            'status' => 'archived',
            'priority' => 'medium',
            'max_score' => 100,
            'submission_type' => 'file',
            'max_file_size' => 25,
            'group_ids' => [$group029->id, $group0029->id],
            'criteria' => [
                ['text' => 'Маршруты и контроллеры', 'max_points' => 40],
                ['text' => 'Валидация и обработка ошибок', 'max_points' => 30],
                ['text' => 'Тесты API', 'max_points' => 30],
            ],
            'formats' => ['.zip', '.pdf', '.docx'],
        ]);

        $this->seedAssignment([
            'title' => 'Проектирование API-контракта',
            'subject_id' => $subjectApi->id,
            'teacher_id' => $teacherPhp->id,
            'description' => 'Подготовить OpenAPI-спецификацию для сервиса учета учебных работ.',
            'deadline' => now()->addDays(20)->toDateString(),
            'status' => 'inactive',
            'priority' => 'low',
            'max_score' => 80,
            'submission_type' => 'file',
            'max_file_size' => 15,
            'group_ids' => [$group0029->id],
            'criteria' => [
                ['text' => 'Полнота спецификации', 'max_points' => 35],
                ['text' => 'Единый стиль контрактов', 'max_points' => 25],
                ['text' => 'Примеры и сценарии ошибок', 'max_points' => 20],
            ],
            'formats' => ['.pdf', '.yaml', '.json'],
        ]);
    }

    private function seedAssignment(array $payload): void
    {
        $assignment = Assignment::updateOrCreate([
            'title' => $payload['title'],
            'subject_id' => $payload['subject_id'],
            'teacher_id' => $payload['teacher_id'],
        ], [
            'description' => $payload['description'],
            'deadline' => $payload['deadline'],
            'status' => $payload['status'],
            'priority' => $payload['priority'],
            'max_score' => $payload['max_score'],
            'submission_type' => $payload['submission_type'],
            'max_file_size' => $payload['max_file_size'] ?? null,
        ]);

        $assignment->groups()->sync($payload['group_ids'] ?? []);
        $assignment->criteriaItems()->delete();
        $assignment->criteriaItems()->createMany(
            collect($payload['criteria'] ?? [])
                ->values()
                ->map(fn ($criterion, $index) => [
                    'position' => $index,
                    'text' => $criterion['text'],
                    'max_points' => $criterion['max_points'],
                ])
                ->all()
        );

        $assignment->allowedFormatItems()->delete();
        $assignment->allowedFormatItems()->createMany(
            collect($payload['formats'] ?? ['.pdf'])
                ->map(fn ($format) => ['format' => $format])
                ->all()
        );
    }
}
