<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Задания преподавателя: предмет, срок, тип сдачи, привязка к преподавателю и статус жизненного цикла. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignments', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->unsignedBigInteger('subject_id')->nullable()->index();
            $table->text('description')->nullable();
            $table->date('deadline');
            $table->enum('status', ['active', 'inactive', 'archived'])->default('active');
            $table->integer('max_score')->default(100);
            $table->string('submission_type')->default('file');
            $table->integer('max_file_size')->nullable();
            $table->foreignId('teacher_id')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignments');
    }
};
