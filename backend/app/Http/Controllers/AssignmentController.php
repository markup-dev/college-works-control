<?php

namespace App\Http\Controllers;

use App\Models\Assignment;
use Illuminate\Http\Request;

class AssignmentController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'student') {
            $assignments = Assignment::with('teacher:id,name,login')
                ->whereHas('teacher', function ($q) use ($user) {
                    $q->where('login', $user->teacher_login);
                })
                ->whereRaw('JSON_CONTAINS(student_groups, ?)', [json_encode($user->group)])
                ->withCount([
                    'submissions',
                    'submissions as pending_count' => fn($q) => $q->where('status', 'submitted'),
                ])
                ->get();

            $assignments->transform(function ($assignment) use ($user) {
                $submission = $assignment->submissions()
                    ->where('student_id', $user->id)
                    ->latest('submitted_at')
                    ->first();

                $data = $assignment->toArray();
                unset($data['teacher']);
                $data['status'] = $submission ? $submission->status : 'not_submitted';
                $data['score'] = $submission?->score;
                $data['submitted_at'] = $submission?->submitted_at;
                $data['teacher'] = $assignment->teacher?->name ?? 'Не указан';

                return $data;
            });

            return response()->json($assignments);
        }

        if ($user->role === 'teacher') {
            $query = Assignment::where('teacher_id', $user->id);
        } else {
            $query = Assignment::query();
        }

        $query->with('teacher:id,name,login')
            ->withCount([
                'submissions',
                'submissions as pending_count' => fn($q) => $q->where('status', 'submitted'),
            ]);

        $mapAssignment = function ($assignment) {
            $data = $assignment->toArray();
            unset($data['teacher']);
            $data['teacher'] = $assignment->teacher?->name ?? 'Не указан';
            return $data;
        };

        if ($perPage = $request->integer('per_page')) {
            $paginated = $query->paginate($perPage);
            $paginated->getCollection()->transform($mapAssignment);
            return response()->json($paginated);
        }

        return response()->json($query->get()->map($mapAssignment));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'course' => 'required|string|max:255',
            'description' => 'nullable|string',
            'deadline' => 'required|date',
            'max_score' => 'nullable|integer|min:1',
            'submission_type' => 'nullable|string',
            'criteria' => 'nullable|array',
            'student_groups' => 'nullable|array',
            'priority' => 'nullable|in:low,medium,high',
            'allowed_formats' => 'nullable|array',
            'max_file_size' => 'nullable|integer',
        ]);

        $assignment = Assignment::create([
            ...$validated,
            'max_score' => $validated['max_score'] ?? 100,
            'submission_type' => $validated['submission_type'] ?? 'file',
            'priority' => $validated['priority'] ?? 'medium',
            'status' => 'active',
            'teacher_id' => $request->user()->id,
        ]);

        $assignment->load('teacher:id,name,login');

        return response()->json([
            'success' => true,
            'assignment' => $assignment,
        ], 201);
    }

    public function show(Assignment $assignment)
    {
        $assignment->load('teacher:id,name,login');
        $assignment->loadCount([
            'submissions',
            'submissions as pending_count' => fn($q) => $q->where('status', 'submitted'),
        ]);

        return response()->json($assignment);
    }

    public function update(Request $request, Assignment $assignment)
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'course' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'deadline' => 'sometimes|date',
            'status' => 'nullable|in:active,inactive,archived',
            'max_score' => 'nullable|integer|min:1',
            'submission_type' => 'nullable|string',
            'criteria' => 'nullable|array',
            'student_groups' => 'nullable|array',
            'priority' => 'nullable|in:low,medium,high',
            'allowed_formats' => 'nullable|array',
            'max_file_size' => 'nullable|integer',
        ]);

        $assignment->update($validated);

        return response()->json([
            'success' => true,
            'assignment' => $assignment->fresh()->load('teacher:id,name,login'),
        ]);
    }

    public function destroy(Assignment $assignment)
    {
        $assignment->delete();

        return response()->json(['success' => true]);
    }
}
