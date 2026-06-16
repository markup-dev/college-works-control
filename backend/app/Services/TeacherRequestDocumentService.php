<?php

namespace App\Services;

use App\Models\TeacherRequestDocument;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TeacherRequestDocumentService
{
    public const MAX_FILES = 5;

    /**
     * @return array<string, mixed>
     */
    public function validationRules(): array
    {
        $fileRule = ['file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:5120'];

        return [
            'documents' => ['nullable', 'array', 'max:'.self::MAX_FILES],
            'documents.*' => $fileRule,
            'document' => ['nullable', ...$fileRule],
        ];
    }

    /**
     * @return list<UploadedFile>
     */
    public function collectUploadedFiles(Request $request): array
    {
        $files = [];

        if ($request->hasFile('documents')) {
            $uploaded = $request->file('documents');
            $files = is_array($uploaded) ? $uploaded : [$uploaded];
        }

        if ($request->hasFile('document')) {
            $files[] = $request->file('document');
        }

        return array_values(array_filter(
            $files,
            fn ($file) => $file instanceof UploadedFile,
        ));
    }

    /**
     * @param  list<UploadedFile>  $files
     */
    public function attachTo(Model $requestModel, array $files): void
    {
        if ($files === []) {
            return;
        }

        if (! method_exists($requestModel, 'documents')) {
            return;
        }

        if (count($files) > self::MAX_FILES) {
            throw ValidationException::withMessages([
                'documents' => 'Можно прикрепить не более '.self::MAX_FILES.' файлов.',
            ]);
        }

        foreach ($files as $index => $file) {
            $path = $file->store('teacher-request-documents', 'public');
            $requestModel->documents()->create([
                'path' => $path,
                'name' => $file->getClientOriginalName(),
                'type' => $file->getClientMimeType(),
                'sort_order' => $index,
            ]);
        }
    }

    public function authorizeDownload(TeacherRequestDocument $document, User $user): void
    {
        $requestModel = $document->documentable;

        if ($user->role === 'admin') {
            return;
        }

        if (
            $user->role === 'teacher'
            && $requestModel
            && (int) ($requestModel->teacher_id ?? 0) === (int) $user->id
        ) {
            return;
        }

        abort(403, 'Нет доступа к файлу.');
    }

    public function assertBelongsToRequest(
        TeacherRequestDocument $document,
        Model $requestModel,
    ): void {
        if (
            $document->documentable_type !== $requestModel::class
            || (int) $document->documentable_id !== (int) $requestModel->getKey()
        ) {
            abort(404, 'Файл не найден.');
        }
    }

    public function download(TeacherRequestDocument $document): StreamedResponse
    {
        if (! Storage::disk('public')->exists($document->path)) {
            abort(404, 'Файл не найден.');
        }

        return Storage::disk('public')->download(
            $document->path,
            $document->name ?: basename($document->path),
        );
    }
}
