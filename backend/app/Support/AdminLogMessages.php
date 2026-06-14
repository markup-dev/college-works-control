<?php

namespace App\Support;

/**
 * Единые русские подписи для журнала действий администратора.
 */
class AdminLogMessages
{
    public static function requestStatus(string $status): string
    {
        return match ($status) {
            'approved' => 'одобрена',
            'rejected' => 'отклонена',
            'pending' => 'на рассмотрении',
            default => $status,
        };
    }

    public static function teacherSubjectStatus(string $status): string
    {
        return match ($status) {
            'active' => 'активен',
            'inactive' => 'неактивен',
            default => $status,
        };
    }

    public static function groupStatus(string $status): string
    {
        return match ($status) {
            'active' => 'активна',
            'inactive' => 'неактивна',
            'graduated' => 'выпуск',
            'closed' => 'закрыта',
            default => $status,
        };
    }

    public static function teachingLoadTriple(?string $teacherName, ?string $subjectName, ?string $groupName): string
    {
        return collect([$teacherName, $subjectName, $groupName])
            ->filter(fn ($part) => is_string($part) && trim($part) !== '')
            ->implode(' · ');
    }
}
