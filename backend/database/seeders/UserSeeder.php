<?php

namespace Database\Seeders;

use App\Models\Group;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $teacherJs = $this->upsertUser([
            'login' => 'teacher_kartseva',
            'email' => 'kartseva@college.ru',
            'last_name' => 'Карцева',
            'first_name' => 'Мария',
            'middle_name' => 'Сергеевна',
            'role' => 'teacher',
            'department' => 'JS-разработка',
            'phone' => '+7 (999) 444-55-66',
        ]);

        $teacherPhp = $this->upsertUser([
            'login' => 'teacher_karevskiy',
            'email' => 'karevskiy@college.ru',
            'last_name' => 'Каревский',
            'first_name' => 'Максим',
            'middle_name' => 'Андреевич',
            'role' => 'teacher',
            'department' => 'PHP-разработка',
            'phone' => '+7 (999) 555-77-88',
        ]);

        $group029 = Group::updateOrCreate(['name' => 'ИСП-029'], ['status' => 'active']);
        $group0029 = Group::updateOrCreate(['name' => 'ИСП-0029'], ['status' => 'active']);

        $studentsGroup029 = [
            ['Беляков', 'Сергей', 'Александрович'],
            ['Гвоздев', 'Семён', 'Денисович'],
            ['Гречушкин', 'Алексей', 'Александрович'],
            ['Григорян', 'Мелине', 'Самвеловна'],
            ['Гусаров', 'Егор', 'Сергеевич'],
            ['Дёрев', 'Никита', 'Андреевич'],
            ['Ершов', 'Никита', 'Алексеевич'],
            ['Жгутов', 'Иван', 'Евгеньевич'],
            ['Зорин', 'Даниил', 'Сергеевич'],
            ['Казарцев', 'Иван', 'Романович'],
            ['Камнев', 'Дмитрий', 'Максимович'],
            ['Карташов', 'Илья', 'Сергеевич'],
            ['Корня', 'Алина', 'Олеговна'],
            ['Кудряшов', 'Николай', 'Владимирович'],
            ['Куянов', 'Евгений', 'Владимирович'],
            ['Миронова', 'Лия', 'Николаевна'],
            ['Надулишняк', 'Виктор', 'Дмитриевич'],
            ['Пророков', 'Максим', 'Евгеньевич'],
            ['Сулейманов', 'Джохар', 'Алиевич'],
            ['Сулейманов', 'Эдем', 'Русланович'],
            ['Тихонов', 'Илья', 'Денисович'],
            ['Торяник', 'Ксения', 'Александровна'],
            ['Урядникова', 'Полина', 'Ильинична'],
            ['Забирюченко', 'Кристина', 'Алексеевна'],
        ];

        $studentsGroup0029 = [
            ['Абрамов', 'Тимур', 'Олегович'],
            ['Аксенова', 'Марина', 'Викторовна'],
            ['Андреев', 'Константин', 'Игоревич'],
            ['Бурлакова', 'Елизавета', 'Романовна'],
            ['Власов', 'Павел', 'Михайлович'],
            ['Воробьева', 'Дарья', 'Евгеньевна'],
            ['Герасимов', 'Арсений', 'Петрович'],
            ['Демидова', 'София', 'Андреевна'],
            ['Емельянов', 'Роман', 'Ильич'],
            ['Журавлева', 'Алина', 'Сергеевна'],
            ['Зайцев', 'Матвей', 'Александрович'],
            ['Исаев', 'Глеб', 'Дмитриевич'],
            ['Князева', 'Валерия', 'Олеговна'],
            ['Ларионов', 'Степан', 'Максимович'],
            ['Медведева', 'Анастасия', 'Игоревна'],
            ['Носов', 'Антон', 'Павлович'],
        ];

        $this->seedStudents($studentsGroup029, '029', $group029->id, 1);
        $this->seedStudents($studentsGroup0029, '0029', $group0029->id, 1);

        $this->upsertUser([
            'login' => 'Administrator',
            'email' => 'admin@college.ru',
            'last_name' => 'Админов',
            'first_name' => 'Админ',
            'middle_name' => 'Админович',
            'role' => 'admin',
            'phone' => '+7 (999) 700-00-01',
        ]);
    }

    private function seedStudents(array $students, string $groupTag, int $groupId, int $startIndex = 1): void
    {
        $counter = $startIndex;
        $usedLogins = [];
        foreach ($students as [$lastName, $firstName, $middleName]) {
            $baseLogin = Str::lower(Str::ascii($lastName . '_' . Str::substr($firstName, 0, 1) . Str::substr($middleName, 0, 1)));
            $baseLogin = preg_replace('/[^a-z0-9_]/', '', $baseLogin) ?: sprintf('student_%s', $groupTag);
            $login = $baseLogin;
            $suffix = 2;
            while (in_array($login, $usedLogins, true)) {
                $login = $baseLogin . '_' . $suffix;
                $suffix++;
            }
            $usedLogins[] = $login;

            $email = sprintf('%s@college.ru', $login);
            $phone = sprintf('+7 (910) %03d-%02d-%02d', 100 + $counter, 10 + intdiv($counter, 10), 20 + ($counter % 10));

            $this->upsertUser([
                'login' => $login,
                'email' => $email,
                'last_name' => $lastName,
                'first_name' => $firstName,
                'middle_name' => $middleName,
                'role' => 'student',
                'group_id' => $groupId,
                'phone' => $phone,
                'department' => null,
            ]);

            $counter++;
        }
    }

    private function upsertUser(array $payload): User
    {
        return User::updateOrCreate(['login' => $payload['login']], [
            'email' => $payload['email'],
            'password' => 'Password123',
            'last_name' => $payload['last_name'],
            'first_name' => $payload['first_name'],
            'middle_name' => $payload['middle_name'] ?? null,
            'role' => $payload['role'],
            'group_id' => $payload['group_id'] ?? null,
            'department' => $payload['department'] ?? null,
            'phone' => $payload['phone'] ?? null,
            'is_active' => true,
            'must_change_password' => false,
            'email_notifications_enabled' => true,
        ]);
    }
}
