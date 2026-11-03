// ============================================================
// GouNandi AI — Centralized HTTP API Client with Auto-Failover
// ============================================================

import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';

export class ApiError extends Error {
  status: number;
  statusText: string;
  data: any;

  constructor(message: string, status: number, statusText: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeoutMs = 8000, params, ...fetchInit } = options;
  const store = useAppStore.getState();
  const rawBaseUrl = store.apiBaseUrl ? store.apiBaseUrl.replace(/\/+$/, '') : '';

  // Helper to build query string
  let queryString = '';
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    }
    queryString = searchParams.toString();
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const pathWithQuery = queryString ? `${cleanPath}?${queryString}` : cleanPath;

  // Retrieve JWT auth token if available
  const authHeaders: Record<string, string> = {};
  const token =
    useAuthStore.getState().token ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('gounandi_jwt_token') : null);
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(fetchInit.headers || {}),
  };

  // Build candidate URLs in order of preference:
  // 1. Configured base URL
  // 2. Relative path (uses Vite dev proxy to 8000)
  // 3. Fallback to direct http://127.0.0.1:8000 or http://localhost:8000
  const candidateUrls: string[] = [];

  if (rawBaseUrl) {
    candidateUrls.push(`${rawBaseUrl}${pathWithQuery}`);
    candidateUrls.push(pathWithQuery); // relative fallback
  } else {
    candidateUrls.push(pathWithQuery);
    candidateUrls.push(`http://127.0.0.1:8000${pathWithQuery}`);
    candidateUrls.push(`http://localhost:8000${pathWithQuery}`);
  }

  let lastError: any = null;

  for (let i = 0; i < candidateUrls.length; i++) {
    const targetUrl = candidateUrls[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        ...fetchInit,
        signal: options.signal || controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errBody: any = null;
        try {
          errBody = await response.json();
        } catch {
          // Non-JSON response
        }

        // Handle 401 Unauthorized for authenticated routes
        if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
          useAuthStore.getState().logout();
        }

        const message = errBody?.detail || errBody?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new ApiError(message, response.status, response.statusText, errBody);
      }

      const data = await response.json();
      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      // If the error was a real HTTP response error (like 400, 401, 409 Conflict, 403, 404),
      // DO NOT retry fallback URLs — throw the server's response immediately!
      if (err instanceof ApiError && err.status > 0) {
        throw err;
      }

      lastError = err;
      // Network failed on this candidate (e.g. Failed to fetch), try next candidate URL
    }
  }

  // If all candidate URLs failed with a network error
  if (lastError?.name === 'AbortError') {
    throw new ApiError(`Request to ${path} timed out after ${timeoutMs}ms`, 408, 'Request Timeout');
  }

  throw new ApiError(
    'Unable to connect to GouNandi backend (Port 8000). Please ensure the FastAPI server is running.',
    0,
    'Network Error'
  );
}

export const apiClient = {
  get: <T = any>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),

  post: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
