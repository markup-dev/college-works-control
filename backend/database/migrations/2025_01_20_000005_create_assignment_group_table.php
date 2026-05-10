<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Связь задание ↔ группа: кому выдано задание (many-to-many). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignment_group', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->foreignId('group_id')->constrained('groups')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['assignment_id', 'group_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_group');
    }
};
