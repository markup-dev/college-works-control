<?php

namespace Database\Seeders;

use App\Models\Subject;
use App\Models\TeacherSubject;
use App\Models\TeacherSubjectRequest;
use App\Models\User;
use Illuminate\Database\Seeder;

/** Допуски преподавателей к дисциплинам и демонстрационные заявки для модерации. */
class TeacherPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('role', 'admin')->first();
        $kartseva = User::where('email', 'kartseva@college.ru')->first();
        $karevskiy = User::where('email', 'karevskiy@college.ru')->first();

        if (! $kartseva || ! $karevskiy) {
            return;
        }

        $this->allow($kartseva, ['БД-301', 'WEB-201'], $admin?->id);
        $this->allow($karevskiy, ['PHP-205', 'LRV-310'], $admin?->id);

        TeacherSubjectRequest::query()
            ->where('teacher_id', $kartseva->id)
            ->where('status', 'pending')
            ->whereHas('subject', fn ($query) => $query->where('status', '!=', 'active'))
            ->delete();

        $laravel = Subject::query()
            ->where('code', 'LRV-310')
            ->where('status', 'active')
            ->first();
        if ($laravel) {
            TeacherSubjectRequest::updateOrCreate(
                ['teacher_id' => $kartseva->id, 'subject_id' => $laravel->id, 'status' => 'pending'],
                ['comment' => 'Прошла курс по Laravel и хочу вести практические занятия.']
            );
        }
    }

    /**
     * @param  list<string>  $codes
     */
    private function allow(User $teacher, array $codes, ?int $adminId): void
    {
        $subjects = Subject::whereIn('code', $codes)->get();
        foreach ($subjects as $subject) {
            TeacherSubject::updateOrCreate(
                ['teacher_id' => $teacher->id, 'subject_id' => $subject->id],
                ['status' => 'active', 'approved_by' => $adminId, 'approved_at' => now()]
            );
        }
    }
}
