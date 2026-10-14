import { apiClient, ApiError } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TodoItem {
  _id: string;
  userId?: string;
  text: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
  isPending?: boolean;
  isDeleting?: boolean;
}

const TODO_CACHE_PREFIX = '@cache_todo_';

/**
 * Mirrors the cap enforced by app/api/todo/route.ts so oversized tasks fail
 * locally instead of round-tripping to a 400.
 */
export const MAX_TODO_TEXT_LENGTH = 500;

export const getTodoCacheKey = (userId: string = 'guest'): string => {
  return `${TODO_CACHE_PREFIX}${userId}`;
};

export async function getCachedTodos(userId: string = 'guest'): Promise<TodoItem[]> {
  try {
    const raw = await AsyncStorage.getItem(getTodoCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedTodos(todos: TodoItem[], userId: string = 'guest'): Promise<void> {
  try {
    // Strip ephemeral UI flags before caching
    const cleaned = todos.map(({ isPending, isDeleting, ...item }) => item);
    await AsyncStorage.setItem(getTodoCacheKey(userId), JSON.stringify(cleaned));
  } catch (err) {
    console.warn('[todo] Failed to cache todos:', err);
  }
}

/**
 * Fetch todos from GET /api/todo
 */
export async function fetchTodos(): Promise<TodoItem[]> {
  const result = await apiClient<TodoItem[]>('/api/todo');
  return Array.isArray(result) ? result : [];
}

/**
 * Create a new todo via POST /api/todo
 */
export async function createTodo(text: string): Promise<TodoItem> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ApiError('Task text is required', 400);
  }
  if (trimmed.length > MAX_TODO_TEXT_LENGTH) {
    throw new ApiError(`Task text must be ${MAX_TODO_TEXT_LENGTH} characters or fewer`, 400);
  }
  return await apiClient<TodoItem>('/api/todo', {
    method: 'POST',
    body: JSON.stringify({ text: trimmed }),
  });
}

/**
 * Update todo via PUT /api/todo
 */
export async function updateTodo(id: string, updates: { completed?: boolean; text?: string }): Promise<TodoItem> {
  if (!id) {
    throw new ApiError('Task ID is required', 400);
  }
  if (typeof updates.text === 'string' && updates.text.trim().length > MAX_TODO_TEXT_LENGTH) {
    throw new ApiError(`Task text must be ${MAX_TODO_TEXT_LENGTH} characters or fewer`, 400);
  }
  return await apiClient<TodoItem>('/api/todo', {
    method: 'PUT',
    body: JSON.stringify({ id, ...updates }),
  });
}

/**
 * Delete todo via DELETE /api/todo?id=:id
 */
export async function deleteTodo(id: string): Promise<{ message: string }> {
  if (!id) {
    throw new ApiError('Task ID is required', 400);
  }
  return await apiClient<{ message: string }>(`/api/todo?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
