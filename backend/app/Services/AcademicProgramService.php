<?php

namespace App\Services;

use App\Models\Group;
use App\Models\GroupSubject;
use App\Models\Specialty;
use App\Models\Subject;
use App\Models\TeacherSubject;
use App\Models\TeacherSubjectRequest;
use App\Models\TeachingLoad;
use App\Models\TeachingLoadRequest;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class AcademicProgramService
{
    public function copySpecialtyProgramToGroup(Group $group): void
    {
        if (! $group->specialty_id) {
            return;
        }

        $specialty = Specialty::query()
            ->with(['programSubjects' => fn ($q) => $q
                ->orderBy('course')
                ->orderBy('position')
                ->orderBy('id')])
            ->find($group->specialty_id);

        if (! $specialty) {
            return;
        }

        foreach ($specialty->programSubjects as $programSubject) {
            GroupSubject::updateOrCreate(
                [
                    'group_id' => $group->id,
                    'subject_id' => $programSubject->subject_id,
                    'course' => $programSubject->course,
                ],
                [
                    'specialty_program_subject_id' => $programSubject->id,
                    'position' => $programSubject->position,
                    'status' => (int) $programSubject->course === (int) $group->current_course
                        ? 'active'
                        : ((int) $programSubject->course < (int) $group->current_course ? 'completed' : 'future'),
                    'closed_at' => (int) $programSubject->course < (int) $group->current_course ? now() : null,
                    'note' => $programSubject->note,
                ]
            );
        }
    }

    public function teacherCanTeachSubject(int $teacherId, int $subjectId): bool
    {
        if (! Subject::query()->where('id', $subjectId)->where('status', 'active')->exists()) {
            return false;
        }

        return TeacherSubject::query()
            ->where('teacher_id', $teacherId)
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->exists();
    }

    public function groupHasActiveSubject(int $groupId, int $subjectId): bool
    {
        $group = Group::query()->find($groupId);
        if (! $group) {
            return false;
        }

        if (! Subject::query()->where('id', $subjectId)->where('status', 'active')->exists()) {
            return false;
        }

        $hasCurrentProgramSubject = GroupSubject::query()
            ->where('group_id', $groupId)
            ->where('subject_id', $subjectId)
            ->where('course', (int) $group->current_course)
            ->where('status', 'active')
            ->exists();

        if ($hasCurrentProgramSubject) {
            return true;
        }

        return TeachingLoad::query()
            ->where('group_id', $groupId)
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->exists();
    }

    public function assertActiveTeacher(int $teacherId, string $field = 'teacher_id'): void
    {
        $teacher = User::query()
            ->where('id', $teacherId)
            ->where('role', 'teacher')
            ->first(['id', 'is_active']);

        if (! $teacher) {
            throw ValidationException::withMessages([
                $field => 'Преподаватель не найден.',
            ]);
        }

        if (! $teacher->is_active) {
            throw ValidationException::withMessages([
                $field => 'Нельзя назначать на заблокированного преподавателя.',
            ]);
        }
    }

    public function assertTeachingLoadAllowed(int $teacherId, int $subjectId, int $groupId, bool $requireActiveTeacher = true): void
    {
        if ($requireActiveTeacher) {
            $this->assertActiveTeacher($teacherId);
        }

        if (! $this->teacherCanTeachSubject($teacherId, $subjectId)) {
            throw ValidationException::withMessages([
                'subject_id' => 'Преподаватель не имеет допуска к этой активной дисциплине.',
            ]);
        }

        if (! $this->groupHasActiveSubject($groupId, $subjectId)) {
            throw ValidationException::withMessages([
                'subject_id' => 'Эта дисциплина не активна для выбранной группы на текущем курсе.',
            ]);
        }
    }

    public function assertTeacherSubjectRequestAllowed(int $teacherId, int $subjectId): void
    {
        $this->assertActiveTeacher($teacherId);

        $subject = Subject::query()->find($subjectId, ['id', 'name']);
        $label = $subject?->name ?? 'Дисциплина';

        if ($this->teacherCanTeachSubject($teacherId, $subjectId)) {
            throw ValidationException::withMessages([
                'subject_id' => "У вас уже есть допуск к дисциплине «{$label}».",
            ]);
        }

        if (TeacherSubjectRequest::query()
            ->where('teacher_id', $teacherId)
            ->where('subject_id', $subjectId)
            ->where('status', 'pending')
            ->exists()) {
            throw ValidationException::withMessages([
                'subject_id' => "Заявка на допуск к дисциплине «{$label}» уже на рассмотрении.",
            ]);
        }
    }

    public function assertTeachingLoadRequestAllowed(int $teacherId, int $subjectId, int $groupId): void
    {
        $this->assertTeachingLoadAllowed($teacherId, $subjectId, $groupId);

        $existing = TeachingLoad::query()
            ->where('teacher_id', $teacherId)
            ->where('subject_id', $subjectId)
            ->where('group_id', $groupId)
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'group_id' => 'Такое назначение уже есть: '.$this->teachingLoadTripleLabel($subjectId, $groupId).'.',
            ]);
        }

        if (TeachingLoadRequest::query()
            ->where('teacher_id', $teacherId)
            ->where('subject_id', $subjectId)
            ->where('group_id', $groupId)
            ->where('status', 'pending')
            ->exists()) {
            throw ValidationException::withMessages([
                'group_id' => 'Заявка на это назначение уже на рассмотрении: '.$this->teachingLoadTripleLabel($subjectId, $groupId).'.',
            ]);
        }
    }

    public function teachingLoadTripleLabel(int $subjectId, int $groupId): string
    {
        $subject = Subject::query()->find($subjectId, ['name']);
        $group = Group::query()->find($groupId, ['name']);

        return sprintf(
            '«%s», группа «%s»',
            $subject?->name ?? 'Дисциплина',
            $group?->name ?? 'Группа',
        );
    }

    public function promoteGroup(Group $group): Group
    {
        if ($group->status !== 'active') {
            return $group;
        }

        $currentCourse = (int) $group->current_course;
        $studyYears = max(1, (int) $group->study_years);

        GroupSubject::query()
            ->where('group_id', $group->id)
            ->where('course', $currentCourse)
            ->where('status', 'active')
            ->update(['status' => 'completed', 'closed_at' => now()]);

        if ($currentCourse >= $studyYears) {
            $group->update(['status' => 'graduated']);

            return $group->fresh();
        }

        $nextCourse = $currentCourse + 1;
        $group->update(['current_course' => $nextCourse]);

        GroupSubject::query()
            ->where('group_id', $group->id)
            ->where('course', $nextCourse)
            ->where('status', 'future')
            ->update(['status' => 'active', 'closed_at' => null]);

        return $group->fresh();
    }
}
