// Thin fetch wrapper that:
// - Always sends cookies (credentials: 'include') so visitor_session rides along
// - Parses the {detail, request_id} error envelope from the backend
// - Throws a typed ApiError that callers can discriminate on status code

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  status: number;
  detail: unknown;
  requestId: string | null;

  constructor(status: number, detail: unknown, requestId: string | null) {
    super(typeof detail === 'string' ? detail : `api error ${status}`);
    this.status = status;
    this.detail = detail;
    this.requestId = requestId;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers ?? {}),
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    credentials: 'include',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const requestId = res.headers.get('X-Request-ID');

  if (res.status === 204) {
    return undefined as T;
  }

  // Try to parse JSON either way — errors are JSON too
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON response (rare; only on misconfigured proxies)
  }

  if (!res.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? (payload as { detail: unknown }).detail
        : payload ?? res.statusText;
    throw new ApiError(res.status, detail, requestId);
  }

  return payload as T;
}