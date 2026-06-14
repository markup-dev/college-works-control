<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\Specialty;
use App\Models\SpecialtyProgramSubject;
use App\Models\Subject;
use App\Models\TeacherSubjectRequest;
use App\Models\TeachingLoadRequest;
use App\Services\AcademicProgramService;
use App\Services\TeacherRequestNotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TeacherDisciplineController extends Controller
{
    public function index(Request $request)
    {
        $teacher = $request->user();
        $teacher->load([
            'teacherSubjects.subject:id,name,code,status',
            'teachingLoads' => fn ($query) => $query
                ->where('status', 'active')
                ->with(['subject:id,name,code,status', 'group:id,name,current_course,admission_year,graduation_year']),
            'subjectRequests.subject:id,name,code',
            'teachingLoadRequests.subject:id,name,code',
            'teachingLoadRequests.group:id,name,current_course,admission_year,graduation_year',
        ]);

        return response()->json([
            'disciplines' => $teacher->teacherSubjects
                ->where('status', 'active')
                ->values(),
            'teaching_loads' => $teacher->teachingLoads
                ->sortBy(fn ($item) => ($item->subject?->name ?? '').' '.($item->group?->name ?? ''))
                ->values(),
            'discipline_requests' => $teacher->subjectRequests
                ->sortByDesc('created_at')
                ->values(),
            'teaching_load_requests' => $teacher->teachingLoadRequests
                ->sortByDesc('created_at')
                ->values(),
        ]);
    }

    public function options(Request $request)
    {
        $teacher = $request->user();
        $subjectIds = $teacher->teacherSubjects()
            ->where('status', 'active')
            ->pluck('subject_id');

        $subjects = Subject::query()
            ->where('status', 'active')
            ->whereIn('id', $subjectIds)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $specialties = Specialty::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'study_years']);

        $groups = Group::query()
            ->where('status', 'active')
            ->with(['activeGroupSubjects.subject:id,name,code'])
            ->orderBy('name')
            ->get(['id', 'name', 'specialty', 'current_course', 'admission_year', 'graduation_year']);

        return response()->json([
            'subjects' => $subjects,
            'specialties' => $specialties,
            'groups' => $groups,
        ]);
    }

    public function programSubjects(Specialty $specialty)
    {
        if ($specialty->status !== 'active') {
            return response()->json(['data' => []]);
        }

        $subjectIds = SpecialtyProgramSubject::query()
            ->where('specialty_id', $specialty->id)
            ->distinct()
            ->pluck('subject_id');

        if ($subjectIds->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $subjects = Subject::query()
            ->where('status', 'active')
            ->whereIn('id', $subjectIds)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json(['data' => $subjects]);
    }

    public function requestDiscipline(Request $request, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'subject_id' => ['required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
            'comment' => ['nullable', 'string', 'max:3000'],
            'document' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:5120'],
        ]);

        $programs->assertTeacherSubjectRequestAllowed(
            (int) $request->user()->id,
            (int) $validated['subject_id'],
        );

        $path = null;
        $name = null;
        $type = null;
        if ($request->hasFile('document')) {
            $file = $request->file('document');
            $path = $file->store('teacher-request-documents', 'public');
            $name = $file->getClientOriginalName();
            $type = $file->getClientMimeType();
        }

        $row = TeacherSubjectRequest::create([
            'teacher_id' => $request->user()->id,
            'subject_id' => (int) $validated['subject_id'],
            'comment' => $validated['comment'] ?? null,
            'document_path' => $path,
            'document_name' => $name,
            'document_type' => $type,
            'status' => 'pending',
        ]);

        $row->load(['subject', 'teacher']);
        app(TeacherRequestNotificationService::class)->notifyAdminsOfDisciplineRequest($row);

        return response()->json(['success' => true, 'request' => $row], 201);
    }

    public function requestTeachingLoad(Request $request, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'subject_id' => ['required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
            'group_id' => ['required', 'exists:groups,id'],
            'comment' => ['nullable', 'string', 'max:3000'],
            'document' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:5120'],
        ]);

        $programs->assertTeachingLoadRequestAllowed(
            (int) $request->user()->id,
            (int) $validated['subject_id'],
            (int) $validated['group_id'],
        );

        $path = null;
        $name = null;
        $type = null;
        if ($request->hasFile('document')) {
            $file = $request->file('document');
            $path = $file->store('teacher-request-documents', 'public');
            $name = $file->getClientOriginalName();
            $type = $file->getClientMimeType();
        }

        $row = TeachingLoadRequest::create([
            'teacher_id' => $request->user()->id,
            'subject_id' => (int) $validated['subject_id'],
            'group_id' => (int) $validated['group_id'],
            'comment' => $validated['comment'] ?? null,
            'document_path' => $path,
            'document_name' => $name,
            'document_type' => $type,
            'status' => 'pending',
        ]);

        $row->load(['subject', 'group', 'teacher']);
        app(TeacherRequestNotificationService::class)->notifyAdminsOfTeachingLoadRequest($row);

        return response()->json(['success' => true, 'request' => $row], 201);
    }
}
