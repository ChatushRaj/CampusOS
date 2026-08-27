const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Field-level messages, keyed by form field name. */
  readonly details?: Record<string, string>;

  constructor(status: number, message: string, code = 'error', details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * The access token lives in memory only. Storing it in localStorage would make it
 * readable by any injected script; the long-lived refresh token is an httpOnly cookie.
 */
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  onExpired: (handler: () => void) => {
    onUnauthorized = handler;
  },
};

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set automatically when passing FormData. */
  raw?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  // Collapse parallel 401s into a single refresh call.
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const data = await res.json();
      accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

async function send<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { body, raw, headers, ...rest } = options;
  const isFormData = body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(isFormData || raw ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Distinguish "the network failed" from "the server said no".
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', 'network_error');
  }

  if (response.status === 401 && !isRetry && !path.startsWith('/api/auth/')) {
    if (await refreshSession()) return send<T>(path, options, true);
    accessToken = null;
    onUnauthorized?.();
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.message ?? 'Something went wrong. Please try again.',
      error?.code ?? 'error',
      error?.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => send<T>(path),
  post: <T>(path: string, body?: unknown) => send<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => send<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => send<T>(path, { method: 'DELETE' }),
  /**
   * Multipart uploads go through the same pipeline as every other request, so they
   * respect the configured API origin and transparently retry after a token refresh.
   */
  upload: <T>(path: string, form: FormData, method: 'POST' | 'PATCH' = 'POST') => send<T>(path, { method, body: form }),
};

/** Serialises a query object, dropping empty values so the URL stays clean. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}
