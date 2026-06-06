<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/** Точка входа: демо-данные в порядке зависимостей (дисциплины → программы → группы/пользователи → допуски → задания). */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            SubjectSeeder::class,
            SpecialtySeeder::class,
            UserSeeder::class,
            TeacherPermissionSeeder::class,
            AssignmentSeeder::class,
            SubmissionSeeder::class,
            SystemLogSeeder::class,
        ]);
    }
}
