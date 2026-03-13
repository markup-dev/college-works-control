<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'login' => 'required|string|unique:users,login',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'name' => 'required|string|max:255',
            'role' => 'required|in:student,teacher,admin',
            'group' => 'nullable|string',
            'department' => 'nullable|string',
            'teacher_login' => 'nullable|string',
        ]);

        $user = User::create([
            'login' => $validated['login'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'name' => $validated['name'],
            'role' => $validated['role'],
            'group' => $validated['group'] ?? null,
            'department' => $validated['department'] ?? null,
            'teacher_login' => $validated['teacher_login'] ?? null,
            'is_active' => true,
            'notifications' => ['email' => true, 'push' => true, 'sms' => false],
            'theme' => 'system',
        ]);

        return response()->json([
            'success' => true,
            'user' => $user,
        ], 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'login' => 'required|string',
            'password' => 'required|string',
            'role' => 'nullable|in:student,teacher,admin',
        ]);

        $user = User::where('login', $validated['login'])
            ->orWhere('email', $validated['login'])
            ->first();

        if (!$user || !$user->is_active) {
            throw ValidationException::withMessages([
                'login' => ['Неверный логин/email или пароль'],
            ]);
        }

        if (!empty($validated['role']) && $user->role !== $validated['role']) {
            throw ValidationException::withMessages([
                'role' => ["Этот аккаунт не является {$validated['role']}"],
            ]);
        }

        if (!Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['Неверный логин/email или пароль'],
            ]);
        }

        $user->update(['last_login' => now()]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['success' => true]);
    }

    public function profile(Request $request)
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string',
            'bio' => 'nullable|string',
            'timezone' => 'nullable|string',
            'theme' => 'nullable|in:light,dark,system',
            'notifications' => 'nullable|array',
        ]);

        $request->user()->update($validated);

        return response()->json([
            'success' => true,
            'user' => $request->user()->fresh(),
        ]);
    }

    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:6',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Текущий пароль указан неверно'],
            ]);
        }

        $user->update(['password' => $validated['new_password']]);

        return response()->json(['success' => true]);
    }
}
