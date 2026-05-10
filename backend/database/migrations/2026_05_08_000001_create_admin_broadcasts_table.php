<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** История массовых рассылок администратора (аудитория, тема, объём получателей). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_broadcasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('users')->cascadeOnDelete();
            $table->string('audience_type', 32);
            $table->json('group_ids')->nullable();
            $table->string('subject', 255);
            $table->text('body');
            $table->unsignedInteger('recipient_count')->default(0);
            $table->boolean('copy_email')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_broadcasts');
    }
};
