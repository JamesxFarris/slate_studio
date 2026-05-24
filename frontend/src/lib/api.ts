// Typed fetch wrapper for the Slate backend.
//
// All requests go to relative `/api/*` URLs and include credentials so the
// express-session cookie rides on every call (auth requirement per
// SPECIFICATION.md → onboarding flow, single-user v1).
//
// We throw a typed ApiError on non-2xx so callers (TanStack Query, in
// particular) can react to status codes without re-parsing.

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// `object` rather than `Record<string, unknown>` so struct types like
// CreateRunRequest are assignable. JSON.stringify handles anything.
type RequestBody = object | undefined;

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: RequestBody
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Tolerate 204 No Content and empty bodies gracefully.
  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const message =
      parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, parsed);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: RequestBody) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: RequestBody) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// ---------- Endpoint helpers ----------
// Small typed surface so the rest of the app doesn't sprinkle string literals.

export interface MeResponse {
  id: string;
  email: string;
}

export const authApi = {
  me: () => api.get<MeResponse>('/api/auth/me'),
  login: (email: string, password: string) =>
    api.post<MeResponse>('/api/auth/login', { email, password }),
  logout: () => api.post<{ ok: true }>('/api/auth/logout'),
};

export interface CreateRunResponse {
  runId: string;
}

export interface CreateRunRequest {
  jdText: string;
  jdUrl?: string;
  mode: 'standard' | 'deep';
}

export const runsApi = {
  create: (body: CreateRunRequest) => api.post<CreateRunResponse>('/api/runs', body),
};
