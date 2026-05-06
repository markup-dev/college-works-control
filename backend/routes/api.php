<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AssignmentController;
use App\Http\Controllers\SubmissionController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\TeacherBroadcastMessageController;
use App\Http\Controllers\TeacherStudentController;
use Illuminate\Support\Facades\Route;

// Публичные маршруты
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

// Защищённые маршруты (требуют авторизации)
Route::middleware(['auth:sanctum', 'throttle:api_user'])->group(function () {

    // Аутентификация
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/profile', [AuthController::class, 'profile']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/profile/password', [AuthController::class, 'changePassword']);

    // Задания
    Route::get('/assignments', [AssignmentController::class, 'index']);
    Route::get('/assignments/meta', [AssignmentController::class, 'meta']);
    Route::get('/assignments/{assignment}', [AssignmentController::class, 'show']);
    Route::get('/assignments/{assignment}/materials/{material}/download', [AssignmentController::class, 'downloadMaterial']);

    // Задания — только для преподавателей
    Route::middleware('role:teacher')->group(function () {
        Route::get('/teacher/students', [TeacherStudentController::class, 'index']);
        Route::get('/teacher/students/{user}', [TeacherStudentController::class, 'show']);
        Route::post('/teacher/messages/broadcast', [TeacherBroadcastMessageController::class, 'store'])
            ->middleware('throttle:teacher_broadcast');

        Route::post('/assignments', [AssignmentController::class, 'store']);
        Route::put('/assignments/{assignment}', [AssignmentController::class, 'update']);
        Route::post('/assignments/{assignment}/materials', [AssignmentController::class, 'uploadMaterials']);
        Route::delete('/assignments/{assignment}', [AssignmentController::class, 'destroy']);
    });

    // Отправки работ
    Route::get('/submissions', [SubmissionController::class, 'index']);
    Route::get('/submissions/{submission}/download', [SubmissionController::class, 'download']);

    // Отправка работы — только для студентов
    Route::middleware('role:student')->group(function () {
        Route::post('/submissions', [SubmissionController::class, 'store']);
    });

    // Оценка и возврат — только для преподавателей
    Route::middleware('role:teacher')->group(function () {
        Route::put('/submissions/{submission}/grade', [SubmissionController::class, 'grade']);
        Route::put('/submissions/{submission}/return', [SubmissionController::class, 'returnSubmission']);
    });

    // Переписка студент ↔ преподаватель
    Route::middleware('role:student,teacher')->group(function () {
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::delete('/notifications', [NotificationController::class, 'destroyAll']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);

        Route::get('/message-partners', [ConversationController::class, 'partners']);
        Route::get('/conversations', [ConversationController::class, 'index']);
        Route::post('/conversations', [ConversationController::class, 'store']);
        Route::get('/conversations/{conversation}/messages', [ConversationController::class, 'messages']);
        Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'sendMessage']);
        Route::post('/conversations/{conversation}/archive', [ConversationController::class, 'archive']);
        Route::post('/conversations/{conversation}/unarchive', [ConversationController::class, 'unarchive']);
    });

    // Админ-панель — только для администраторов
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/stats', [AdminController::class, 'stats']);

        Route::get('/users', [AdminController::class, 'users']);
        Route::post('/users', [AdminController::class, 'createUser']);
        Route::put('/users/{user}', [AdminController::class, 'updateUser']);
        Route::delete('/users/{user}', [AdminController::class, 'deleteUser']);
        Route::get('/groups', [AdminController::class, 'groups']);
        Route::post('/groups', [AdminController::class, 'createGroup']);
        Route::put('/groups/{group}', [AdminController::class, 'updateGroup']);
        Route::delete('/groups/{group}', [AdminController::class, 'deleteGroup']);

        Route::get('/subjects', [AdminController::class, 'subjects']);
        Route::post('/subjects', [AdminController::class, 'createSubject']);
        Route::put('/subjects/{subject}', [AdminController::class, 'updateSubject']);
        Route::delete('/subjects/{subject}', [AdminController::class, 'deleteSubject']);

        Route::get('/teaching-loads', [AdminController::class, 'teachingLoads']);
        Route::post('/teaching-loads', [AdminController::class, 'createTeachingLoad']);
        Route::put('/teaching-loads/{teachingLoad}', [AdminController::class, 'updateTeachingLoad']);
        Route::delete('/teaching-loads/{teachingLoad}', [AdminController::class, 'deleteTeachingLoad']);

        Route::get('/logs', [AdminController::class, 'logs']);

        Route::middleware('throttle:admin_bulk')->group(function () {
            Route::post('/users/import/preview', [AdminController::class, 'previewUsersImport']);
            Route::post('/users/import', [AdminController::class, 'importUsers']);
            Route::post('/groups/create-with-students', [AdminController::class, 'createGroupWithStudents']);
            Route::post('/groups/import/preview', [AdminController::class, 'previewGroupsImport']);
            Route::post('/groups/import', [AdminController::class, 'importGroups']);
            Route::post('/groups/{group}/students/bulk', [AdminController::class, 'bulkAttachStudentsToGroup']);
            Route::post('/subjects/import/preview', [AdminController::class, 'previewSubjectsImport']);
            Route::post('/subjects/import', [AdminController::class, 'importSubjects']);
        });
    });
});
