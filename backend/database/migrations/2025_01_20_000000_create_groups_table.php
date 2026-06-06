<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Специальности и учебные группы студентов: курс, годы обучения, активность. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('specialties', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 150)->unique();
            $table->unsignedTinyInteger('study_years')->default(4);
            $table->enum('status', ['active', 'archived'])->default('active');
            $table->timestamp('program_updated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('specialty_id')->nullable()->constrained('specialties')->nullOnDelete();
            $table->string('specialty', 150)->nullable();
            $table->unsignedSmallInteger('admission_year')->nullable();
            $table->unsignedSmallInteger('graduation_year')->nullable();
            $table->unsignedTinyInteger('study_years')->default(4);
            $table->unsignedTinyInteger('current_course')->default(1);
            $table->enum('status', ['active', 'inactive', 'graduated'])->default('inactive');
            $table->timestamps();
            $table->unique(['name', 'admission_year']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('group_id')->references('id')->on('groups')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['group_id']);
        });

        Schema::dropIfExists('groups');
        Schema::dropIfExists('specialties');
    }
};
