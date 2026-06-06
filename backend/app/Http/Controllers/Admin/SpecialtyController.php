<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Concerns\LogsAdminActions;
use App\Http\Controllers\Controller;
use App\Models\Specialty;
use App\Models\TeachingLoad;
use App\Services\SpecialtyProgramService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SpecialtyController extends Controller
{
    use LogsAdminActions;

    public function __construct(
        private readonly SpecialtyProgramService $programService,
    ) {}

    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        $query = Specialty::query()
            ->withCount(['groups', 'programSubjects']);

        if (! empty($validated['search'])) {
            $term = trim((string) $validated['search']);
            $query->where(fn ($q) => $q
                ->where('name', 'like', "%{$term}%")
                ->orWhere('code', 'like', "%{$term}%"));
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        return response()->json([
            'data' => $query->orderBy('name')->get(),
        ]);
    }

    public function show(Specialty $specialty)
    {
        $specialty->load([
            'programSubjects' => fn ($q) => $q
                ->with('subject:id,name,code,status')
                ->orderBy('course')
                ->orderBy('position')
                ->orderBy('id'),
            'programSnapshots' => fn ($q) => $q
                ->with(['items' => fn ($items) => $items
                    ->with('subject:id,name,code,status')
                    ->orderBy('course')
                    ->orderBy('position')
                    ->orderBy('id')])
                ->orderByDesc('effective_from')
                ->orderByDesc('id'),
            'groups' => fn ($q) => $q
                ->withCount('students')
                ->orderByDesc('admission_year')
                ->orderBy('name'),
        ]);

        $teacherCounts = TeachingLoad::query()
            ->whereIn('group_id', $specialty->groups->pluck('id'))
            ->where('status', 'active')
            ->selectRaw('group_id, COUNT(DISTINCT teacher_id) as teachers_count')
            ->groupBy('group_id')
            ->pluck('teachers_count', 'group_id');

        $specialty->groups->each(function ($group) use ($teacherCounts) {
            $group->teachers_count = (int) ($teacherCounts[$group->id] ?? 0);
        });

        return response()->json([
            'specialty' => $specialty,
            'program' => $specialty->programSubjects->groupBy('course')->map(fn ($items) => $items->values())->values(),
            'programHistory' => $specialty->programSnapshots,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32', 'regex:/^[А-ЯЁA-Za-z0-9_.-]+$/u', 'unique:specialties,code'],
            'name' => ['required', 'string', 'max:150', 'unique:specialties,name'],
            'study_years' => ['required', 'integer', 'min:1', 'max:6'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        $specialty = Specialty::create([
            'code' => trim((string) $validated['code']),
            'name' => trim((string) $validated['name']),
            'study_years' => (int) $validated['study_years'],
            'status' => $validated['status'] ?? 'active',
        ]);

        $this->log($request, 'create_specialty', "Создана специальность {$specialty->name}");

        return response()->json(['success' => true, 'specialty' => $specialty], 201);
    }

    public function update(Request $request, Specialty $specialty)
    {
        $validated = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:32', 'regex:/^[А-ЯЁA-Za-z0-9_.-]+$/u', Rule::unique('specialties', 'code')->ignore($specialty->id)],
            'name' => ['sometimes', 'required', 'string', 'max:150', Rule::unique('specialties', 'name')->ignore($specialty->id)],
            'study_years' => ['sometimes', 'required', 'integer', 'min:1', 'max:6'],
            'status' => ['nullable', 'in:active,archived'],
        ]);

        foreach (['code', 'name'] as $key) {
            if (array_key_exists($key, $validated)) {
                $validated[$key] = trim((string) $validated[$key]);
            }
        }

        $specialty->update($validated);
        $this->log($request, 'update_specialty', "Изменена специальность {$specialty->fresh()->name}");

        return response()->json(['success' => true, 'specialty' => $specialty->fresh()]);
    }

    public function syncProgram(Request $request, Specialty $specialty)
    {
        $validated = $request->validate([
            'items' => ['present', 'array'],
            'items.*.subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'items.*.course' => ['required', 'integer', 'min:1', 'max:6'],
            'items.*.position' => ['nullable', 'integer', 'min:0'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ]);

        $this->programService->syncProgram($specialty, $validated['items']);

        $this->log(
            $request,
            'sync_specialty_program',
            "Обновлена программа специальности {$specialty->name}: позиций ".count($validated['items'])
        );

        return $this->show($specialty->fresh());
    }

    public function destroy(Request $request, Specialty $specialty)
    {
        $specialty->update(['status' => 'archived']);
        $this->log($request, 'archive_specialty', "Архивирована специальность {$specialty->name}");

        return response()->json(['success' => true]);
    }
}
