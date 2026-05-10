<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Фабрика User для тестов: безопасный дефолтный пароль, роль student, логин уникальный через fake().
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'login' => 'user_'.fake()->unique()->numerify('##########'),
            'email' => fake()->unique()->safeEmail(),
            'email_notifications_enabled' => true,
            'password' => static::$password ??= Hash::make('password'),
            'last_name' => fake()->lastName(),
            'first_name' => fake()->firstName(),
            'middle_name' => fake()->optional(0.7)->firstName(),
            'role' => 'student',
            'group_id' => null,
            'department' => null,
            'phone' => null,
            'grade_scale' => null,
            'is_active' => true,
            'must_change_password' => false,
            'last_login' => null,
            'remember_token' => Str::random(10),
        ];
    }

    public function teacher(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'teacher',
            'group_id' => null,
        ]);
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'admin',
            'group_id' => null,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
