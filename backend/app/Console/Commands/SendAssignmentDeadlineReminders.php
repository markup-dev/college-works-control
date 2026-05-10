<?php

namespace App\Console\Commands;

use App\Models\Assignment;
use App\Models\Submission;
use App\Notifications\AssignmentDeadlineReminderNotification;
use App\Services\AssignmentNotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * Консольная команда рассылки напоминаний о дедлайне заданий.
 *
 * Запускается по расписанию (scheduler): для каждого окна «через N дней до срока»
 * находит задания с такой датой дедлайна и уведомляет студентов из целевых групп.
 * Повторно одному и тому же студенту за то же задание в тот же день не спамим (кэш).
 * Уже сдавших с финальной оценкой (status graded) пропускаем — напоминание не нужно.
 */
class SendAssignmentDeadlineReminders extends Command
{
    protected $signature = 'assignments:send-deadline-reminders';

    protected $description = 'Напоминания студентам о сроках сдачи (за 3 и 1 день), без спама — раз в сутки на пару задание+студент';

    public function handle(AssignmentNotificationService $assignmentNotificationService): int
    {
        // Якорь «сегодня» без времени — сравнение deadline идёт по календарной дате.
        $today = now()->startOfDay();

        // Два окна: за 3 дня и за 1 день до дедлайна. label — часть ключа кэша, days — число в уведомлении.
        $windows = [
            ['days' => 3, 'label' => '3'],
            ['days' => 1, 'label' => '1'],
        ];

        foreach ($windows as $window) {
            // Дата дедлайна, к которой относится это напоминание (например «сегодня + 3 дня»).
            $targetDate = $today->copy()->addDays($window['days']);

            // Задания с нужным днём сдачи; archived не берём — работа с архивом обычно закрыта.
            // inactive оставляем: задание ещё может требовать сдачи по графику.
            $assignments = Assignment::query()
                ->whereIn('status', ['active', 'inactive'])
                ->whereDate('deadline', $targetDate->toDateString())
                ->with(['groups:id'])
                ->get();

            if ($assignments->isEmpty()) {
                continue;
            }

            // Одним проходом по БД собираем пары «задание:студент», у которых уже есть оценённая сдача — им не шлём письмо/БД-уведомление.
            $gradedKeys = $this->gradedSubmissionKeysForAssignments(
                $assignments->modelKeys()
            );

            foreach ($assignments as $assignment) {
                // Студенты из групп, привязанных к заданию (та же логика, что при выдаче задания).
                $students = $assignmentNotificationService->studentsForAssignment($assignment);

                foreach ($students as $student) {
                    if (isset($gradedKeys[$assignment->getKey() . ':' . $student->getKey()])) {
                        continue;
                    }

                    // Cache::add = «установить только если ключа нет»: гарантирует не больше одного напоминания
                    // на комбинацию задание + студент + тип окна (1 или 3 дня) + календарный день запуска cron.
                    $cacheKey = sprintf(
                        'deadline_reminder:%d:%d:%s:%s',
                        $assignment->id,
                        $student->id,
                        $window['label'],
                        $today->toDateString()
                    );

                    if (! Cache::add($cacheKey, true, now()->addHours(48))) {
                        continue;
                    }

                    try {
                        $student->notify(new AssignmentDeadlineReminderNotification(
                            $assignment,
                            (int) $window['days']
                        ));
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }
            }
        }

        return self::SUCCESS;
    }

    /**
     * Возвращает множество ключей вида "{assignment_id}:{student_id}" для сдач со статусом «оценена».
     * По ним в handle() отфильтровываем студентов, которым напоминание не актуально.
     *
     * @param  array<int|string>  $assignmentIds
     * @return array<string, true>
     */
    private function gradedSubmissionKeysForAssignments(array $assignmentIds): array
    {
        if ($assignmentIds === []) {
            return [];
        }

        $keys = [];
        // cursor — экономия памяти при большом числе строк; нам нужны только два поля.
        foreach (
            Submission::query()
                ->whereIn('assignment_id', $assignmentIds)
                ->where('status', 'graded')
                ->cursor(['assignment_id', 'student_id']) as $row
        ) {
            $keys[$row->assignment_id . ':' . $row->student_id] = true;
        }

        return $keys;
    }
}
