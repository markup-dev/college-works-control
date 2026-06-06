<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Допуски преподавателей, заявки и преподавательская нагрузка: кто ведёт какую дисциплину у какой группы. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->unique(['teacher_id', 'subject_id']);
            $table->index(['teacher_id', 'status']);
        });

        Schema::create('teacher_subject_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->text('comment')->nullable();
            $table->string('document_path')->nullable();
            $table->string('document_name')->nullable();
            $table->string('document_type', 120)->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('admin_comment')->nullable();
            $table->timestamps();
            $table->index(['teacher_id', 'status']);
            $table->index(['subject_id', 'status']);
        });

        Schema::create('teaching_loads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
            $table->unique(['teacher_id', 'subject_id', 'group_id']);
        });

        Schema::create('teaching_load_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->text('comment')->nullable();
            $table->string('document_path')->nullable();
            $table->string('document_name')->nullable();
            $table->string('document_type', 120)->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('admin_comment')->nullable();
            $table->foreignId('teaching_load_id')->nullable()->constrained('teaching_loads')->nullOnDelete();
            $table->timestamps();
            $table->index(['teacher_id', 'status']);
            $table->index(['group_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teaching_load_requests');
        Schema::dropIfExists('teaching_loads');
        Schema::dropIfExists('teacher_subject_requests');
        Schema::dropIfExists('teacher_subjects');
    }
};
