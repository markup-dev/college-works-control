<?php

namespace Database\Seeders;

use App\Models\Subject;
use Illuminate\Database\Seeder;

/** Справочник дисциплин: активные для программ и несколько неактивных только для демонстрации фильтров. */
class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        $subjects = [
            // Общие и программирование (ИСП)
            ['name' => 'Основы программирования', 'code' => 'OP-101', 'status' => 'active'],
            ['name' => 'Информатика', 'code' => 'INF-102', 'status' => 'active'],
            ['name' => 'Дискретная математика', 'code' => 'MAT-103', 'status' => 'active'],
            ['name' => 'Алгоритмы и структуры данных', 'code' => 'ALG-104', 'status' => 'active'],
            ['name' => 'Веб-программирование', 'code' => 'WEB-201', 'status' => 'active'],
            ['name' => 'Объектно-ориентированное программирование', 'code' => 'OOP-205', 'status' => 'active'],
            ['name' => 'PHP-разработка', 'code' => 'PHP-205', 'status' => 'active'],
            ['name' => 'JavaScript и фронтенд', 'code' => 'JS-206', 'status' => 'active'],
            ['name' => 'Системы контроля версий', 'code' => 'GIT-207', 'status' => 'active'],
            ['name' => 'Автоматизированное тестирование', 'code' => 'TEST-208', 'status' => 'active'],
            ['name' => 'Базы данных', 'code' => 'БД-301', 'status' => 'active'],
            ['name' => 'Проектирование баз данных', 'code' => 'SQL-302', 'status' => 'active'],
            ['name' => 'Laravel Framework', 'code' => 'LRV-310', 'status' => 'active'],
            ['name' => 'REST API и интеграции', 'code' => 'API-301', 'status' => 'active'],
            ['name' => 'Информационная безопасность', 'code' => 'SEC-304', 'status' => 'active'],
            ['name' => 'Мобильная разработка', 'code' => 'MOB-303', 'status' => 'active'],
            ['name' => 'DevOps и развёртывание', 'code' => 'DEV-401', 'status' => 'active'],
            ['name' => 'Производственная практика', 'code' => 'DIP-402', 'status' => 'active'],

            // Дизайн цифровых продуктов
            ['name' => 'Основы дизайна интерфейсов', 'code' => 'UI-101', 'status' => 'active'],
            ['name' => 'Figma и прототипирование', 'code' => 'FIG-102', 'status' => 'active'],
            ['name' => 'Цвет и композиция', 'code' => 'COL-103', 'status' => 'active'],
            ['name' => 'Типографика в цифровых продуктах', 'code' => 'TYP-201', 'status' => 'active'],
            ['name' => 'UX-исследования', 'code' => 'UX-202', 'status' => 'active'],
            ['name' => 'Веб-дизайн', 'code' => 'WEB-203', 'status' => 'active'],
            ['name' => 'Брендинг и айдентика', 'code' => 'BRD-301', 'status' => 'active'],
            ['name' => 'Моушн-дизайн', 'code' => 'MOT-302', 'status' => 'active'],
            ['name' => 'Продуктовый дизайн', 'code' => 'PRD-303', 'status' => 'active'],
            ['name' => 'Портфолио и презентация проектов', 'code' => 'PORT-304', 'status' => 'active'],

            // Только справочник, не использовать в программах специальностей
            ['name' => 'Тестирование программного обеспечения', 'code' => 'ТПО-102', 'status' => 'inactive'],
            ['name' => 'Backend API проектирование', 'code' => 'API-401', 'status' => 'inactive'],
        ];

        foreach ($subjects as $subject) {
            Subject::updateOrCreate(
                ['code' => $subject['code']],
                [
                    'name' => $subject['name'],
                    'status' => $subject['status'],
                ]
            );
        }
    }
}
