<?php

namespace Database\Seeders;

use App\Models\SystemLog;
use App\Models\User;
use Illuminate\Database\Seeder;

/** Примеры записей system_logs под демо-сценарии (создание пользователя, действия преподавателя и т.п.). */
class SystemLogSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::whereIn('login', ['Administrator', 'admin'])->orderByDesc('id')->first();
        $teacherJs = User::where('email', 'kartseva@college.ru')->first();
        $teacherPhp = User::where('email', 'karevskiy@college.ru')->first();
        $studentForReturnLog = User::where('login', 'zabiriucenko_ka')->first()
            ?: User::where('role', 'student')->orderBy('id')->first();
        if (!$admin || !$teacherJs || !$teacherPhp || !$studentForReturnLog) {
            return;
        }

        SystemLog::firstOrCreate([
            'user_id' => $admin->id,
            'action' => 'Создание пользователя',
            'details' => 'Создан пользователь ' . $teacherPhp->login . ' с ролью teacher',
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
            'details' => 'Работа "php_crud_v1.zip" возвращена на доработку студенту ' . $studentForReturnLog->login,
        ], [
            'created_at' => now()->subDays(2),
        ]);
    }
}
