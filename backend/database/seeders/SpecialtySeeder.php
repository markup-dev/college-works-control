<?php

namespace Database\Seeders;

use App\Models\Specialty;
use App\Models\SpecialtyProgramSubject;
use App\Models\Subject;
use Illuminate\Database\Seeder;

/** Специальности и типовые программы обучения; группы получают копию текущей программы при создании. */
class SpecialtySeeder extends Seeder
{
    public function run(): void
    {
        $software = Specialty::updateOrCreate(
            ['code' => '09.02.07'],
            ['name' => 'Информационные системы и программирование', 'study_years' => 4, 'status' => 'active']
        );

        $design = Specialty::updateOrCreate(
            ['code' => '54.02.01'],
            ['name' => 'Дизайн цифровых продуктов', 'study_years' => 3, 'status' => 'active']
        );

        $this->syncProgram($software, [
            1 => ['OP-101', 'INF-102', 'MAT-103', 'ALG-104'],
            2 => ['OOP-205', 'WEB-201', 'PHP-205', 'JS-206', 'GIT-207', 'TEST-208'],
            3 => ['БД-301', 'SQL-302', 'LRV-310', 'API-301', 'SEC-304'],
            4 => ['MOB-303', 'DEV-401', 'DIP-402'],
        ]);

        $this->syncProgram($design, [
            1 => ['UI-101', 'FIG-102', 'COL-103', 'INF-102'],
            2 => ['TYP-201', 'UX-202', 'WEB-203', 'JS-206'],
            3 => ['BRD-301', 'MOT-302', 'PRD-303', 'PORT-304'],
        ]);
    }

    /**
     * @param  array<int, list<string>>  $program
     */
    private function syncProgram(Specialty $specialty, array $program): void
    {
        SpecialtyProgramSubject::query()
            ->where('specialty_id', $specialty->id)
            ->delete();

        foreach ($program as $course => $codes) {
            foreach ($codes as $position => $code) {
                $subject = Subject::query()
                    ->where('code', $code)
                    ->where('status', 'active')
                    ->first();

                if (! $subject) {
                    continue;
                }

                SpecialtyProgramSubject::create([
                    'specialty_id' => $specialty->id,
                    'subject_id' => $subject->id,
                    'course' => (int) $course,
                    'position' => $position,
                    'note' => null,
                ]);
            }
        }

        $specialty->update(['program_updated_at' => $specialty->created_at ?? now()]);
    }
}
