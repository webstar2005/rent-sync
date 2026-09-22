// Never silently dial localhost in a production build — if VITE_API_BASE_URL is unset in prod the
// API is assumed to be same-origin (relative /api/* calls), which keeps secrets and topology local.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('property_app_token');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }

  // 204 No Content (e.g. successful DELETE) / 205 — no body to parse.
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Fetch a CSV endpoint with auth and trigger a browser download.
export async function downloadCsv(path: string, filename: string) {
  const token = localStorage.getItem('property_app_token');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function getApiHealth(): Promise<{ ok: boolean; status: number; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, message: payload?.message || payload?.status || 'Unknown API status' };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : 'API unreachable' };
  }
}
