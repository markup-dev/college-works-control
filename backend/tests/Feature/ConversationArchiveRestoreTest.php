<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Group;
use App\Models\Message;
use App\Models\Subject;
use App\Models\TeachingLoad;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ConversationArchiveRestoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_incoming_message_restores_archived_conversation_for_recipient(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher', 'is_active' => true]);
        $group = Group::create([
            'name' => 'ИСП-TEST',
            'status' => 'active',
            'current_course' => 1,
        ]);
        $student = User::factory()->create([
            'role' => 'student',
            'is_active' => true,
            'group_id' => $group->id,
        ]);
        $subject = Subject::create([
            'name' => 'Тестовая дисциплина',
            'code' => 'TST-101',
            'status' => 'active',
        ]);

        TeachingLoad::create([
            'teacher_id' => $teacher->id,
            'group_id' => $group->id,
            'subject_id' => $subject->id,
            'status' => 'active',
        ]);

        [$one, $two] = Conversation::orderedUserIds($teacher->id, $student->id);
        $conversation = Conversation::create([
            'user_one_id' => $one,
            'user_two_id' => $two,
        ]);

        Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $teacher->id,
            'body' => 'Первое сообщение',
        ]);

        Sanctum::actingAs($student);
        $this->postJson("/api/conversations/{$conversation->id}/archive")->assertOk();

        $conversation->refresh();
        $studentIsUserOne = (int) $conversation->user_one_id === (int) $student->id;
        $this->assertNotNull(
            $studentIsUserOne ? $conversation->user_one_archived_at : $conversation->user_two_archived_at,
        );

        Sanctum::actingAs($teacher);
        $this->postJson("/api/conversations/{$conversation->id}/messages", [
            'body' => 'Ответ преподавателя',
        ])->assertCreated();

        $conversation->refresh();
        $this->assertNull($conversation->user_one_archived_at);
        $this->assertNull($conversation->user_two_archived_at);

        Sanctum::actingAs($student);
        $this->getJson('/api/conversations?scope=active')
            ->assertOk()
            ->assertJsonPath('data.0.id', $conversation->id);

        $this->getJson('/api/conversations?scope=archived')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
