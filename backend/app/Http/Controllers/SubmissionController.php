<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use App\Models\Assignment;
use App\Models\User;
use App\Notifications\NewSubmissionTeacherNotification;
use App\Notifications\SubmissionGradedStudentNotification;
use App\Notifications\SubmissionReturnedStudentNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SubmissionController extends Controller
{
    private const DEFAULT_ALLOWED_FORMATS = ['pdf', 'doc', 'docx', 'zip', 'rar'];
    private const DEFAULT_MAX_FILE_SIZE_MB = 50;
    private const DEFAULT_PER_PAGE = 20;

    public function index(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:submitted,graded,returned'],
            'assignment_id' => ['nullable', 'integer', 'exists:assignments,id'],
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'group_id' => ['nullable', 'integer', 'exists:groups,id'],
            'student_id' => ['nullable', 'integer', 'exists:users,id'],
            'group' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:newest,oldest,student_asc,student_desc,score_desc,score_asc'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $requestedPage = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 0);
        $shouldPaginate = $perPage > 0 || array_key_exists('page', $validated);
        if ($shouldPaginate && $perPage <= 0) {
            $perPage = self::DEFAULT_PER_PAGE;
        }

        if ($user->role === 'student') {
            $query = Submission::where('student_id', $user->id);
        } elseif ($user->role === 'teacher') {
            $query = Submission::whereHas('assignment', fn($q) => $q->where('teacher_id', $user->id));
        } else {
            $query = Submission::query();
        }

        $query->with([
            'assignment:id,title,subject_id,max_score,submission_type',
            'assignment.subjectRelation:id,name',
            'student:id,login,group_id,last_name,first_name,middle_name',
            'student.studentGroup:id,name',
        ]);

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (!empty($validated['assignment_id'])) {
            $query->where('assignment_id', (int) $validated['assignment_id']);
        }
        if (!empty($validated['subject_id'])) {
            $query->whereHas('assignment', fn ($assignmentQuery) => $assignmentQuery->where('subject_id', (int) $validated['subject_id']));
        }

        if (!empty($validated['group_id'])) {
            $query->whereHas('student', fn ($studentQuery) => $studentQuery->where('group_id', (int) $validated['group_id']));
        }
        if (!empty($validated['student_id'])) {
            $sid = (int) $validated['student_id'];
            if ($user->role === 'teacher') {
                $stu = User::query()->where('id', $sid)->where('role', 'student')->first();
                if (! $stu || ! $stu->group_id) {
                    throw ValidationException::withMessages(['student_id' => 'Студент не найден.']);
                }
                $allowed = $user->attachedTeachingGroupIds()->map(fn ($id) => (int) $id)->all();
                if (! in_array((int) $stu->group_id, $allowed, true)) {
                    throw ValidationException::withMessages(['student_id' => 'Нет доступа к этому студенту.']);
                }
            }
            $query->where('student_id', $sid);
        }
        if (!empty($validated['group'])) {
            $groupName = trim((string) $validated['group']);
            $query->whereHas('student.studentGroup', fn ($groupQuery) => $groupQuery->where('name', $groupName));
        }

        if (!empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(function ($builder) use ($term) {
                $builder
                    ->whereHas('assignment', fn ($assignmentQuery) => $assignmentQuery->where('title', 'like', "%{$term}%"))
                    ->orWhereHas('student', function ($studentQuery) use ($term) {
                        $studentQuery
                            ->where('login', 'like', "%{$term}%")
                            ->orWhere('last_name', 'like', "%{$term}%")
                            ->orWhere('first_name', 'like', "%{$term}%")
                            ->orWhere('middle_name', 'like', "%{$term}%");
                    })
                    ->orWhereHas('student.studentGroup', fn ($groupQuery) => $groupQuery->where('name', 'like', "%{$term}%"));
            });
        }

        $sort = $validated['sort'] ?? 'newest';
        switch ($sort) {
            case 'oldest':
                $query->orderBy('submitted_at')->orderBy('created_at');
                break;
            case 'student_asc':
                $query->orderBy(
                    User::select('last_name')->whereColumn('users.id', 'submissions.student_id')
                )->orderBy(
                    User::select('first_name')->whereColumn('users.id', 'submissions.student_id')
                );
                break;
            case 'student_desc':
                $query->orderByDesc(
                    User::select('last_name')->whereColumn('users.id', 'submissions.student_id')
                )->orderByDesc(
                    User::select('first_name')->whereColumn('users.id', 'submissions.student_id')
                );
                break;
            case 'score_desc':
                $query->orderByDesc('score')->orderByDesc('submitted_at');
                break;
            case 'score_asc':
                $query->orderBy('score')->orderByDesc('submitted_at');
                break;
            case 'newest':
            default:
                $query->orderByDesc('submitted_at')->orderByDesc('created_at');
                break;
        }

        $mapSubmission = fn($sub) => [
            'id' => $sub->id,
            'assignment_id' => $sub->assignment_id,
            'assignment_title' => $sub->assignment?->title ?? '',
            'subject_id' => $sub->assignment?->subject_id,
            'subject_name' => $sub->assignment?->subjectRelation?->name ?? '',
            'max_score' => $sub->assignment?->max_score ?? 100,
            'submission_type' => $sub->assignment?->submission_type ?? 'file',
            'student_id' => $sub->student_id,
            'student_name' => $sub->student?->full_name ?? '',
            'student_login' => $sub->student?->login ?? '',
            'group_id' => $sub->student?->group_id,
            'group_name' => $sub->student?->studentGroup?->name ?? '',
            'status' => $sub->status,
            'score' => $sub->score,
            'comment' => $sub->comment,
            'teacher_comment' => $sub->teacher_comment,
            'criterion_scores' => $sub->criterion_scores,
            'file_name' => $sub->file_name,
            'file_path' => $sub->file_path,
            'file_size' => $sub->file_size,
            'file_type' => $sub->file_type,
            'is_resubmission' => $sub->is_resubmission,
            'submission_date' => $sub->submitted_at ?? $sub->created_at,
            'created_at' => $sub->created_at,
        ];

        if ($shouldPaginate) {
            $paginated = $query->paginate($perPage, ['*'], 'page', $requestedPage);
            $paginated->getCollection()->transform($mapSubmission);
            return response()->json([
                'data' => $paginated->items(),
                'meta' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
            ]);
        }

        return response()->json($query->get()->map($mapSubmission));
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

        $assignment = Assignment::findOrFail($baseValidated['assignment_id']);
        $isDemoSubmission = $assignment->submission_type === 'demo';
        $allowedFormats = $this->resolveAllowedFormats($assignment);
        $maxKilobytes = $this->resolveMaxFileSizeKilobytes($assignment);

        $fileRules = [
            $isDemoSubmission ? 'nullable' : 'required',
            'file',
            "max:{$maxKilobytes}",
            'mimes:' . implode(',', $allowedFormats),
        ];

        $validated = $request->validate(
            [
                'assignment_id' => ['required', 'exists:assignments,id'],
                'file' => $fileRules,
            ],
            [
                'file.required' => 'Прикрепите файл с работой.',
                'file.max' => 'Размер файла не должен превышать ' . (int) floor($maxKilobytes / 1024) . ' МБ.',
                'file.mimes' => 'Допустимые форматы: ' . implode(', ', array_map(fn ($format) => '.' . $format, $allowedFormats)) . '.',
            ]
        );

        $studentSubmissions = Submission::where('assignment_id', $assignment->id)
            ->where('student_id', $student->id)
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->get(['id', 'status', 'is_resubmission', 'submitted_at', 'created_at']);

        $latestSubmission = $studentSubmissions->first();
        $retakeUsed = $studentSubmissions->contains(fn($item) => (bool) $item->is_resubmission);
        if ($latestSubmission) {
            if ($latestSubmission->status !== 'returned') {
                return response()->json([
                    'message' => 'Повторная отправка доступна только после возврата работы на доработку преподавателем.',
                ], 422);
            }

            if ($retakeUsed) {
                return response()->json([
                    'message' => 'Лимит пересдачи исчерпан. Дополнительная пересдача недоступна.',
                ], 422);
            }
        }

        $file = $request->file('file');
        $path = $file ? $file->store('submissions', 'public') : null;
        $isDemoWithoutFile = $isDemoSubmission && !$file;

        $submission = Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $student->id,
            'status' => 'submitted',
            'file_name' => $file?->getClientOriginalName(),
            'file_path' => $path,
            'file_size' => $file ? $this->formatFileSize($file->getSize()) : null,
            'file_type' => $file?->getClientMimeType(),
            'comment' => $isDemoWithoutFile ? 'Готов(а) к демонстрации' : null,
            'is_resubmission' => $latestSubmission !== null,
            'previous_submission_id' => $latestSubmission?->id,
            'submitted_at' => now(),
        ]);

        $this->syncAssignmentCompletionStatus($assignment);

        $submission->load([
            'assignment:id,title,subject_id,max_score,teacher_id',
            'assignment.subjectRelation:id,name',
            'assignment.teacher:id,is_active',
            'student:id,login,group_id,last_name,first_name,middle_name',
            'student.studentGroup:id,name',
        ]);

        $teacher = $submission->assignment?->teacher;
        if ($teacher && $teacher->is_active) {
            try {
                $teacher->notify(new NewSubmissionTeacherNotification($submission));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'success' => true,
            'submission' => $submission,
        ], 201);
    }

    public function grade(Request $request, Submission $submission)
    {
        $validated = $request->validate(
            [
                'score' => ['required', 'integer', 'min:0'],
                'comment' => ['nullable', 'string', 'max:1000'],
                'criterion_scores' => ['nullable', 'array', 'max:50'],
                'criterion_scores.*.text' => ['required_with:criterion_scores', 'string', 'max:500'],
                'criterion_scores.*.max_points' => ['required_with:criterion_scores', 'integer', 'min:0', 'max:1000'],
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

        $this->syncAssignmentCompletionStatus($submission->assignment);

        $submission->load([
            'assignment:id,title,subject_id,max_score',
            'assignment.subjectRelation:id,name',
            'student:id,login,group_id,last_name,first_name,middle_name,is_active',
            'student.studentGroup:id,name',
        ]);

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

        $this->syncAssignmentCompletionStatus($submission->assignment);

        $submission->load([
            'assignment:id,title,subject_id,max_score',
            'assignment.subjectRelation:id,name',
            'student:id,login,group_id,last_name,first_name,middle_name,is_active',
            'student.studentGroup:id,name',
        ]);

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

        if (!$canDownload) {
            return response()->json(['message' => 'Недостаточно прав для скачивания файла.'], 403);
        }

        if (empty($submission->file_path) || !Storage::disk('public')->exists($submission->file_path)) {
            return response()->json(['message' => 'Файл не найден.'], 404);
        }

        return Storage::disk('public')->download(
            $submission->file_path,
            $submission->file_name ?: basename($submission->file_path)
        );
    }

    private function formatFileSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }
        return round($bytes / 1024, 1) . ' KB';
    }

    private function syncAssignmentCompletionStatus(?Assignment $assignment): void
    {
        if (!$assignment) {
            return;
        }
        $assignment->syncCompletionStatus();
    }

    private function resolveAllowedFormats(Assignment $assignment): array
    {
        $formats = collect($assignment->allowed_formats ?? [])
            ->map(fn ($format) => mb_strtolower(trim((string) $format)))
            ->filter()
            ->map(fn ($format) => ltrim($format, '.'))
            ->filter(fn ($format) => preg_match('/^[a-z0-9]+$/', $format))
            ->unique()
            ->values()
            ->all();

        return !empty($formats) ? $formats : self::DEFAULT_ALLOWED_FORMATS;
    }

    private function resolveMaxFileSizeKilobytes(Assignment $assignment): int
    {
        $maxFileSizeMb = (int) ($assignment->max_file_size ?? self::DEFAULT_MAX_FILE_SIZE_MB);
        if ($maxFileSizeMb <= 0) {
            $maxFileSizeMb = self::DEFAULT_MAX_FILE_SIZE_MB;
        }

        return $maxFileSizeMb * 1024;
    }

}
