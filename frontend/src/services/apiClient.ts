
// ============================================================
// GouNandi AI — Centralized HTTP API Client
// Production: Render Backend
// Development: Local FastAPI Backend
// ============================================================

import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';

// ------------------------------------------------------------
// API CONFIGURATION
// ------------------------------------------------------------

export const PRODUCTION_API_URL = 'https://gou-nandi.onrender.com';

export function getEffectiveApiBaseUrl(): string {
  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0'
  );

  // 1. If running locally on development machine, ALWAYS use local backend
  if (isLocalHost) {
    const storeUrl = useAppStore.getState().apiBaseUrl?.trim().replace(/\/+$/, '');
    if (storeUrl && (storeUrl.includes('localhost') || storeUrl.includes('127.0.0.1'))) {
      return storeUrl;
    }
    if (window.location.port === '5173' || window.location.port === '8000') {
      return ''; // Use proxy or same-origin FastAPI
    }
    return 'http://127.0.0.1:8000';
  }

  // 2. If user explicitly configured an API URL in Settings store, respect it
  const storeUrl = useAppStore.getState().apiBaseUrl?.trim().replace(/\/+$/, '');
  if (storeUrl) {
    return storeUrl;
  }

  // 3. If build-time or runtime environment variable VITE_API_BASE_URL is provided
  const envUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (envUrl) {
    return envUrl;
  }

  // 4. Remote production deployment (e.g. gounandi.dpdns.org)
  return PRODUCTION_API_URL;
}

// ------------------------------------------------------------
// API ERROR CLASS
// ------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  statusText: string;
  data: any;

  constructor(
    message: string,
    status: number,
    statusText: string,
    data?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

// ------------------------------------------------------------
// REQUEST OPTIONS
// ------------------------------------------------------------

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  params?: Record<
    string,
    string | number | boolean | undefined | null
  >;
}

// ------------------------------------------------------------
// CENTRAL API REQUEST
// ------------------------------------------------------------

export async function apiRequest<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {

  const {
    timeoutMs = 30000,
    params,
    ...fetchInit
  } = options;

  const isDevelopment = import.meta.env.DEV;

  const rawBaseUrl = getEffectiveApiBaseUrl();

  // ----------------------------------------------------------
  // BUILD URL
  // ----------------------------------------------------------

  const cleanPath = path.startsWith('/')
    ? path
    : `/${path}`;

  let queryString = '';

  if (params) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }

    queryString = searchParams.toString();
  }

  const pathWithQuery = queryString
    ? `${cleanPath}?${queryString}`
    : cleanPath;

  // ----------------------------------------------------------
  // AUTHENTICATION TOKEN
  // ----------------------------------------------------------

  const token =
    useAuthStore.getState().token ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('gounandi_jwt_token')
      : null);

  const headers = new Headers(fetchInit.headers);

  headers.set('Accept', 'application/json');

  if (fetchInit.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // ----------------------------------------------------------
  // CANDIDATE URLS
  // ----------------------------------------------------------

  const candidateUrls: string[] = [
    `${rawBaseUrl}${pathWithQuery}`,
  ];

  // In production, NEVER use relative Vercel URLs or localhost
  // Local fallbacks ONLY during development when dev server is running.
  if (isDevelopment && rawBaseUrl !== '') {
    candidateUrls.push(pathWithQuery);
    candidateUrls.push(
      `http://localhost:8000${pathWithQuery}`
    );
  }

  // ----------------------------------------------------------
  // EXECUTE REQUEST
  // ----------------------------------------------------------

  let lastError: any = null;

  for (const targetUrl of candidateUrls) {

    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    try {

      console.log(
        `[GouNandi API] ${fetchInit.method || 'GET'} ${targetUrl}`
      );

      const response = await fetch(targetUrl, {
        ...fetchInit,
        headers,
        signal: options.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      // ------------------------------------------------------
      // PARSE RESPONSE
      // ------------------------------------------------------

      const contentType =
        response.headers.get('content-type') || '';

      let data: any = null;

      if (response.status !== 204) {
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
      }

      // ------------------------------------------------------
      // HANDLE HTTP ERRORS
      // ------------------------------------------------------

      if (!response.ok) {

        if (
          response.status === 401 &&
          !path.startsWith('/auth/login') &&
          !path.startsWith('/auth/register')
        ) {
          useAuthStore.getState().logout();
        }

        const message =
          data?.detail ||
          data?.message ||
          (typeof data === 'string' && data) ||
          `HTTP ${response.status}: ${response.statusText}`;

        throw new ApiError(
          message,
          response.status,
          response.statusText,
          data
        );
      }

      console.log(
        `[GouNandi API] Success: ${response.status}`
      );

      return data as T;

    } catch (error: any) {

      clearTimeout(timeoutId);

      // Server returned a real HTTP error.
      // Do not retry another URL.
      if (error instanceof ApiError) {
        throw error;
      }

      // External abort should not trigger fallback requests.
      if (options.signal?.aborted) {
        throw error;
      }

      lastError = error;

      console.error(
        `[GouNandi API] Request failed: ${targetUrl}`,
        error
      );

      // Retry only for network errors.
    }
  }

  // ----------------------------------------------------------
  // NETWORK ERROR
  // ----------------------------------------------------------

  if (lastError?.name === 'AbortError') {
    throw new ApiError(
      `Request to ${path} timed out.`,
      408,
      'Request Timeout'
    );
  }

  throw new ApiError(
    'Unable to connect to GouNandi backend. Please check Render service availability and API configuration.',
    0,
    'Network Error'
  );
}

// ------------------------------------------------------------
// API CLIENT METHODS
// ------------------------------------------------------------

export const apiClient = {

  get: <T = any>(
    path: string,
    options?: RequestOptions
  ) =>
    apiRequest<T>(path, {
      ...options,
      method: 'GET',
    }),

  post: <T = any>(
    path: string,
    body?: any,
    options?: RequestOptions
  ) =>
    apiRequest<T>(path, {
      ...options,
      method: 'POST',
      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined,
    }),

  put: <T = any>(
    path: string,
    body?: any,
    options?: RequestOptions
  ) =>
    apiRequest<T>(path, {
      ...options,
      method: 'PUT',
      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined,
    }),

  delete: <T = any>(
    path: string,
    options?: RequestOptions
  ) =>
    apiRequest<T>(path, {
      ...options,
      method: 'DELETE',
    }),
};
