<?php

namespace App\Services;

use App\Models\Specialty;
use App\Models\SpecialtyProgramSnapshot;
use App\Models\SpecialtyProgramSnapshotItem;
use App\Models\SpecialtyProgramSubject;
use App\Models\Subject;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SpecialtyProgramService
{
    /**
     * @param  list<array{subject_id:int,course:int,position?:int,note?:string|null}>  $items
     */
    public function syncProgram(Specialty $specialty, array $items): Specialty
    {
        $normalizedIncoming = $this->normalizeItems($items);
        $this->assertValidItems($normalizedIncoming);

        return DB::transaction(function () use ($specialty, $normalizedIncoming) {
            $specialty->load(['programSubjects' => fn ($q) => $q->orderBy('course')->orderBy('position')->orderBy('id')]);

            $currentItems = $this->normalizeProgramSubjects($specialty->programSubjects);
            $hasChanges = $this->itemsSignature($currentItems) !== $this->itemsSignature($normalizedIncoming);

            if ($hasChanges && $specialty->programSubjects->isNotEmpty()) {
                $this->storeSnapshot($specialty, $specialty->programSubjects);
            }

            SpecialtyProgramSubject::query()
                ->where('specialty_id', $specialty->id)
                ->delete();

            foreach ($normalizedIncoming as $index => $item) {
                SpecialtyProgramSubject::create([
                    'specialty_id' => $specialty->id,
                    'subject_id' => $item['subject_id'],
                    'course' => $item['course'],
                    'position' => $item['position'] ?? $index,
                    'note' => $item['note'],
                ]);
            }

            if ($hasChanges || ! $specialty->program_updated_at) {
                $specialty->update(['program_updated_at' => now()]);
            }

            return $specialty->fresh();
        });
    }

    /**
     * @param  Collection<int, SpecialtyProgramSubject>  $programSubjects
     */
    private function storeSnapshot(Specialty $specialty, Collection $programSubjects): void
    {
        $effectiveFrom = ($specialty->program_updated_at ?? $specialty->created_at)->toDateString();
        $effectiveTo = now()->toDateString();

        if ($effectiveFrom > $effectiveTo) {
            $effectiveFrom = $effectiveTo;
        }

        $snapshot = SpecialtyProgramSnapshot::create([
            'specialty_id' => $specialty->id,
            'effective_from' => $effectiveFrom,
            'effective_to' => $effectiveTo,
        ]);

        foreach ($programSubjects as $index => $row) {
            SpecialtyProgramSnapshotItem::create([
                'snapshot_id' => $snapshot->id,
                'subject_id' => $row->subject_id,
                'course' => $row->course,
                'position' => $row->position ?? $index,
                'note' => $row->note,
            ]);
        }
    }

    /**
     * @param  list<array{subject_id:int,course:int,position?:int,note?:string|null}>  $items
     * @return list<array{subject_id:int,course:int,position:int,note:?string}>
     */
    private function normalizeItems(array $items): array
    {
        return collect($items)
            ->map(fn (array $item) => [
                'subject_id' => (int) $item['subject_id'],
                'course' => (int) $item['course'],
                'position' => (int) ($item['position'] ?? 0),
                'note' => array_key_exists('note', $item) && $item['note'] !== null && $item['note'] !== ''
                    ? (string) $item['note']
                    : null,
            ])
            ->sortBy(fn (array $item) => [$item['course'], $item['position'], $item['subject_id']])
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, SpecialtyProgramSubject>  $programSubjects
     * @return list<array{subject_id:int,course:int,position:int,note:?string}>
     */
    private function normalizeProgramSubjects(Collection $programSubjects): array
    {
        return $programSubjects
            ->map(fn (SpecialtyProgramSubject $row) => [
                'subject_id' => (int) $row->subject_id,
                'course' => (int) $row->course,
                'position' => (int) $row->position,
                'note' => $row->note,
            ])
            ->sortBy(fn (array $item) => [$item['course'], $item['position'], $item['subject_id']])
            ->values()
            ->all();
    }

    /**
     * @param  list<array{subject_id:int,course:int,position:int,note:?string}>  $items
     */
    private function itemsSignature(array $items): string
    {
        return json_encode($items, JSON_THROW_ON_ERROR);
    }

    /**
     * @param  list<array{subject_id:int,course:int,position:int,note:?string}>  $items
     */
    private function assertValidItems(array $items): void
    {
        if ($items === []) {
            return;
        }

        $subjectIds = collect($items)->pluck('subject_id')->unique()->values();
        $activeCount = Subject::query()
            ->whereIn('id', $subjectIds)
            ->where('status', 'active')
            ->count();

        if ($activeCount !== $subjectIds->count()) {
            throw ValidationException::withMessages([
                'items' => 'В программу можно добавлять только активные дисциплины.',
            ]);
        }

        $pairs = collect($items)->map(fn (array $item) => $item['course'].':'.$item['subject_id']);
        if ($pairs->count() !== $pairs->unique()->count()) {
            throw ValidationException::withMessages([
                'items' => 'На одном курсе не может быть две одинаковые дисциплины.',
            ]);
        }
    }
}
