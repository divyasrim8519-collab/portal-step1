'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Loading, ErrorBox, Badge, CATEGORY_LABEL, btnPrimary, inputCls } from '@/components/ui';

export default function RulesPage() {
  const [rules, setRules] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [form, setForm] = useState({ name: '', category: 'COMMERCIAL', pattern: '', severity: 'MEDIUM', action: 'ALLOW_AND_FLAG', description: '' });

  const load = useCallback(async () => {
    const r = await api('/api/admin/rules');
    if (r.ok) { setRules(r.data.rules); setError(''); } else setError('Could not load rules.');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function patch(rule, changes) {
    const r = await api(`/api/admin/rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
    setMsg(r.ok ? { type: 'ok', text: `Saved “${rule.name}”. Changes can take up to 30 seconds to apply everywhere.` }
                : { type: 'err', text: r.data?.error || 'Could not save the rule.' });
    load();
  }
  async function create(e) {
    e.preventDefault();
    const r = await api('/api/admin/rules', { method: 'POST', body: JSON.stringify(form) });
    if (r.ok) { setMsg({ type: 'ok', text: 'Rule added.' }); setForm({ ...form, name: '', pattern: '', description: '' }); load(); }
    else setMsg({ type: 'err', text: r.data?.error || 'Could not add the rule.' });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Moderation rules</h1>
      <p className="mt-1 text-sm text-slate-700">
        Contact-sharing rules always hold messages and cannot be disabled. For other categories choose “Allow &amp; flag” or “Hold for review”.
        Automated checks can miss attempts and can flag harmless messages.
      </p>
      {msg.text && <p role={msg.type === 'err' ? 'alert' : 'status'} className={`mt-3 text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-green-800'}`}>{msg.text}</p>}

      <div className="mt-4">
        {error && <ErrorBox message={error} onRetry={load} />}
        {!rules && !error && <Loading />}
        {rules && (
          <ul className="space-y-3">
            {rules.map((r) => {
              const locked = r.category === 'CONTACT_SHARING';
              return (
                <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{r.name} <Badge>{CATEGORY_LABEL[r.category]}</Badge></h2>
                      <p className="text-sm text-slate-700">{r.description}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" checked={r.isEnabled} disabled={locked} onChange={(e) => patch(r, { isEnabled: e.target.checked })} />
                      Enabled
                    </label>
                  </div>
                  <code className="mt-2 block overflow-x-auto rounded bg-slate-100 p-2 text-xs">{r.pattern}</code>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="text-sm font-medium">Action
                      <select className={`${inputCls} mt-1 font-normal`} value={r.action} disabled={locked}
                        onChange={(e) => patch(r, { action: e.target.value })}>
                        <option value="ALLOW_AND_FLAG">Allow &amp; flag</option><option value="HOLD">Hold for review</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">Severity
                      <select className={`${inputCls} mt-1 font-normal`} value={r.severity} onChange={(e) => patch(r, { severity: e.target.value })}>
                        <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                      </select>
                    </label>
                    {locked && <p className="self-end text-xs text-slate-600">Always held. Cannot be disabled.</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={create} className="mt-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Add a rule</h2>
        <label className="text-sm font-medium">Name<input className={`${inputCls} mt-1 font-normal`} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-sm font-medium">Category
          <select className={`${inputCls} mt-1 font-normal`} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">Pattern (regular expression, case-insensitive)
          <input className={`${inputCls} mt-1 font-mono font-normal`} required value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} />
        </label>
        <label className="text-sm font-medium">Action
          <select className={`${inputCls} mt-1 font-normal`} value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
            <option value="ALLOW_AND_FLAG">Allow &amp; flag</option><option value="HOLD">Hold for review</option>
          </select>
        </label>
        <label className="text-sm font-medium">Severity
          <select className={`${inputCls} mt-1 font-normal`} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">Description<input className={`${inputCls} mt-1 font-normal`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <div className="sm:col-span-2"><button className={btnPrimary}>Add rule</button></div>
      </form>
    </main>
  );
}
