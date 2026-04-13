<?php

namespace Database\Seeders;

use App\Models\SystemLog;
use App\Models\User;
use Illuminate\Database\Seeder;

class SystemLogSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('login', 'Administrator')->first();
        $teacherJs = User::where('login', 'teacher_kartseva')->first();
        $teacherPhp = User::where('login', 'teacher_karevskiy')->first();
        if (!$admin || !$teacherJs || !$teacherPhp) {
            return;
        }

        SystemLog::firstOrCreate([
            'user_id' => $admin->id,
            'action' => 'Создание пользователя',
            'details' => 'Создан пользователь teacher_karevskiy с ролью teacher',
        ], [
            'created_at' => now()->subDays(5),
        ]);

        SystemLog::firstOrCreate([
            'user_id' => $admin->id,
            'action' => 'Создание группы',
            'details' => 'Создана группа "ИСП-0029" и добавлены студенты',
        ], [
            'created_at' => now()->subDays(4),
        ]);

        SystemLog::firstOrCreate([
            'user_id' => $teacherJs->id,
            'action' => 'Создание задания',
            'details' => 'Создано задание "Курсовой проект БД колледжа"',
        ], [
            'created_at' => now()->subDays(3),
        ]);

        SystemLog::firstOrCreate([
            'user_id' => $teacherPhp->id,
            'action' => 'Проверка работы',
            'details' => 'Работа "php_crud_v1.zip" возвращена на доработку студенту abramov_to',
        ], [
            'created_at' => now()->subDays(2),
        ]);
    }
}
