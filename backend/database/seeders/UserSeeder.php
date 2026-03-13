<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'login' => 'student_zabiryuchenko',
            'email' => 'zabiryuchenko@college.ru',
            'password' => 'Password123',
            'name' => 'Забирюченко Кристина Алексеевна',
            'role' => 'student',
            'group' => 'ИСП-029',
            'phone' => '+7 (999) 111-22-33',
            'timezone' => 'UTC+3',
            'notifications' => ['email' => true, 'push' => true, 'sms' => false],
            'theme' => 'system',
            'bio' => 'Студентка 4 курса, интересы — веб-разработка и дизайн.',
            'is_active' => true,
            'teacher_login' => 'teacher_kartseva',
        ]);

        User::create([
            'login' => 'teacher_kartseva',
            'email' => 'kartseva@college.ru',
            'password' => 'Password123',
            'name' => 'Карцева Мария Сергеевна',
            'role' => 'teacher',
            'department' => 'JS-разработка',
            'phone' => '+7 (999) 444-55-66',
            'timezone' => 'UTC+3',
            'notifications' => ['email' => true, 'push' => true, 'sms' => true],
            'theme' => 'system',
            'bio' => 'Преподаватель дисциплин по JavaScript',
            'is_active' => true,
        ]);

        User::create([
            'login' => 'admin_sidorov',
            'email' => 'sidorov@college.ru',
            'password' => 'Password123',
            'name' => 'Сидоров Андрей Васильевич',
            'role' => 'admin',
            'phone' => '+7 (999) 777-88-99',
            'timezone' => 'UTC+3',
            'notifications' => ['email' => true, 'push' => false, 'sms' => false],
            'theme' => 'system',
            'bio' => 'Администратор платформы, отвечает за безопасность и доступы.',
            'is_active' => true,
        ]);
    }
}
