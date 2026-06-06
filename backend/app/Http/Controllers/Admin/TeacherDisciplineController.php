<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\LogsAdminActions;
use App\Http\Controllers\Controller;
use App\Models\TeacherSubject;
use App\Models\TeacherSubjectRequest;
use App\Models\TeachingLoad;
use App\Models\TeachingLoadRequest;
use App\Services\AcademicProgramService;
use App\Services\AdminActionNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TeacherDisciplineController extends Controller
{
    use LogsAdminActions;

    public function teacherSubjects(int $teacherId)
    {
        $items = TeacherSubject::query()
            ->where('teacher_id', $teacherId)
            ->with('subject:id,name,code,status')
            ->orderBy('status')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function storeTeacherSubject(Request $request, int $teacherId, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'subject_id' => ['required', Rule::exists('subjects', 'id')->where(fn ($query) => $query->where('status', 'active'))],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $programs->assertActiveTeacher($teacherId);

        $item = TeacherSubject::updateOrCreate(
            [
                'teacher_id' => $teacherId,
                'subject_id' => (int) $validated['subject_id'],
            ],
            [
                'status' => $validated['status'] ?? 'active',
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]
        );

        $item->load(['teacher', 'subject']);
        if ($item->teacher) {
            app(AdminActionNotificationService::class)->notify(
                $item->teacher,
                $request->user(),
                $item->status === 'active' ? 'Вам добавлен допуск к дисциплине' : 'Допуск к дисциплине изменён',
                'Администратор '.($item->status === 'active' ? 'добавил' : 'изменил').' вам допуск к дисциплине «'.($item->subject?->name ?? 'Дисциплина').'».',
                [
                    'action' => 'teacher_subject_changed',
                    'subject_id' => $item->subject_id,
                ],
            );
        }

        $this->log(
            $request,
            'store_teacher_discipline',
            "Изменён допуск преподавателя {$item->teacher?->full_name}: {$item->subject?->name}, статус {$item->status}"
        );

        return response()->json(['success' => true, 'teacher_subject' => $item]);
    }

    public function deleteTeacherSubject(Request $request, TeacherSubject $teacherSubject)
    {
        $teacherSubject->update(['status' => 'inactive']);
        $teacherSubject->loadMissing(['teacher', 'subject']);
        if ($teacherSubject->teacher) {
            app(AdminActionNotificationService::class)->notify(
                $teacherSubject->teacher,
                $request->user(),
                'Допуск к дисциплине отключён',
                'Администратор отключил ваш допуск к дисциплине «'.($teacherSubject->subject?->name ?? 'Дисциплина').'».',
                [
                    'action' => 'teacher_subject_disabled',
                    'subject_id' => $teacherSubject->subject_id,
                ],
            );
        }
        $this->log($request, 'disable_teacher_discipline', "Отключен допуск преподавателя {$teacherSubject->teacher_id} к дисциплине {$teacherSubject->subject_id}");

        return response()->json(['success' => true]);
    }

    public function disciplineRequests(Request $request)
    {
        $status = $request->query('status');
        $query = TeacherSubjectRequest::query()
            ->with(['teacher:id,last_name,first_name,middle_name,login', 'subject:id,name,code']);

        if (in_array($status, ['pending', 'approved', 'rejected'], true)) {
            $query->where('status', $status);
        }

        return response()->json(['data' => $query->latest()->get()]);
    }

    public function resolveDisciplineRequest(Request $request, TeacherSubjectRequest $teacherSubjectRequest, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'admin_comment' => ['nullable', 'string', 'max:3000'],
        ]);

        DB::transaction(function () use ($request, $teacherSubjectRequest, $validated, $programs) {
            $teacherSubjectRequest->update([
                'status' => $validated['status'],
                'resolved_by' => $request->user()->id,
                'resolved_at' => now(),
                'admin_comment' => $validated['admin_comment'] ?? null,
            ]);

            if ($validated['status'] === 'approved') {
                $programs->assertActiveTeacher((int) $teacherSubjectRequest->teacher_id);

                if ($teacherSubjectRequest->subject?->status !== 'active') {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'subject_id' => 'Нельзя одобрить заявку по неактивной дисциплине.',
                    ]);
                }

                TeacherSubject::updateOrCreate(
                    [
                        'teacher_id' => $teacherSubjectRequest->teacher_id,
                        'subject_id' => $teacherSubjectRequest->subject_id,
                    ],
                    [
                        'status' => 'active',
                        'approved_by' => $request->user()->id,
                        'approved_at' => now(),
                    ]
                );
            }
        });

        $fresh = $teacherSubjectRequest->fresh(['teacher', 'subject']);
        if ($fresh?->teacher) {
            app(AdminActionNotificationService::class)->notify(
                $fresh->teacher,
                $request->user(),
                $validated['status'] === 'approved' ? 'Заявка на дисциплину одобрена' : 'Заявка на дисциплину отклонена',
                'Администратор '.($validated['status'] === 'approved' ? 'одобрил' : 'отклонил').' вашу заявку на дисциплину «'.($fresh->subject?->name ?? 'Дисциплина').'».',
                [
                    'action' => 'teacher_subject_request_resolved',
                    'subject_id' => $fresh->subject_id,
                    'request_status' => $fresh->status,
                ],
            );
        }

        $this->log(
            $request,
            'resolve_discipline_request',
            "Заявка на дисциплину {$fresh?->subject?->name} от {$fresh?->teacher?->full_name}: {$fresh?->status}"
        );

        return response()->json(['success' => true, 'request' => $fresh]);
    }

    public function teachingLoadRequests(Request $request)
    {
        $status = $request->query('status');
        $query = TeachingLoadRequest::query()
            ->with(['teacher:id,last_name,first_name,middle_name,login', 'subject:id,name,code', 'group:id,name,current_course,admission_year']);

        if (in_array($status, ['pending', 'approved', 'rejected'], true)) {
            $query->where('status', $status);
        }

        return response()->json(['data' => $query->latest()->get()]);
    }

    public function resolveTeachingLoadRequest(Request $request, TeachingLoadRequest $teachingLoadRequest, AcademicProgramService $programs)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'admin_comment' => ['nullable', 'string', 'max:3000'],
        ]);

        DB::transaction(function () use ($request, $teachingLoadRequest, $validated, $programs) {
            $loadId = null;
            if ($validated['status'] === 'approved') {
                $programs->assertTeachingLoadAllowed(
                    (int) $teachingLoadRequest->teacher_id,
                    (int) $teachingLoadRequest->subject_id,
                    (int) $teachingLoadRequest->group_id
                );

                $load = TeachingLoad::firstOrCreate(
                    [
                        'teacher_id' => $teachingLoadRequest->teacher_id,
                        'subject_id' => $teachingLoadRequest->subject_id,
                        'group_id' => $teachingLoadRequest->group_id,
                    ],
                    ['status' => 'active']
                );
                if ($load->status !== 'active') {
                    $load->update(['status' => 'active']);
                }
                $loadId = $load->id;
            }

            $teachingLoadRequest->update([
                'status' => $validated['status'],
                'resolved_by' => $request->user()->id,
                'resolved_at' => now(),
                'admin_comment' => $validated['admin_comment'] ?? null,
                'teaching_load_id' => $loadId,
            ]);
        });

        $fresh = $teachingLoadRequest->fresh(['teacher', 'subject', 'group']);
        if ($fresh?->teacher) {
            app(AdminActionNotificationService::class)->notify(
                $fresh->teacher,
                $request->user(),
                $validated['status'] === 'approved' ? 'Заявка на назначение одобрена' : 'Заявка на назначение отклонена',
                'Администратор '.($validated['status'] === 'approved' ? 'одобрил' : 'отклонил').' вашу заявку на назначение: «'.($fresh->subject?->name ?? 'Дисциплина').'», группа '.($fresh->group?->name ?? '—').'.',
                [
                    'action' => 'teaching_load_request_resolved',
                    'subject_id' => $fresh->subject_id,
                    'group_id' => $fresh->group_id,
                    'request_status' => $fresh->status,
                    'teaching_load_id' => $fresh->teaching_load_id,
                ],
            );
        }

        $this->log(
            $request,
            'resolve_teaching_load_request',
            "Заявка на назначение {$fresh?->subject?->name} / {$fresh?->group?->name} от {$fresh?->teacher?->full_name}: {$fresh?->status}"
        );

        return response()->json(['success' => true, 'request' => $fresh]);
    }
}
