<?php

namespace App\Http\Controllers;

use App\Models\Submission;
use App\Models\Assignment;
use Illuminate\Http\Request;

class SubmissionController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'student') {
            $query = Submission::where('student_id', $user->id);
        } elseif ($user->role === 'teacher') {
            $query = Submission::whereHas('assignment', fn($q) => $q->where('teacher_id', $user->id));
        } else {
            $query = Submission::query();
        }

        $submissions = $query
            ->with(['assignment:id,title,course,max_score', 'student:id,name,login,group'])
            ->latest('submitted_at')
            ->get()
            ->map(fn($sub) => [
                'id' => $sub->id,
                'assignment_id' => $sub->assignment_id,
                'assignment_title' => $sub->assignment?->title ?? '',
                'course' => $sub->assignment?->course ?? '',
                'max_score' => $sub->assignment?->max_score ?? 100,
                'student_id' => $sub->student_id,
                'student_name' => $sub->student?->name ?? '',
                'student_login' => $sub->student?->login ?? '',
                'group' => $sub->student?->group ?? '',
                'status' => $sub->status,
                'score' => $sub->score,
                'comment' => $sub->comment,
                'file_name' => $sub->file_name,
                'file_path' => $sub->file_path,
                'file_size' => $sub->file_size,
                'file_type' => $sub->file_type,
                'is_resubmission' => $sub->is_resubmission,
                'submission_date' => $sub->submitted_at,
                'created_at' => $sub->created_at,
            ]);

        return response()->json($submissions);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'assignment_id' => 'required|exists:assignments,id',
            'file' => 'required|file|max:51200',
        ]);

        $assignment = Assignment::findOrFail($validated['assignment_id']);

        $file = $request->file('file');
        $path = $file->store('submissions', 'public');

        $previousSubmission = Submission::where('assignment_id', $assignment->id)
            ->where('student_id', $request->user()->id)
            ->latest('submitted_at')
            ->first();

        $submission = Submission::create([
            'assignment_id' => $assignment->id,
            'student_id' => $request->user()->id,
            'status' => 'submitted',
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_size' => $this->formatFileSize($file->getSize()),
            'file_type' => $file->getClientMimeType(),
            'is_resubmission' => $previousSubmission !== null,
            'previous_submission_id' => $previousSubmission?->id,
            'submitted_at' => now(),
        ]);

        $submission->load(['assignment:id,title,course,max_score', 'student:id,name,login,group']);

        return response()->json([
            'success' => true,
            'submission' => $submission,
        ], 201);
    }

    public function grade(Request $request, Submission $submission)
    {
        $validated = $request->validate([
            'score' => 'required|integer|min:0',
            'comment' => 'nullable|string',
        ]);

        $submission->update([
            'status' => 'graded',
            'score' => $validated['score'],
            'comment' => $validated['comment'] ?? null,
        ]);

        $submission->load(['assignment:id,title,course,max_score', 'student:id,name,login,group']);

        return response()->json([
            'success' => true,
            'submission' => $submission,
        ]);
    }

    public function returnSubmission(Request $request, Submission $submission)
    {
        $validated = $request->validate([
            'comment' => 'nullable|string',
        ]);

        $submission->update([
            'status' => 'returned',
            'comment' => $validated['comment'] ?? null,
        ]);

        $submission->load(['assignment:id,title,course,max_score', 'student:id,name,login,group']);

        return response()->json([
            'success' => true,
            'submission' => $submission,
        ]);
    }

    private function formatFileSize(int $bytes): string
    {
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }
        return round($bytes / 1024, 1) . ' KB';
    }
}
