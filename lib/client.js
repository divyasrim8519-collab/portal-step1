// Browser-side helpers.
export async function api(url, opts = {}) {
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401 && typeof window !== 'undefined') window.location.href = '/login';
    return { ok: res.ok, status: res.status, data, network: false };
  } catch {
    return { ok: false, status: 0, data: null, network: true };
  }
}

export const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export const IDENTITY_NOTICE =
  'Your identity is hidden from other participants. Craftory Studio administrators may review conversations for project management and policy compliance.';
