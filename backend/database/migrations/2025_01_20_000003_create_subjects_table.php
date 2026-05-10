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

        Schema::table('assignments', function (Blueprint $table) {
            $table->foreign('subject_id')->references('id')->on('subjects')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropForeign(['subject_id']);
        });

        Schema::dropIfExists('subjects');
    }
};
