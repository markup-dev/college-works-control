<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AssignmentController;
use App\Http\Controllers\SubmissionController;
use App\Http\Controllers\AdminController;
use Illuminate\Support\Facades\Route;

// Публичные маршруты
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

// Защищённые маршруты (требуют авторизации)
Route::middleware('auth:sanctum')->group(function () {

    // Аутентификация
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/profile', [AuthController::class, 'profile']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/profile/password', [AuthController::class, 'changePassword']);

    // Задания
    Route::get('/assignments', [AssignmentController::class, 'index']);
    Route::get('/assignments/{assignment}', [AssignmentController::class, 'show']);

    // Задания — только для преподавателей
    Route::middleware('role:teacher')->group(function () {
        Route::post('/assignments', [AssignmentController::class, 'store']);
        Route::put('/assignments/{assignment}', [AssignmentController::class, 'update']);
        Route::delete('/assignments/{assignment}', [AssignmentController::class, 'destroy']);
    });

    // Отправки работ
    Route::get('/submissions', [SubmissionController::class, 'index']);

    // Отправка работы — только для студентов
    Route::middleware('role:student')->group(function () {
        Route::post('/submissions', [SubmissionController::class, 'store']);
    });

    // Оценка и возврат — только для преподавателей
    Route::middleware('role:teacher')->group(function () {
        Route::put('/submissions/{submission}/grade', [SubmissionController::class, 'grade']);
        Route::put('/submissions/{submission}/return', [SubmissionController::class, 'returnSubmission']);
    });

    // Админ-панель — только для администраторов
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/stats', [AdminController::class, 'stats']);

        Route::get('/users', [AdminController::class, 'users']);
        Route::post('/users', [AdminController::class, 'createUser']);
        Route::put('/users/{user}', [AdminController::class, 'updateUser']);
        Route::delete('/users/{user}', [AdminController::class, 'deleteUser']);

        Route::get('/courses', [AdminController::class, 'courses']);
        Route::post('/courses', [AdminController::class, 'createCourse']);
        Route::put('/courses/{course}', [AdminController::class, 'updateCourse']);
        Route::delete('/courses/{course}', [AdminController::class, 'deleteCourse']);

        Route::delete('/assignments/{assignment}', [AdminController::class, 'deleteAssignment']);

        Route::get('/logs', [AdminController::class, 'logs']);
    });
});
