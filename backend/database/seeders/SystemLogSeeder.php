<?php

namespace Database\Seeders;

use App\Models\SystemLog;
use App\Models\User;
use Illuminate\Database\Seeder;

class SystemLogSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('login', 'admin_sidorov')->first();
        $teacher = User::where('login', 'teacher_kartseva')->first();

        SystemLog::create([
            'user_id' => $admin->id,
            'user_login' => $admin->login,
            'user_role' => 'admin',
            'action' => 'Создание пользователя',
            'details' => 'Создан пользователь teacher_kartseva с ролью teacher',
            'created_at' => now()->subDays(5),
        ]);

        SystemLog::create([
            'user_id' => $admin->id,
            'user_login' => $admin->login,
            'user_role' => 'admin',
            'action' => 'Создание курса',
            'details' => 'Создан курс "Базы данных"',
            'created_at' => now()->subDays(4),
        ]);

        SystemLog::create([
            'user_id' => $teacher->id,
            'user_login' => $teacher->login,
            'user_role' => 'teacher',
            'action' => 'Создание задания',
            'details' => 'Создано задание "Курсовая работа по базам данных"',
            'created_at' => now()->subDays(3),
        ]);
    }
}
