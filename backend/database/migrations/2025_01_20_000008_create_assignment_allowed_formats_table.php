<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignment_allowed_formats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->string('format');
            $table->timestamps();

            $table->unique(['assignment_id', 'format']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_allowed_formats');
    }
};
