<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Банк шаблонов заданий преподавателя и дочерние таблицы критериев, форматов и файлов шаблона. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignment_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('teacher_id');
            $table->unsignedBigInteger('source_assignment_id')->nullable();
            $table->string('title');
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->text('description')->nullable();
            $table->string('submission_type')->default('file');
            $table->integer('max_file_size')->nullable();
            $table->timestamps();

            $table->foreign('teacher_id', 'asg_bnk_teach_fk')
                ->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('source_assignment_id', 'asg_bnk_src_asg_fk')
                ->references('id')->on('assignments')->nullOnDelete();
            $table->foreign('subject_id', 'asg_bnk_subj_fk')
                ->references('id')->on('subjects')
                ->nullOnDelete();

            $table->unique(
                ['teacher_id', 'source_assignment_id'],
                'assignment_templates_teacher_source_unique'
            );
        });

        Schema::create('assignment_template_criteria', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('assignment_template_id');
            $table->unsignedInteger('position')->default(0);
            $table->string('text');
            $table->unsignedInteger('max_points')->default(1);
            $table->timestamps();

            $table->foreign('assignment_template_id', 'asg_bnk_crit_fk')
                ->references('id')->on('assignment_templates')->cascadeOnDelete();
        });

        Schema::create('assignment_template_allowed_formats', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('assignment_template_id');
            $table->string('format');
            $table->timestamps();

            $table->foreign('assignment_template_id', 'asg_bnk_fmt_fk')
                ->references('id')->on('assignment_templates')->cascadeOnDelete();
            $table->unique(['assignment_template_id', 'format'], 'asg_bnk_fmt_uniq');
        });

        Schema::create('assignment_template_materials', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('assignment_template_id');
            $table->string('file_name');
            $table->string('file_path');
            $table->string('file_size', 32)->nullable();
            $table->string('file_type', 120)->nullable();
            $table->timestamps();

            $table->foreign('assignment_template_id', 'asg_bnk_mat_fk')
                ->references('id')->on('assignment_templates')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_template_materials');
        Schema::dropIfExists('assignment_template_allowed_formats');
        Schema::dropIfExists('assignment_template_criteria');
        Schema::dropIfExists('assignment_templates');
    }
};
