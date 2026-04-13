<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('assignments')->onDelete('cascade');
            $table->foreignId('student_id')->constrained('users')->onDelete('cascade');
            $table->enum('status', ['submitted', 'graded', 'returned'])->default('submitted');
            $table->integer('score')->nullable();
            $table->text('comment')->nullable();
            $table->text('teacher_comment')->nullable();
            $table->json('criterion_scores')->nullable();
            $table->string('file_name')->nullable();
            $table->string('file_path')->nullable();
            $table->string('file_size')->nullable();
            $table->string('file_type')->nullable();
            $table->boolean('is_resubmission')->default(false);
            $table->foreignId('previous_submission_id')->nullable()->constrained('submissions')->onDelete('set null');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submissions');
    }
};
