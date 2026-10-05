'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, fmtTime, newId, IDENTITY_NOTICE } from '@/lib/client';
import { Loading, ErrorBox, Badge, btnPrimary } from '@/components/ui';

export default function ChatPage({ params }) {
  const { projectId } = params;
  const [state, setState] = useState('loading'); // loading | ready | denied | error
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]); // {cid, body, state: 'sending'|'failed', error}
  const [info, setInfo] = useState({ name: '', myAlias: '', counterpartAlias: '' });
  const [text, setText] = useState('');
  const [formError, setFormError] = useState('');
  const deniedRef = useRef(false);
  const stickRef = useRef(true);
  const listRef = useRef(null);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    if (deniedRef.current) return;
    const r = await api(`/api/projects/${projectId}/messages`);
    if (r.status === 404) { deniedRef.current = true; setState('denied'); return; }
    if (!r.ok) { setState((s) => (s === 'ready' ? s : 'error')); return; }
    setMessages(r.data.messages);
    setInfo((i) => ({ ...i, myAlias: r.data.myAlias }));
    setState('ready');
  }, [projectId]);

  useEffect(() => {
    load();
    (async () => {
      const r = await api('/api/projects');
      const p = r.ok && r.data.projects.find((x) => x.projectId === projectId);
      if (p) setInfo({ name: p.projectName, myAlias: p.myAlias, counterpartAlias: p.counterpartAlias || '' });
    })();
    const t = setInterval(() => { if (!document.hidden) load(); }, 3000);
    return () => clearInterval(t);
  }, [load, projectId]);

  const serverCids = new Set(messages.map((m) => m.clientMessageId));
  const shownPending = pending.filter((p) => !serverCids.has(p.cid));
  const count = messages.length + shownPending.length;

  useEffect(() => {
    if (stickRef.current) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [count]);

  function onScroll() {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send(cid, body) {
    const r = await api(`/api/projects/${projectId}/messages`, {
      method: 'POST', body: JSON.stringify({ text: body, clientMessageId: cid }),
    });
    if (r.ok) {
      const m = r.data.message;
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setPending((p) => p.filter((x) => x.cid !== cid));
      stickRef.current = true;
    } else if (r.status === 404) {
      deniedRef.current = true; setState('denied');
    } else {
      const error = r.data?.error || (r.network ? 'No connection.' : 'Could not send.');
      setPending((p) => p.map((x) => (x.cid === cid ? { ...x, state: 'failed', error } : x)));
    }
  }

  function submit(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) { setFormError('Type a message first.'); return; }
    if (body.length > 2000) { setFormError('Messages can be up to 2000 characters.'); return; }
    setFormError('');
    const cid = newId();
    setPending((p) => [...p, { cid, body, state: 'sending' }]);
    setText('');
    stickRef.current = true;
    send(cid, body);
  }
  function retry(item) {
    setPending((p) => p.map((x) => (x.cid === item.cid ? { ...x, state: 'sending', error: '' } : x)));
    send(item.cid, item.body);
  }
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };

  if (state === 'loading') return <Loading label="Opening conversation…" />;
  if (state === 'denied') {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">You don’t have access to this project</h1>
        <p className="mt-2 text-sm text-slate-700">It may not exist, or your access may have been removed.</p>
        <Link href="/projects" className={`${btnPrimary} mt-6 inline-block`}>Back to my projects</Link>
      </main>
    );
  }
  if (state === 'error') {
    return <main className="mx-auto max-w-2xl px-4 py-8"><ErrorBox message="We could not load this conversation." onRetry={() => { setState('loading'); load(); }} /></main>;
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-3xl flex-col px-3 sm:px-4">
      <div className="py-3">
        <Link href="/projects" className="text-sm text-brand underline">← All projects</Link>
        <h1 className="text-lg font-semibold">{info.name || 'Project chat'}</h1>
        <p className="text-sm text-slate-700">
          You are <strong>{info.myAlias}</strong>{info.counterpartAlias && <> · talking with <strong>{info.counterpartAlias}</strong></>}
        </p>
        <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-950">{IDENTITY_NOTICE}</p>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3"
        role="log" aria-live="polite" aria-label="Messages">
        {count === 0 && <p className="py-10 text-center text-sm text-slate-600">No messages yet. Say hello!</p>}
        {messages.map((m) => <Bubble key={m.id} mine={m.isMine} alias={m.senderAlias} body={m.body} time={m.deliveredAt || m.createdAt} status={m.status} />)}
        {shownPending.map((p) => (
          <Bubble key={p.cid} mine alias={info.myAlias} body={p.body} local={p.state} error={p.error} onRetry={() => retry(p)} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="py-3">
        {formError && <p role="alert" className="mb-1 text-sm text-red-700">{formError}</p>}
        <div className="flex items-end gap-2">
          <label htmlFor="composer" className="sr-only">Message</label>
          <textarea id="composer" rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
            placeholder="Write a message (Enter to send, Shift+Enter for a new line)"
            className="min-h-[2.75rem] flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm" maxLength={2100} />
          <button type="submit" className={btnPrimary}>Send</button>
        </div>
        {text.length > 1800 && <p className="mt-1 text-xs text-slate-600">{text.length}/2000</p>}
      </form>
    </main>
  );
}

function Bubble({ mine, alias, body, time, status, local, error, onRetry }) {
  const held = status === 'HELD';
  const rejected = status === 'REJECTED';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-brand text-white' : 'border border-slate-200 bg-slate-50 text-ink'}`}>
        <p className={`text-xs font-semibold ${mine ? 'text-sky-100' : 'text-slate-600'}`}>{mine ? `${alias} (you)` : alias}</p>
        <p className="mt-1 whitespace-pre-wrap break-words">{body}</p>
        <div className={`mt-1 text-xs ${mine ? 'text-sky-100' : 'text-slate-500'}`}>
          {local === 'sending' && <span>Sending…</span>}
          {local === 'failed' && (
            <span>
              Failed{error ? `: ${error}` : ''}{' '}
              <button onClick={onRetry} className="ml-1 rounded bg-white px-2 py-0.5 font-semibold text-red-800 underline">Retry</button>
            </span>
          )}
          {!local && time && <span>{fmtTime(time)}{mine && status === 'DELIVERED' ? ' · Delivered' : ''}</span>}
        </div>
        {mine && held && (
          <div className="mt-2 rounded bg-amber-100 p-2 text-xs text-amber-950">
            <Badge tone="amber">Held for review</Badge>
            <p className="mt-1">An administrator needs to review this message. The other person cannot see it yet.</p>
          </div>
        )}
        {mine && rejected && (
          <div className="mt-2 rounded bg-red-100 p-2 text-xs text-red-950">
            <Badge tone="red">Not delivered</Badge>
            <p className="mt-1">This message was reviewed and was not delivered.</p>
          </div>
        )}
      </div>
    </div>
  );
}
