'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, fmtTime } from '@/lib/client';

export default function NavBar({ role }) {
  const pathname = usePathname();
  const [notes, setNotes] = useState({ unread: 0, notifications: [] });
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const panelRef = useRef(null);

  async function loadNotes() {
    const r = await api('/api/notifications');
    if (r.ok) setNotes(r.data);
    if (role === 'ADMIN') {
      const f = await api('/api/admin/flags?status=PENDING&pageSize=1');
      if (f.ok) setPending(f.data.pendingCount);
    }
  }
  useEffect(() => {
    loadNotes();
    const t = setInterval(() => { if (!document.hidden) loadNotes(); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && notes.unread > 0) {
      await api('/api/notifications/read', { method: 'POST' });
      setTimeout(loadNotes, 1500);
    }
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const links = role === 'ADMIN'
    ? [['/admin', 'Console'], ['/admin/flags', 'Flag review'], ['/admin/rules', 'Rules']]
    : [['/projects', 'Projects']];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <span className="font-semibold text-brand">Craftory Portal</span>
        <nav aria-label="Main" className="flex flex-1 gap-1 overflow-x-auto">
          {links.map(([href, label]) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-brand text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                {label}
                {href === '/admin/flags' && pending > 0 && (
                  <span className="ml-2 rounded-full bg-amber-400 px-1.5 text-xs font-bold text-slate-900">{pending}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="relative" ref={panelRef}>
          <button onClick={toggle} aria-expanded={open} aria-label={`Notifications, ${notes.unread} unread`}
            className="relative rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Alerts
            {notes.unread > 0 && (
              <span className="ml-2 rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">{notes.unread}</span>
            )}
          </button>
          {open && (
            <div role="region" aria-label="Notifications"
              className="absolute right-0 mt-2 max-h-96 w-80 max-w-[90vw] overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
              {notes.notifications.length === 0 ? (
                <p className="p-3 text-sm text-slate-600">No notifications yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {notes.notifications.map((n) => (
                    <li key={n.id} className="p-3 text-sm">
                      <p className={n.read ? 'text-slate-700' : 'font-medium'}>{n.message}</p>
                      <p className="mt-1 text-xs text-slate-500">{fmtTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button onClick={logout} className="rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">Sign out</button>
      </div>
    </header>
  );
}
