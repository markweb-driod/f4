// Thin fetch wrapper. The JWT lives in sessionStorage (cleared when the tab closes) and is
// sent as a Bearer header - no persistent cookies (Section 3.4.1).
const KEY = 'securelearn.session';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveSession(s) {
  try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
export function tokenClaims(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part));
  } catch { return null; }
}

async function request(method, url, body, { raw = false } = {}) {
  const s = loadSession();
  const headers = {};
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  const res = await fetch(url, { method, headers, body: payload });
  if (raw && res.ok) return res;
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    if (res.status === 401 && s?.token && !url.endsWith('/auth/login')) onUnauthorized(msg);
    throw new ApiError(res.status, msg);
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  async download(url, fallbackName) {
    const res = await request('GET', url, undefined, { raw: true });
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const name = m ? decodeURIComponent(m[1]) : fallbackName || 'download';
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};
