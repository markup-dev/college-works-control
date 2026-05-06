<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\Group;
use App\Models\Subject;
use App\Models\TeachingLoad;
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

        $group029 = Group::firstOrCreate(['name' => 'ИСП-029'], ['status' => 'active']);
        $group0029 = Group::firstOrCreate(['name' => 'ИСП-0029'], ['status' => 'active']);

        $subjectDb = Subject::where('name', 'Базы данных')
            ->where('status', 'active')
            ->first();
        $subjectWeb = Subject::where('name', 'Веб-программирование')
            ->where('status', 'active')
            ->first();
        $subjectPhp = Subject::where('name', 'PHP-разработка')
            ->where('status', 'active')
            ->first();
        $subjectLaravel = Subject::where('name', 'Laravel Framework')
            ->where('status', 'active')
            ->first();

        if (!$subjectDb || !$subjectWeb || !$subjectPhp || !$subjectLaravel) {
            return;
        }

        collect([
            [$teacherJs->id, $subjectDb->id, $group029->id],
            [$teacherJs->id, $subjectDb->id, $group0029->id],
            [$teacherJs->id, $subjectWeb->id, $group029->id],
            [$teacherJs->id, $subjectWeb->id, $group0029->id],
            [$teacherPhp->id, $subjectPhp->id, $group029->id],
            [$teacherPhp->id, $subjectPhp->id, $group0029->id],
            [$teacherPhp->id, $subjectLaravel->id, $group029->id],
            [$teacherPhp->id, $subjectLaravel->id, $group0029->id],
        ])->each(fn ($load) => TeachingLoad::firstOrCreate([
            'teacher_id' => $load[0],
            'subject_id' => $load[1],
            'group_id' => $load[2],
        ], ['status' => 'active']));

        $assignments = [
            // Kartseva - ACTIVE
            [
                'title' => 'Курсовой проект БД колледжа',
                'subject_id' => $subjectDb->id,
                'teacher_id' => $teacherJs->id,
                'description' => 'Спроектировать структуру БД колледжа, ER-диаграмму и SQL-скрипты.',
                'deadline' => now()->addDays(2)->toDateString(),
                'status' => 'active',
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
            ],
            [
                'title' => 'SPA на React для расписания',
                'subject_id' => $subjectWeb->id,
                'teacher_id' => $teacherJs->id,
                'description' => 'Реализовать SPA-приложение с фильтрацией расписания и личным кабинетом студента.',
                'deadline' => now()->addDays(12)->toDateString(),
                'status' => 'active',
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
            ],
            [
                'title' => 'Оптимизация SQL-запросов и индексов',
                'subject_id' => $subjectDb->id,
                'teacher_id' => $teacherJs->id,
                'description' => 'Проанализировать медленные запросы и предложить схему индексации.',
                'deadline' => now()->addDays(1)->toDateString(),
                'status' => 'active',
                'max_score' => 100,
                'submission_type' => 'file',
                'max_file_size' => 15,
                'group_ids' => [$group029->id],
                'criteria' => [
                    ['text' => 'Профилирование запросов', 'max_points' => 30],
                    ['text' => 'Обоснование индексов', 'max_points' => 30],
                    ['text' => 'Итоговый отчет', 'max_points' => 30],
                ],
                'formats' => ['.pdf', '.docx'],
            ],
            // Kartseva - INACTIVE
            [
                'title' => 'Рефакторинг клиентской архитектуры',
                'subject_id' => $subjectWeb->id,
                'teacher_id' => $teacherJs->id,
                'description' => 'Подготовить план рефакторинга React-приложения с выделением слоев.',
                'deadline' => now()->addDays(21)->toDateString(),
                'status' => 'inactive',
                'max_score' => 100,
                'submission_type' => 'file',
                'max_file_size' => 10,
                'group_ids' => [$group029->id],
                'criteria' => [
                    ['text' => 'Декомпозиция модулей', 'max_points' => 30],
                    ['text' => 'План миграции', 'max_points' => 25],
                    ['text' => 'Оценка рисков', 'max_points' => 25],
                ],
                'formats' => ['.pdf', '.docx'],
            ],
            [
                'title' => 'Валидация данных в web-формах',
                'subject_id' => $subjectWeb->id,
                'teacher_id' => $teacherJs->id,
                'description' => 'Реализовать клиентскую и серверную валидацию для типовых форм.',
                'deadline' => now()->addDays(24)->toDateString(),
                'status' => 'inactive',
                'max_score' => 100,
                'submission_type' => 'file',
                'max_file_size' => 10,
                'group_ids' => [$group0029->id],
                'criteria' => [
                    ['text' => 'Покрытие кейсов', 'max_points' => 25],
                    ['text' => 'Качество ошибок и UX', 'max_points' => 25],
                    ['text' => 'Чистота кода', 'max_points' => 20],
                ],
                'formats' => ['.pdf', '.zip'],
            ],
            // Kartseva - ARCHIVED
            [
                'title' => 'Нормализация учебной базы данных',
                'subject_id' => $subjectDb->id,
                'teacher_id' => $teacherJs->id,
                'description' => 'Привести схему БД к 3НФ и описать принятые решения.',
                'deadline' => now()->subDays(10)->toDateString(),
                'status' => 'archived',
                'max_score' => 100,
                'submission_type' => 'file',
                'max_file_size' => 20,
                'group_ids' => [$group029->id, $group0029->id],
                'criteria' => [
                    ['text' => 'Корректность нормализации', 'max_points' => 40],
                    ['text' => 'Обоснование решений', 'max_points' => 30],
                    ['text' => 'Оформление отчета', 'max_points' => 30],
                ],
                'formats' => ['.pdf', '.docx'],
            ],
            // Karevskiy - ACTIVE
            [
                'title' => 'CRUD модуль на чистом PHP',
                'subject_id' => $subjectPhp->id,
                'teacher_id' => $teacherPhp->id,
                'description' => 'Разработать CRUD-модуль учета заявок с валидацией и аутентификацией.',
                'deadline' => now()->addDays(2)->toDateString(),
                'status' => 'active',
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
            ],
            [
                'title' => 'Миграции и сидеры Laravel',
                'subject_id' => $subjectLaravel->id,
                'teacher_id' => $teacherPhp->id,
                'description' => 'Собрать полный набор миграций и сидеров для учебного проекта.',
                'deadline' => now()->addDays(14)->toDateString(),
                'status' => 'active',
                'max_score' => 100,
                'submission_type' => 'file',
                'max_file_size' => 20,
                'group_ids' => [$group029->id, $group0029->id],
                'criteria' => [
                    ['text' => 'Корректность схемы БД', 'max_points' => 35],
                    ['text' => 'Качество сидеров', 'max_points' => 30],
                    ['text' => 'Идемпотентность', 'max_points' => 30],
                ],
                'formats' => ['.zip', '.sql', '.pdf'],
            ],
            [
                'title' => 'Очереди и фоновые задачи',
                'subject_id' => $subjectPhp->id,
                'teacher_id' => $teacherPhp->id,
                'description' => 'Реализовать очередь уведомлений и мониторинг фоновых задач.',
                'deadline' => now()->addDays(1)->toDateString(),
                'status' => 'active',
                'max_score' => 100,
                'submission_type' => 'file',
                'max_file_size' => 20,
                'group_ids' => [$group0029->id],
                'criteria' => [
                    ['text' => 'Настройка очередей', 'max_points' => 30],
                    ['text' => 'Обработка ошибок', 'max_points' => 30],
                    ['text' => 'Логи и мониторинг', 'max_points' => 25],
                ],
                'formats' => ['.zip', '.pdf'],
            ],
            // Karevskiy - INACTIVE
            [
                'title' => 'Паттерны проектирования в PHP',
                'subject_id' => $subjectPhp->id,
                'teacher_id' => $teacherPhp->id,
                'description' => 'Применить ключевые паттерны в модуле управления заданиями.',
                'deadline' => now()->addDays(26)->toDateString(),
                'status' => 'inactive',
                'max_score' => 100,
                'submission_type' => 'file',
                'max_file_size' => 10,
                'group_ids' => [$group029->id],
                'criteria' => [
                    ['text' => 'Выбор паттернов', 'max_points' => 25],
                    ['text' => 'Качество реализации', 'max_points' => 30],
                    ['text' => 'Пояснительная записка', 'max_points' => 20],
                ],
                'formats' => ['.pdf', '.zip'],
            ],
            [
                'title' => 'Unit-тесты для сервисного слоя',
                'subject_id' => $subjectLaravel->id,
                'teacher_id' => $teacherPhp->id,
                'description' => 'Покрыть unit-тестами основной сервисный слой проекта.',
                'deadline' => now()->addDays(28)->toDateString(),
                'status' => 'inactive',
                'max_score' => 100,
                'submission_type' => 'file',
                'max_file_size' => 15,
                'group_ids' => [$group029->id, $group0029->id],
                'criteria' => [
                    ['text' => 'Покрытие тестами', 'max_points' => 35],
                    ['text' => 'Качество сценариев', 'max_points' => 25],
                    ['text' => 'Читаемость кода', 'max_points' => 20],
                ],
                'formats' => ['.zip', '.pdf'],
            ],
            // Karevskiy - ARCHIVED
            [
                'title' => 'REST API на Laravel',
                'subject_id' => $subjectLaravel->id,
                'teacher_id' => $teacherPhp->id,
                'description' => 'Сделать REST API для сущностей студентов и групп с токен-авторизацией.',
                'deadline' => now()->subDays(4)->toDateString(),
                'status' => 'archived',
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
            ],
            [
                'title' => 'Авторизация и роли в Laravel',
                'subject_id' => $subjectLaravel->id,
                'teacher_id' => $teacherPhp->id,
                'description' => 'Реализовать ролевую модель и ограничение доступа к API.',
                'deadline' => now()->subDays(15)->toDateString(),
                'status' => 'archived',
                'max_score' => 100,
                'submission_type' => 'file',
                'max_file_size' => 20,
                'group_ids' => [$group0029->id],
                'criteria' => [
                    ['text' => 'Корректность прав доступа', 'max_points' => 35],
                    ['text' => 'Безопасность токенов', 'max_points' => 30],
                    ['text' => 'Пояснения и примеры', 'max_points' => 25],
                ],
                'formats' => ['.zip', '.pdf'],
            ],
        ];

        foreach ($assignments as $assignmentPayload) {
            $this->seedAssignment($assignmentPayload);
        }
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
            'max_score' => 100,
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
