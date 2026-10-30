// ============================================================
// SmartLivestock AI — Centralized HTTP API Client
// ============================================================

import { useAppStore } from '../store/appStore';

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
  const { timeoutMs = 6000, params, ...fetchInit } = options;
  const store = useAppStore.getState();
  const baseUrl = store.apiBaseUrl.replace(/\/+$/, '');

  // Build full URL with query parameters
  let fullUrl = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += `${fullUrl.includes('?') ? '&' : '?'}${queryString}`;
    }
  }

  // Setup abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl, {
      ...fetchInit,
      signal: options.signal || controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(fetchInit.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errBody: any = null;
      try {
        errBody = await response.json();
      } catch {
        // Not a JSON response
      }
      const message = errBody?.detail || errBody?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(message, response.status, response.statusText, errBody);
    }

    const data = await response.json();
    return data as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError(`Request to ${path} timed out after ${timeoutMs}ms`, 408, 'Request Timeout');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network request failed', 0, 'Network Error');
  }
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
};

