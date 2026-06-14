<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use App\Models\Submission;
use App\Notifications\NewSubmissionTeacherNotification;
use App\Notifications\SubmissionGradedStudentNotification;
use App\Notifications\SubmissionReturnedStudentNotification;
use App\Services\Submissions\SubmissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Сдачи работ: список по роли, загрузка файла студентом, оценка и возврат преподавателем, скачивание.
 * Бизнес-правила и выдача списков — SubmissionService; после оценки/возврата — уведомления студенту.
 */
class SubmissionController extends Controller
{
    public function __construct(
        private readonly SubmissionService $submissions,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'list_context' => ['nullable', 'in:full'],
            'status' => ['nullable', 'in:submitted,graded,returned'],
            'assignment_id' => ['nullable', 'integer', 'exists:assignments,id'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'student_id' => ['nullable', 'integer', 'exists:users,id'],
            'group' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:newest,oldest,student_asc,student_desc,score_desc,score_asc,review_queue'],
            'deadline_filter' => ['nullable', 'in:all,overdue,due_3d,due_week'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        if (! empty($validated['group_id']) && $user->role === 'teacher') {
            $allowedGroupIds = $user->attachedTeachingGroupIds()->map(fn($id) => (int) $id)->all();
            if (! in_array((int) $validated['group_id'], $allowedGroupIds, true)) {
                throw ValidationException::withMessages([
                    'group_id' => 'Нет доступа к этой группе.',
                ]);
            }
        }

        $requestedPage = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 0);
        $shouldPaginate = $perPage > 0 || array_key_exists('page', $validated);
        if ($shouldPaginate && $perPage <= 0) {
            $perPage = SubmissionService::DEFAULT_PER_PAGE;
        }

        return response()->json(
            $this->submissions->indexPayload($user, $validated, $requestedPage, $perPage, $shouldPaginate)
        );
    }

    public function show(Request $request, Submission $submission)
    {
        $user = $request->user();
        $submission->loadMissing('assignment:id,teacher_id');

        if ($user->role === 'teacher' && (int) $submission->assignment?->teacher_id !== (int) $user->id) {
            return response()->json(['message' => 'Недостаточно прав для просмотра работы.'], 403);
        }

        if ($user->role === 'student' && (int) $submission->student_id !== (int) $user->id) {
            return response()->json(['message' => 'Недостаточно прав для просмотра работы.'], 403);
        }

        return response()->json([
            'submission' => $this->submissions->submissionPayload($submission),
        ]);
    }

    public function store(Request $request)
    {
        $student = $request->user();

        $baseValidated = $request->validate(
            [
                'assignment_id' => ['required', 'exists:assignments,id'],
            ],
            [
                'assignment_id.required' => 'Не выбрано задание для отправки.',
                'assignment_id.exists' => 'Выбранное задание не найдено.',
            ]
        );

        $assignment = Assignment::with('groups:id')->findOrFail($baseValidated['assignment_id']);

        $isDemoSubmission = $assignment->submission_type === 'demo';
        $allowedFormats = $this->submissions->resolveAllowedFormats($assignment);
        $maxKilobytes = $this->submissions->resolveMaxFileSizeKilobytes($assignment);

        $fileRules = [
            $isDemoSubmission ? 'nullable' : 'required',
            'file',
            "max:{$maxKilobytes}",
            'mimes:' . implode(',', $allowedFormats),
        ];

        $request->validate(
            [
                'file' => $fileRules,
            ],
            [
                'file.required' => 'Прикрепите файл с работой.',
                'file.max' => 'Размер файла не должен превышать ' . (int) floor($maxKilobytes / 1024) . ' МБ.',
                'file.mimes' => 'Допустимые форматы: ' . implode(', ', array_map(fn($format) => '.' . $format, $allowedFormats)) . '.',
            ]
        );

        $latestSubmission = $this->validateSubmissionTarget($request, $assignment);

        $file = $request->file('file');
        $path = $file ? $file->store('submissions', 'public') : null;
        $isDemoWithoutFile = $isDemoSubmission && ! $file;

        $submission = Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $student->id,
            'status' => 'submitted',
            'file_name' => $file?->getClientOriginalName(),
            'file_path' => $path,
            'file_size' => $file ? $this->submissions->formatFileSize($file->getSize()) : null,
            'file_type' => $file?->getClientMimeType(),
            'comment' => $isDemoWithoutFile ? 'Готов(а) к демонстрации' : null,
            'is_resubmission' => $latestSubmission !== null,
            'previous_submission_id' => $latestSubmission?->id,
            'submitted_at' => now(),
        ]);

        $this->submissions->syncAssignmentCompletionStatus($assignment);

        $submission->load([
            'assignment:id,title,subject_id,max_score,teacher_id',
            'assignment.subject:id,name',
            'assignment.teacher:id,is_active',
            'student:id,login,group_id,last_name,first_name,middle_name',
            'student.studentGroup:id,name',
        ]);

        $this->insertTeacherSubmissionNotification($submission);

        return response()->json([
            'success' => true,
            'submission' => $submission,
        ], 201);
    }

    public function uploadChunk(Request $request)
    {
        $validated = $request->validate([
            'assignment_id' => ['required', 'exists:assignments,id'],
            'upload_id' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9_-]+$/'],
            'chunk_index' => ['required', 'integer', 'min:0'],
            'total_chunks' => ['required', 'integer', 'min:1', 'max:100'],
            'file_name' => ['required', 'string', 'max:255'],
            'file_size' => ['required', 'integer', 'min:1'],
            'chunk' => ['required', 'file', 'max:1536'],
        ], [
            'chunk.required' => 'Не удалось загрузить часть файла. Попробуйте отправить работу ещё раз.',
            'chunk.max' => 'Не удалось загрузить часть файла. Попробуйте отправить работу ещё раз.',
        ]);

        $chunkIndex = (int) $validated['chunk_index'];
        $totalChunks = (int) $validated['total_chunks'];
        if ($chunkIndex >= $totalChunks) {
            throw ValidationException::withMessages([
                'chunk_index' => ['Некорректный номер части файла.'],
            ]);
        }

        $student = $request->user();
        $uploadId = (string) $validated['upload_id'];
        $chunkPath = $this->chunkPath((int) $student->id, $uploadId, $chunkIndex);

        Storage::put($chunkPath, file_get_contents($request->file('chunk')->getRealPath()));

        return response()->json([
            'success' => true,
            'chunk_index' => $chunkIndex,
        ]);
    }

    public function completeChunkedUpload(Request $request)
    {
        $validated = $request->validate([
            'assignment_id' => ['required', 'exists:assignments,id'],
            'upload_id' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9_-]+$/'],
            'total_chunks' => ['required', 'integer', 'min:1', 'max:100'],
            'file_name' => ['required', 'string', 'max:255'],
            'file_size' => ['required', 'integer', 'min:1'],
        ]);

        $student = $request->user();
        $assignment = Assignment::with('groups:id')->findOrFail($validated['assignment_id']);

        if ($assignment->submission_type === 'demo') {
            throw ValidationException::withMessages([
                'file' => ['Для демонстрационного задания файл прикреплять не нужно.'],
            ]);
        }

        $latestSubmission = $this->validateSubmissionTarget($request, $assignment);
        $allowedFormats = $this->submissions->resolveAllowedFormats($assignment);
        $maxBytes = $this->submissions->resolveMaxFileSizeKilobytes($assignment) * 1024;
        $fileName = trim((string) $validated['file_name']);
        $fileSize = (int) $validated['file_size'];
        $extension = mb_strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        if ($fileSize > $maxBytes) {
            throw ValidationException::withMessages([
                'file' => ['Размер файла не должен превышать ' . (int) floor($maxBytes / 1024 / 1024) . ' МБ.'],
            ]);
        }
        if ($extension === '' || ! in_array($extension, $allowedFormats, true)) {
            throw ValidationException::withMessages([
                'file' => ['Допустимые форматы: ' . implode(', ', array_map(fn($format) => '.' . $format, $allowedFormats)) . '.'],
            ]);
        }

        $uploadId = (string) $validated['upload_id'];
        $totalChunks = (int) $validated['total_chunks'];
        $safeName = $this->sanitizeFileName($fileName);
        $storedPath = 'submissions/' . Str::uuid() . '_' . $safeName;

        Storage::disk('public')->makeDirectory('submissions');
        $targetPath = Storage::disk('public')->path($storedPath);
        $target = fopen($targetPath, 'wb');
        $writtenBytes = 0;

        try {
            for ($i = 0; $i < $totalChunks; $i++) {
                $chunkPath = $this->chunkPath((int) $student->id, $uploadId, $i);
                if (! Storage::exists($chunkPath)) {
                    throw ValidationException::withMessages([
                        'file' => ['Файл загрузился не полностью. Выберите файл и отправьте работу ещё раз.'],
                    ]);
                }

                $chunk = fopen(Storage::path($chunkPath), 'rb');
                $writtenBytes += stream_copy_to_stream($chunk, $target);
                fclose($chunk);
            }
        } finally {
            fclose($target);
        }

        Storage::deleteDirectory($this->chunkDirectory((int) $student->id, $uploadId));

        if ($writtenBytes !== $fileSize) {
            Storage::disk('public')->delete($storedPath);
            throw ValidationException::withMessages([
                'file' => ['Файл загрузился некорректно. Выберите файл и отправьте работу ещё раз.'],
            ]);
        }

        $submission = Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $student->id,
            'status' => 'submitted',
            'file_name' => $fileName,
            'file_path' => $storedPath,
            'file_size' => $this->submissions->formatFileSize($fileSize),
            'file_type' => mime_content_type($targetPath) ?: null,
            'comment' => null,
            'is_resubmission' => $latestSubmission !== null,
            'previous_submission_id' => $latestSubmission?->id,
            'submitted_at' => now(),
        ]);

        $this->submissions->syncAssignmentCompletionStatus($assignment);

        $submission->load([
            'assignment:id,title,subject_id,max_score,teacher_id',
            'assignment.subject:id,name',
            'assignment.teacher:id,is_active',
            'student:id,login,group_id,last_name,first_name,middle_name',
            'student.studentGroup:id,name',
        ]);

        $this->insertTeacherSubmissionNotification($submission);

        return response()->json([
            'success' => true,
            'submission' => $submission,
        ], 201);
    }

    public function grade(Request $request, Submission $submission)
    {
        if ($deny = $this->denyIfNotAssignmentTeacher($request, $submission)) {
            return $deny;
        }

        $validated = $request->validate(
            [
                'score' => ['required', 'integer', 'min:0'],
                'comment' => ['nullable', 'string', 'max:1000'],
                'criterion_scores' => ['nullable', 'array', 'max:50'],
                'criterion_scores.*.text' => ['required_with:criterion_scores', 'string', 'max:500'],
                'criterion_scores.*.max_points' => ['required_with:criterion_scores', 'integer', 'min:1', 'max:100'],
                'criterion_scores.*.received_points' => ['required_with:criterion_scores', 'integer', 'min:0', 'max:1000'],
            ],
            [
                'score.required' => 'Укажите оценку.',
                'score.integer' => 'Оценка должна быть целым числом.',
                'score.min' => 'Оценка не может быть отрицательной.',
                'comment.max' => 'Комментарий не должен превышать 1000 символов.',
                'criterion_scores.*.received_points.required_with' => 'Укажите полученные баллы по каждому критерию.',
            ]
        );

        $maxScore = $submission->assignment?->max_score ?? 100;
        if ($validated['score'] > $maxScore) {
            throw ValidationException::withMessages([
                'score' => ["Оценка не может превышать максимальный балл задания ({$maxScore})."],
            ]);
        }

        if ($submission->status === 'returned') {
            throw ValidationException::withMessages([
                'status' => ['Эта работа возвращена студенту на доработку. Оценить можно только новую сдачу после повторной отправки.'],
            ]);
        }

        if (! in_array($submission->status, ['submitted', 'graded'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Сейчас эту работу нельзя оценить.'],
            ]);
        }

        $criterionScores = $validated['criterion_scores'] ?? null;
        if (is_array($criterionScores) && count($criterionScores) > 0) {
            $criteriaTotal = 0;

            foreach ($criterionScores as $index => $criterionScore) {
                $receivedPoints = (int) ($criterionScore['received_points'] ?? 0);
                $maxPoints = (int) ($criterionScore['max_points'] ?? 0);

                if ($receivedPoints > $maxPoints) {
                    throw ValidationException::withMessages([
                        "criterion_scores.{$index}.received_points" => ["Баллы по критерию не могут превышать максимум ({$maxPoints})."],
                    ]);
                }

                $criteriaTotal += $receivedPoints;
            }

            if ($criteriaTotal !== (int) $validated['score']) {
                throw ValidationException::withMessages([
                    'score' => ['Сумма баллов по критериям должна совпадать с итоговой оценкой.'],
                ]);
            }
        }

        $submission->update([
            'status' => 'graded',
            'score' => $validated['score'],
            'teacher_comment' => $validated['comment'] ?? null,
            'criterion_scores' => $criterionScores,
        ]);

        $this->submissions->syncAssignmentCompletionStatus($submission->assignment);

        $submission->load([
            'assignment:id,title,subject_id,max_score,teacher_id',
            'assignment.subject:id,name',
            'assignment.teacher:id,login,last_name,first_name,middle_name,grade_scale',
            'student:id,login,group_id,last_name,first_name,middle_name,is_active',
            'student.studentGroup:id,name',
        ]);
        $submission->setAttribute('grade_label', $submission->gradeLabel());

        $student = $submission->student;
        if ($student && $student->is_active) {
            try {
                $student->notify(new SubmissionGradedStudentNotification($submission));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'success' => true,
            'submission' => $submission,
        ]);
    }

    public function returnSubmission(Request $request, Submission $submission)
    {
        if ($deny = $this->denyIfNotAssignmentTeacher($request, $submission)) {
            return $deny;
        }

        if ($submission->status !== 'submitted') {
            return response()->json([
                'message' => 'На доработку можно вернуть только работу со статусом "На проверке".',
            ], 422);
        }

        if ((bool) $submission->is_resubmission) {
            return response()->json([
                'message' => 'Повторная отправка уже использована. Повторно вернуть на доработку нельзя.',
            ], 422);
        }

        $validated = $request->validate(
            [
                'comment' => ['nullable', 'string', 'max:1000'],
            ],
            [
                'comment.max' => 'Комментарий не должен превышать 1000 символов.',
            ]
        );

        $submission->update([
            'status' => 'returned',
            'teacher_comment' => $validated['comment'] ?? null,
        ]);

        $this->submissions->syncAssignmentCompletionStatus($submission->assignment);

        $submission->load([
            'assignment:id,title,subject_id,max_score,teacher_id',
            'assignment.subject:id,name',
            'assignment.teacher:id,login,last_name,first_name,middle_name,grade_scale',
            'student:id,login,group_id,last_name,first_name,middle_name,is_active',
            'student.studentGroup:id,name',
        ]);
        $submission->setAttribute('grade_label', $submission->gradeLabel());

        $student = $submission->student;
        if ($student && $student->is_active) {
            try {
                $student->notify(new SubmissionReturnedStudentNotification($submission));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'success' => true,
            'submission' => $submission,
        ]);
    }

    public function download(Request $request, Submission $submission)
    {
        $user = $request->user();

        $canDownload = $user->role === 'admin'
            || ($user->role === 'teacher' && (int) $submission->assignment?->teacher_id === (int) $user->id)
            || ($user->role === 'student' && (int) $submission->student_id === (int) $user->id);

        if (! $canDownload) {
            return response()->json(['message' => 'Недостаточно прав для скачивания файла.'], 403);
        }

        if (empty($submission->file_path) || ! Storage::disk('public')->exists($submission->file_path)) {
            return response()->json(['message' => 'Файл не найден.'], 404);
        }

        return response()->download(
            Storage::disk('public')->path($submission->file_path),
            $submission->file_name ?: basename($submission->file_path)
        );
    }

    private function validateSubmissionTarget(Request $request, Assignment $assignment): ?Submission
    {
        $student = $request->user();

        if ($assignment->status !== 'active') {
            $message = $assignment->status === 'archived'
                ? 'Приём работ по этому заданию завершён: задание снято с активных.'
                : 'Сдача работ по этому заданию недоступна.';

            throw ValidationException::withMessages([
                'assignment_id' => [$message],
            ]);
        }

        if (! $student->group_id) {
            throw ValidationException::withMessages([
                'assignment_id' => ['Чтобы сдать работу, у вашего аккаунта должна быть указана учебная группа.'],
            ]);
        }

        if (! $assignment->groups->contains(fn($g) => (int) $g->id === (int) $student->group_id)) {
            throw ValidationException::withMessages([
                'assignment_id' => ['Это задание не назначено вашей группе.'],
            ]);
        }

        $studentSubmissions = Submission::where('assignment_id', $assignment->id)
            ->where('student_id', $student->id)
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->get(['id', 'status', 'is_resubmission', 'submitted_at', 'created_at']);

        $latestSubmission = $studentSubmissions->first();
        if (! $latestSubmission) {
            return null;
        }

        if ($latestSubmission->status !== 'returned') {
            throw ValidationException::withMessages([
                'assignment_id' => ['Повторная отправка доступна только после возврата работы на доработку преподавателем.'],
            ]);
        }

        if ($studentSubmissions->contains(fn($item) => (bool) $item->is_resubmission)) {
            throw ValidationException::withMessages([
                'assignment_id' => ['Лимит пересдачи исчерпан. Дополнительная пересдача недоступна.'],
            ]);
        }

        return $latestSubmission;
    }

    private function chunkDirectory(int $studentId, string $uploadId): string
    {
        return 'submission-chunks/' . $studentId . '/' . $uploadId;
    }

    private function chunkPath(int $studentId, string $uploadId, int $chunkIndex): string
    {
        return $this->chunkDirectory($studentId, $uploadId) . '/' . str_pad((string) $chunkIndex, 5, '0', STR_PAD_LEFT) . '.part';
    }

    private function sanitizeFileName(string $fileName): string
    {
        $safeName = trim(preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]+/u', '_', basename($fileName)) ?? '');

        return $safeName !== '' ? $safeName : 'submission-file';
    }

    private function insertTeacherSubmissionNotification(Submission $submission): void
    {
        $submission->loadMissing([
            'assignment:id,title,teacher_id',
            'assignment.teacher:id,is_active',
            'student:id,first_name,last_name,middle_name,group_id',
            'student.studentGroup:id,name',
        ]);

        $teacher = $submission->assignment?->teacher;
        if (! $teacher || ! $teacher->is_active) {
            return;
        }

        $studentName = $submission->student?->full_name ?? 'Студент';
        $groupName = $submission->student?->studentGroup?->name;
        $title = $submission->assignment?->title ?? 'Задание';

        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(),
            'type' => NewSubmissionTeacherNotification::class,
            'notifiable_type' => \App\Models\User::class,
            'notifiable_id' => $teacher->id,
            'data' => json_encode([
                'title' => 'Новая работа на проверке',
                'body' => $studentName.($groupName ? ' ('.$groupName.')' : '').' — «'.$title.'»',
                'kind' => 'submission_submitted_teacher',
                'assignment_id' => $submission->assignment_id,
                'submission_id' => $submission->id,
                'student_group_name' => $groupName,
            ], JSON_UNESCAPED_UNICODE),
            'read_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Защита от IDOR: оценивать и возвращать на доработку может только автор задания.
     */
    private function denyIfNotAssignmentTeacher(Request $request, Submission $submission): ?\Illuminate\Http\JsonResponse
    {
        $submission->loadMissing('assignment:id,teacher_id');
        $teacherId = $submission->assignment?->teacher_id;
        if ((int) $teacherId !== (int) $request->user()->id) {
            return response()->json([
                'message' => 'Недостаточно прав для этой работы.',
            ], 403);
        }

        return null;
    }
}
