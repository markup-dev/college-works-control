<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/** Точка входа: демо-данные в порядке зависимостей (пользователи → предметы → задания → сдачи → логи). */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            SubjectSeeder::class,
            AssignmentSeeder::class,
            SubmissionSeeder::class,
            SystemLogSeeder::class,
        ]);
    }
}
