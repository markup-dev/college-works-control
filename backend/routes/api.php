<?php

use App\Http\Controllers\PlatformBannerController;
use App\Http\Controllers\Admin\AdminAssignmentController;
use App\Http\Controllers\Admin\BroadcastController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\GroupController as AdminGroupController;
use App\Http\Controllers\Admin\SpecialtyController;
use App\Http\Controllers\Admin\SubjectController as AdminSubjectController;
use App\Http\Controllers\Admin\SystemLogController;
use App\Http\Controllers\Admin\SystemSettingsController;
use App\Http\Controllers\Admin\TeacherDisciplineController as AdminTeacherDisciplineController;
use App\Http\Controllers\Admin\TeachingLoadController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AssignmentController;
use App\Http\Controllers\AssignmentTemplateController;
use App\Http\Controllers\SubmissionController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\TeacherBroadcastMessageController;
use App\Http\Controllers\TeacherDisciplineController;
use App\Http\Controllers\TeacherStudentController;
use Illuminate\Support\Facades\Route;

// Публичные маршруты
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

Route::get('/assignments/{assignment}/materials/{material}/users/{user}/download', [AssignmentController::class, 'downloadMaterialSigned'])
    ->middleware(['signed', 'throttle:60,1'])
    ->name('assignments.material.download');

// Защищённые маршруты (требуют авторизации)
Route::middleware(['auth:sanctum', 'user.active', 'throttle:api_user'])->group(function () {

    // Аутентификация
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/profile', [AuthController::class, 'profile']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/profile/password', [AuthController::class, 'changePassword']);
    Route::get('/platform-banner', [PlatformBannerController::class, 'show']);

    // Задания
    Route::get('/assignments', [AssignmentController::class, 'index']);
    Route::get('/assignments/meta', [AssignmentController::class, 'meta']);
    Route::get('/assignments/{assignment}', [AssignmentController::class, 'show']);
    Route::get('/assignments/{assignment}/materials/{material}/download-url', [AssignmentController::class, 'materialDownloadUrl']);
    Route::get('/assignments/{assignment}/materials/{material}/download', [AssignmentController::class, 'downloadMaterial']);

    // Задания — только для преподавателей
    Route::middleware('role:teacher')->group(function () {
        Route::get('/teacher/students', [TeacherStudentController::class, 'index']);
        Route::get('/teacher/students/{user}', [TeacherStudentController::class, 'show']);
        Route::get('/teacher/groups/overview', [TeacherStudentController::class, 'groupsOverview']);
        Route::get('/teacher/groups/{group}', [TeacherStudentController::class, 'groupDetails']);
        Route::get('/teacher/groups/{group}/students/{user}', [TeacherStudentController::class, 'studentDetails']);
        Route::post('/teacher/messages/broadcast', [TeacherBroadcastMessageController::class, 'store'])
            ->middleware('throttle:teacher_broadcast');
        Route::get('/teacher/disciplines', [TeacherDisciplineController::class, 'index']);
        Route::get('/teacher/disciplines/options', [TeacherDisciplineController::class, 'options']);
        Route::get('/teacher/disciplines/specialties/{specialty}/subjects', [TeacherDisciplineController::class, 'programSubjects']);
        Route::post('/teacher/discipline-requests', [TeacherDisciplineController::class, 'requestDiscipline']);
        Route::post('/teacher/teaching-load-requests', [TeacherDisciplineController::class, 'requestTeachingLoad']);

        Route::post('/assignments', [AssignmentController::class, 'store']);
        Route::put('/assignments/{assignment}', [AssignmentController::class, 'update']);
        Route::post('/assignments/{assignment}/materials', [AssignmentController::class, 'uploadMaterials']);
        Route::delete('/assignments/{assignment}', [AssignmentController::class, 'destroy']);

        Route::get('/assignment-bank', [AssignmentTemplateController::class, 'index']);
        Route::post('/assignment-bank/from-assignment/{assignment}', [AssignmentTemplateController::class, 'storeFromAssignment']);
        Route::post('/assignment-bank/{assignment_template}/publish', [AssignmentTemplateController::class, 'publish']);
        Route::post('/assignment-bank/{assignment_template}/materials', [AssignmentTemplateController::class, 'uploadMaterials']);
        Route::get('/assignment-bank/{assignment_template}/materials/{material}/download', [AssignmentTemplateController::class, 'downloadMaterial']);
        Route::get('/assignment-bank/{assignment_template}', [AssignmentTemplateController::class, 'show']);
        Route::put('/assignment-bank/{assignment_template}', [AssignmentTemplateController::class, 'update']);
        Route::delete('/assignment-bank/{assignment_template}', [AssignmentTemplateController::class, 'destroy']);
    });

    // Отправки работ
    Route::get('/submissions', [SubmissionController::class, 'index']);
    Route::get('/submissions/{submission}', [SubmissionController::class, 'show']);
    Route::get('/submissions/{submission}/download', [SubmissionController::class, 'download']);

    // Отправка работы — только для студентов
    Route::middleware('role:student')->group(function () {
        Route::post('/submissions', [SubmissionController::class, 'store']);
        Route::post('/submissions/chunks', [SubmissionController::class, 'uploadChunk']);
        Route::post('/submissions/chunks/complete', [SubmissionController::class, 'completeChunkedUpload']);
    });

    // Оценка и возврат — только для преподавателей
    Route::middleware('role:teacher')->group(function () {
        Route::put('/submissions/{submission}/grade', [SubmissionController::class, 'grade']);
        Route::put('/submissions/{submission}/return', [SubmissionController::class, 'returnSubmission']);
    });

    // Переписка студент ↔ преподаватель
    Route::middleware('role:student,teacher,admin')->group(function () {
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::delete('/notifications', [NotificationController::class, 'destroyAll']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    });

    Route::middleware('role:student,teacher')->group(function () {
        Route::get('/message-partners', [ConversationController::class, 'partners']);
        Route::get('/conversations/unread-total', [ConversationController::class, 'unreadTotal']);
        Route::get('/conversations', [ConversationController::class, 'index']);
        Route::post('/conversations', [ConversationController::class, 'store']);
        Route::get('/conversations/{conversation}/messages', [ConversationController::class, 'messages']);
        Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'sendMessage']);
        Route::post('/conversations/{conversation}/archive', [ConversationController::class, 'archive']);
        Route::post('/conversations/{conversation}/unarchive', [ConversationController::class, 'unarchive']);
    });

    // Админ-панель — только для администраторов
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/settings', [SystemSettingsController::class, 'systemSettings']);
        Route::put('/settings', [SystemSettingsController::class, 'updateSystemSettings']);

        Route::get('/stats', [DashboardController::class, 'stats']);

        Route::get('/users', [AdminUserController::class, 'users']);
        Route::get('/users/{user}/warnings-detail', [AdminUserController::class, 'adminUserWarningsDetail']);
        Route::post('/users', [AdminUserController::class, 'createUser']);
        Route::post('/users/{user}/reset-credentials', [AdminUserController::class, 'resetUserCredentials']);
        Route::put('/users/{user}', [AdminUserController::class, 'updateUser']);
        Route::delete('/users/{user}', [AdminUserController::class, 'deleteUser']);
        Route::get('/groups', [AdminGroupController::class, 'groups']);
        Route::get('/groups/specialties', [AdminGroupController::class, 'specialties']);
        Route::post('/groups/promote', [AdminGroupController::class, 'promoteBatch']);
        Route::get('/groups/{group}', [AdminGroupController::class, 'showGroup']);
        Route::post('/groups', [AdminGroupController::class, 'createGroup']);
        Route::put('/groups/{group}', [AdminGroupController::class, 'updateGroup']);
        Route::delete('/groups/{group}', [AdminGroupController::class, 'deleteGroup']);
        Route::delete('/groups/{group}/students/{user}', [AdminGroupController::class, 'detachStudentFromGroup']);

        Route::get('/specialties', [SpecialtyController::class, 'index']);
        Route::post('/specialties', [SpecialtyController::class, 'store']);
        Route::get('/specialties/{specialty}', [SpecialtyController::class, 'show']);
        Route::put('/specialties/{specialty}', [SpecialtyController::class, 'update']);
        Route::delete('/specialties/{specialty}', [SpecialtyController::class, 'destroy']);
        Route::put('/specialties/{specialty}/program', [SpecialtyController::class, 'syncProgram']);

        Route::get('/subjects', [AdminSubjectController::class, 'subjects']);
        Route::get('/subjects/{subject}', [AdminSubjectController::class, 'showSubject']);
        Route::post('/subjects', [AdminSubjectController::class, 'createSubject']);
        Route::put('/subjects/{subject}', [AdminSubjectController::class, 'updateSubject']);
        Route::delete('/subjects/{subject}', [AdminSubjectController::class, 'deleteSubject']);
        Route::post('/subjects/{subject}/teacher-allowances', [AdminTeacherDisciplineController::class, 'storeSubjectTeacherAllowance']);

        Route::get('/teachers/{teacher}/disciplines', [AdminTeacherDisciplineController::class, 'teacherSubjects']);
        Route::post('/teachers/{teacher}/disciplines', [AdminTeacherDisciplineController::class, 'storeTeacherSubject']);
        Route::delete('/teacher-disciplines/{teacherSubject}', [AdminTeacherDisciplineController::class, 'deleteTeacherSubject']);
        Route::get('/discipline-requests', [AdminTeacherDisciplineController::class, 'disciplineRequests']);
        Route::put('/discipline-requests/{teacherSubjectRequest}', [AdminTeacherDisciplineController::class, 'resolveDisciplineRequest']);
        Route::get('/teaching-load-requests', [AdminTeacherDisciplineController::class, 'teachingLoadRequests']);
        Route::put('/teaching-load-requests/{teachingLoadRequest}', [AdminTeacherDisciplineController::class, 'resolveTeachingLoadRequest']);

        Route::get('/teaching-loads/form-options', [TeachingLoadController::class, 'formOptions']);
        Route::post('/teaching-loads/batch', [TeachingLoadController::class, 'createTeachingLoadsBatch']);
        Route::put('/teaching-loads/sync-pair', [TeachingLoadController::class, 'syncTeachingLoadsForPair']);
        Route::get('/teaching-loads', [TeachingLoadController::class, 'teachingLoads']);
        Route::get('/teaching-loads/{teachingLoad}/detail', [TeachingLoadController::class, 'teachingLoadDetail']);
        Route::put('/teaching-loads/{teachingLoad}/transfer-teacher', [TeachingLoadController::class, 'transferTeachingLoadTeacher']);
        Route::post('/teaching-loads', [TeachingLoadController::class, 'createTeachingLoad']);
        Route::put('/teaching-loads/{teachingLoad}', [TeachingLoadController::class, 'updateTeachingLoad']);
        Route::delete('/teaching-loads/{teachingLoad}', [TeachingLoadController::class, 'deleteTeachingLoad']);

        Route::get('/homework', [AdminAssignmentController::class, 'adminAssignments']);
        Route::get('/assignments', [AdminAssignmentController::class, 'adminAssignments']);
        Route::get('/assignments/filter-options', [AdminAssignmentController::class, 'filterOptions']);
        Route::get('/assignments/{assignment}/eligible-teachers', [AdminAssignmentController::class, 'eligibleTeachersForAdminAssignment']);
        Route::get('/assignments/{assignment}', [AdminAssignmentController::class, 'showAdminAssignment']);
        Route::put('/assignments/{assignment}', [AdminAssignmentController::class, 'updateAdminAssignment']);
        Route::put('/assignments/{assignment}/teacher', [AdminAssignmentController::class, 'updateAdminAssignmentTeacher']);
        Route::delete('/assignments/{assignment}', [AdminAssignmentController::class, 'deleteAdminAssignment']);

        Route::get('/broadcasts', [BroadcastController::class, 'index']);
        Route::post('/broadcasts', [BroadcastController::class, 'store'])->middleware('throttle:6,1');
        Route::post('/broadcasts/{broadcast}/resend', [BroadcastController::class, 'resend'])->middleware('throttle:6,1');
        Route::get('/broadcasts/{broadcast}', [BroadcastController::class, 'show']);

        Route::get('/logs/export', [SystemLogController::class, 'exportLogsCsv']);
        Route::get('/logs', [SystemLogController::class, 'logs']);

        Route::middleware('throttle:admin_bulk')->group(function () {
            Route::post('/users/import/preview', [AdminUserController::class, 'previewUsersImport']);
            Route::post('/users/import', [AdminUserController::class, 'importUsers']);
            Route::post('/groups/import/preview', [AdminGroupController::class, 'previewGroupsImport']);
            Route::post('/groups/import', [AdminGroupController::class, 'importGroups']);
            Route::post('/groups/{group}/students/bulk', [AdminGroupController::class, 'bulkAttachStudentsToGroup']);
            Route::post('/subjects/import/preview', [AdminSubjectController::class, 'previewSubjectsImport']);
            Route::post('/subjects/import', [AdminSubjectController::class, 'importSubjects']);
        });
    });
});
