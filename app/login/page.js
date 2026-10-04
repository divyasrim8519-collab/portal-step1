'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const fe = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) fe.email = 'Enter a valid email address';
    if (!password) fe.password = 'Enter your password';
    setFieldErrors(fe);
    setError('');
    if (Object.keys(fe).length) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not sign in. Try again.');
        setLoading(false);
        return;
      }
      window.location.href = data.role === 'ADMIN' ? '/admin' : '/projects';
    } catch {
      setError('Cannot reach the server. Check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Craftory Portal</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to your assigned projects.</p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          {error && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium">Email</label>
            <input
              id="email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
            {fieldErrors.email && <p className="mt-1 text-sm text-red-700">{fieldErrors.email}</p>}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">Password</label>
            <input
              id="password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
            {fieldErrors.password && <p className="mt-1 text-sm text-red-700">{fieldErrors.password}</p>}
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-600">
          Your identity is hidden from other participants. Craftory Studio administrators may review
          conversations for project management and policy compliance.
        </p>
      </div>
    </main>
  );
}
