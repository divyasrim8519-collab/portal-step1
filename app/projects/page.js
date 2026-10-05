'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtTime, IDENTITY_NOTICE } from '@/lib/client';
import { Loading, ErrorBox, Empty } from '@/components/ui';

export default function InboxPage() {
  const [state, setState] = useState('loading');
  const [projects, setProjects] = useState([]);

  const load = useCallback(async () => {
    const r = await api('/api/projects');
    if (r.ok) { setProjects(r.data.projects); setState('ready'); }
    else setState((s) => (s === 'ready' ? s : 'error'));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Your projects</h1>
      <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">{IDENTITY_NOTICE}</p>

      <div className="mt-6">
        {state === 'loading' && <Loading label="Loading your projects…" />}
        {state === 'error' && <ErrorBox message="We could not load your projects." onRetry={() => { setState('loading'); load(); }} />}
        {state === 'ready' && projects.length === 0 && (
          <Empty title="No projects assigned yet" hint="When an administrator assigns you to a project, it will appear here." />
        )}
        {state === 'ready' && projects.length > 0 && (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.projectId}>
                <Link href={`/projects/${p.projectId}`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold">{p.projectName}</h2>
                    {p.unreadCount > 0 && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white"
                        aria-label={`${p.unreadCount} unread messages`}>{p.unreadCount}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    You are <strong>{p.myAlias}</strong> · talking with <strong>{p.counterpartAlias || 'no one yet'}</strong>
                  </p>
                  <p className="mt-2 truncate text-sm text-slate-600">{p.lastMessagePreview || 'No messages yet'}</p>
                  {p.lastMessageAt && <p className="mt-1 text-xs text-slate-500">{fmtTime(p.lastMessageAt)}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
