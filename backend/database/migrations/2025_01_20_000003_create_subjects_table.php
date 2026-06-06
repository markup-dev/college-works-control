<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Справочник дисциплин (код, название, статус). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subjects', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 32);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
            $table->unique('name');
            $table->unique('code');
        });

        Schema::create('specialty_program_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('specialty_id')->constrained('specialties')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->unsignedTinyInteger('course');
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('note')->nullable();
            $table->timestamps();
            $table->unique(['specialty_id', 'subject_id', 'course'], 'specialty_program_subject_unique');
            $table->index(['specialty_id', 'course']);
        });

        Schema::create('specialty_program_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('specialty_id')->constrained('specialties')->cascadeOnDelete();
            $table->date('effective_from');
            $table->date('effective_to');
            $table->timestamps();
            $table->index(['specialty_id', 'effective_from']);
        });

        Schema::create('specialty_program_snapshot_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('snapshot_id')->constrained('specialty_program_snapshots')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->unsignedTinyInteger('course');
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('note')->nullable();
            $table->timestamps();
            $table->index(['snapshot_id', 'course']);
        });

        Schema::create('group_subjects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignId('specialty_program_subject_id')->nullable()->constrained('specialty_program_subjects')->nullOnDelete();
            $table->unsignedTinyInteger('course');
            $table->unsignedSmallInteger('position')->default(0);
            $table->enum('status', ['active', 'completed', 'future'])->default('future');
            $table->timestamp('closed_at')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();
            $table->unique(['group_id', 'subject_id', 'course']);
            $table->index(['group_id', 'course', 'status']);
        });

        Schema::table('assignments', function (Blueprint $table) {
            $table->foreign('subject_id')->references('id')->on('subjects')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropForeign(['subject_id']);
        });

        Schema::dropIfExists('specialty_program_snapshot_items');
        Schema::dropIfExists('specialty_program_snapshots');
        Schema::dropIfExists('group_subjects');
        Schema::dropIfExists('specialty_program_subjects');
        Schema::dropIfExists('subjects');
    }
};
