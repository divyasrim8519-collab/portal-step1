'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { Loading, ErrorBox, Empty, Badge, sevTone, statusTone, CATEGORY_LABEL, btn, btnGhost, inputCls } from '@/components/ui';

export default function FlagReviewPage() {
  const [filters, setFilters] = useState({ status: 'PENDING', category: '', severity: '', projectId: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
    const r = await api(`/api/admin/flags?${qs}`);
    if (r.ok) { setData(r.data); setError(''); } else setError('Could not load the review queue.');
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { api('/api/admin/projects').then((r) => r.ok && setProjects(r.data.projects)); }, []);

  const setF = (k) => (e) => { setPage(1); setData(null); setFilters({ ...filters, [k]: e.target.value }); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Flag review</h1>
          <p className="text-sm text-slate-700">A flag asks for human review. It does not establish wrongdoing.</p>
        </div>
        {data && <Badge tone={data.pendingCount ? 'amber' : 'green'}>{data.pendingCount} pending</Badge>}
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Status
          <select className={`${inputCls} mt-1 font-normal`} value={filters.status} onChange={setF('status')}>
            <option value="">All</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option><option value="DISMISSED">Dismissed</option>
          </select>
        </label>
        <label className="text-sm font-medium">Category
          <select className={`${inputCls} mt-1 font-normal`} value={filters.category} onChange={setF('category')}>
            <option value="">All</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Severity
          <select className={`${inputCls} mt-1 font-normal`} value={filters.severity} onChange={setF('severity')}>
            <option value="">All</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
          </select>
        </label>
        <label className="text-sm font-medium">Project
          <select className={`${inputCls} mt-1 font-normal`} value={filters.projectId} onChange={setF('projectId')}>
            <option value="">All</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4">
        {error && <ErrorBox message={error} onRetry={load} />}
        {!data && !error && <Loading label="Loading review queue…" />}
        {data && data.flags.length === 0 && <Empty title="Nothing to review" hint="No flags match these filters." />}
        {data && data.flags.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr><th className="p-3">Time</th><th className="p-3">Project</th><th className="p-3">Alias</th><th className="p-3">Category</th><th className="p-3">Severity</th><th className="p-3">Message state</th><th className="p-3">Review</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.flags.map((f) => (
                  <tr key={f.id} className="align-top">
                    <td className="whitespace-nowrap p-3">{fmtTime(f.createdAt)}</td>
                    <td className="p-3">{f.projectName}</td>
                    <td className="p-3">{f.senderAlias}</td>
                    <td className="p-3">{CATEGORY_LABEL[f.category]}<span className="block text-xs text-slate-600">{f.ruleName}</span></td>
                    <td className="p-3"><Badge tone={sevTone[f.severity]}>{f.severity}</Badge></td>
                    <td className="p-3"><Badge tone={f.messageStatus === 'HELD' ? 'amber' : f.messageStatus === 'REJECTED' ? 'red' : 'green'}>{f.messageStatus}</Badge></td>
                    <td className="p-3">
                      <Badge tone={statusTone[f.reviewStatus]}>{f.reviewStatus}</Badge>
                      <button className="ml-2 text-brand underline" onClick={() => setOpenId(f.id)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-700">Page {data.page} of {pages} · {data.total} flags</span>
            <div className="flex gap-2">
              <button className={btnGhost} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button className={btnGhost} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {openId && <Drawer flagId={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </main>
  );
}

function Drawer({ flagId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState({ type: '', text: '' });
  const closeRef = useRef(null);

  const load = useCallback(async () => {
    const r = await api(`/api/admin/flags/${flagId}`);
    if (r.ok) { setDetail(r.data); setError(''); } else setError('Could not load this flag.');
  }, [flagId]);
  useEffect(() => { setDetail(null); setResult({ type: '', text: '' }); setNote(''); load(); }, [load]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function decide(decision) {
    setBusy(true); setResult({ type: '', text: '' });
    const r = await api(`/api/admin/flags/${flagId}/decision`, { method: 'POST', body: JSON.stringify({ decision, note }) });
    setBusy(false);
    if (!r.ok) { setResult({ type: 'err', text: r.data?.error || 'The decision could not be saved.' }); return; }
    if (r.data.result === 'already_decided') setResult({ type: 'info', text: `Already decided (${r.data.flagStatus}). Nothing was changed.` });
    else setResult({ type: 'ok', text: `Decision saved: ${r.data.flagStatus}. Message is now ${r.data.messageStatus}.` });
    await load(); onChanged();
  }

  const f = detail?.flag;
  const pendingNow = f?.reviewStatus === 'PENDING';
  const canReject = pendingNow && f?.messageStatus === 'HELD';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Flag details" onClick={(e) => e.stopPropagation()}
        className="h-full w-full overflow-y-auto bg-white p-5 shadow-xl sm:max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">Review flag</h2>
          <button ref={closeRef} onClick={onClose} className={btnGhost}>Close</button>
        </div>
        {error && <div className="mt-4"><ErrorBox message={error} onRetry={load} /></div>}
        {!detail && !error && <Loading />}
        {f && (
          <div className="mt-4 space-y-5">
            <section className="space-y-1 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone={sevTone[f.severity]}>{f.severity}</Badge>
                <Badge>{CATEGORY_LABEL[f.category]}</Badge>
                <Badge tone={statusTone[f.reviewStatus]}>{f.reviewStatus}</Badge>
                <Badge tone={f.messageStatus === 'HELD' ? 'amber' : f.messageStatus === 'REJECTED' ? 'red' : 'green'}>Message {f.messageStatus}</Badge>
              </div>
              <p><strong>Project:</strong> {f.projectName}</p>
              <p><strong>Rule:</strong> {f.ruleName}</p>
              <p><strong>Reason:</strong> {f.reason}</p>
              {f.matchedText && <p><strong>Matched text:</strong> <code className="rounded bg-slate-100 px-1">{f.matchedText}</code></p>}
              {detail.otherFlagsOnMessage.length > 1 && (
                <p className="text-xs text-slate-700">This message has {detail.otherFlagsOnMessage.length} flags; one decision applies to all pending flags on it.</p>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-semibold">Conversation context</h3>
              <ul className="space-y-2">
                {detail.context.map((m) => (
                  <li key={m.id} className={`rounded-md border p-2 text-sm ${m.isFlagged ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
                    <p className="text-xs text-slate-700">
                      <strong>{m.senderAlias}</strong> = {m.senderRealName} ({m.senderEmail}) · {fmtTime(m.createdAt)} · {m.status}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 font-semibold">Decision</h3>
              {pendingNow ? (
                <>
                  <label htmlFor="note" className="block text-sm font-medium">Review note (optional)</label>
                  <textarea id="note" rows={3} maxLength={1000} className={`${inputCls} mt-1`} value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => decide('APPROVE')} className={`${btn} bg-green-700 text-white hover:bg-green-800`}>
                      {f.messageStatus === 'HELD' ? 'Approve & deliver' : 'Acknowledge'}
                    </button>
                    <button disabled={busy || !canReject} onClick={() => decide('REJECT')} className={`${btn} bg-red-700 text-white hover:bg-red-800`}>Reject</button>
                    <button disabled={busy} onClick={() => decide('DISMISS')} className={btnGhost}>Dismiss (false positive)</button>
                  </div>
                  {!canReject && <p className="mt-2 text-xs text-slate-600">Reject is only available for held messages; this one was already delivered.</p>}
                </>
              ) : (
                <p className="text-sm text-slate-700">
                  Decided: <strong>{f.reviewStatus}</strong>{f.reviewedAt ? ` on ${fmtTime(f.reviewedAt)}` : ''}.{f.reviewNote ? ` Note: “${f.reviewNote}”` : ''}
                </p>
              )}
              {result.text && (
                <p role={result.type === 'err' ? 'alert' : 'status'}
                  className={`mt-3 text-sm ${result.type === 'err' ? 'text-red-700' : result.type === 'info' ? 'text-slate-800' : 'text-green-800'}`}>{result.text}</p>
              )}
            </section>

            <section>
              <h3 className="mb-2 font-semibold">Audit history</h3>
              {detail.history.length === 0 ? <p className="text-sm text-slate-600">No decisions recorded yet.</p> : (
                <ul className="space-y-1 text-sm">
                  {detail.history.map((h) => (
                    <li key={h.id}>{fmtTime(h.createdAt)} · <strong>{h.action}</strong> by {h.actorName}{h.metadata?.note ? ` — “${h.metadata.note}”` : ''}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
