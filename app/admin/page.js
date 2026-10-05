'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { Loading, ErrorBox, Empty, Badge, btnPrimary, btnGhost, inputCls } from '@/components/ui';

const TABS = ['Users', 'Projects & assignments', 'Audit log'];

export default function AdminConsole() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <p className="mt-1 text-sm text-slate-700">Real identities are visible here only. Participants see aliases.</p>
      <div role="tablist" aria-label="Admin sections" className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? 'border-brand text-brand' : 'border-transparent text-slate-700 hover:text-ink'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="mt-6" role="tabpanel">
        {tab === TABS[0] && <UsersTab />}
        {tab === TABS[1] && <ProjectsTab />}
        {tab === TABS[2] && <AuditTab />}
      </div>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-1 font-normal">{children}</div>
    </label>
  );
}

/* ---------------- Users ---------------- */
function UsersTab() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ realName: '', email: '', phone: '', password: '', role: 'CLIENT' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api('/api/admin/users');
    if (r.ok) { setUsers(r.data.users); setError(''); } else setError('Could not load users.');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    setBusy(true); setMsg({ type: '', text: '' });
    const r = await api('/api/admin/users', { method: 'POST', body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) {
      setMsg({ type: 'ok', text: `Account created for ${r.data.user.email}.` });
      setForm({ realName: '', email: '', phone: '', password: '', role: 'CLIENT' });
      load();
    } else setMsg({ type: 'err', text: r.data?.error || 'Could not create the account.' });
  }
  async function toggle(u) {
    const r = await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !u.isActive }) });
    if (!r.ok) setMsg({ type: 'err', text: r.data?.error || 'Could not update the account.' });
    else setMsg({ type: 'ok', text: `${u.email} ${u.isActive ? 'deactivated' : 'reactivated'}.` });
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={create} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 lg:col-span-1">
        <h2 className="font-semibold">Create account</h2>
        <Field label="Full name"><input className={inputCls} required value={form.realName} onChange={(e) => setForm({ ...form, realName: e.target.value })} /></Field>
        <Field label="Email"><input className={inputCls} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone (optional)"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Temporary password (min 8)"><input className={inputCls} type="password" minLength={8} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Field label="Role">
          <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="CLIENT">Client</option><option value="EMPLOYEE">Employee</option><option value="ADMIN">Admin</option>
          </select>
        </Field>
        {msg.text && <p role={msg.type === 'err' ? 'alert' : 'status'} className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-green-800'}`}>{msg.text}</p>}
        <button className={btnPrimary} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>

      <section className="lg:col-span-2">
        <h2 className="mb-2 font-semibold">All accounts</h2>
        {error && <ErrorBox message={error} onRetry={load} />}
        {!users && !error && <Loading />}
        {users && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3 font-medium">{u.realName}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.role}</td>
                    <td className="p-3"><Badge tone={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge></td>
                    <td className="p-3 text-right"><button className={btnGhost} onClick={() => toggle(u)}>{u.isActive ? 'Deactivate' : 'Reactivate'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- Projects & assignments ---------------- */
function ProjectsTab() {
  const [projects, setProjects] = useState(null);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignId, setAssignId] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  const loadList = useCallback(async () => {
    const [p, u] = await Promise.all([api('/api/admin/projects'), api('/api/admin/users')]);
    if (p.ok && u.ok) { setProjects(p.data.projects); setUsers(u.data.users); setError(''); } else setError('Could not load projects.');
  }, []);
  const loadDetail = useCallback(async (id) => {
    const r = await api(`/api/admin/projects/${id}`);
    if (r.ok) setDetail(r.data.project); else setMsg({ type: 'err', text: 'Could not load project details.' });
  }, []);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (selected) { setDetail(null); loadDetail(selected); } }, [selected, loadDetail]);

  async function createProject(e) {
    e.preventDefault();
    const r = await api('/api/admin/projects', { method: 'POST', body: JSON.stringify({ name, description }) });
    if (r.ok) { setName(''); setDescription(''); setMsg({ type: 'ok', text: 'Project created.' }); loadList(); setSelected(r.data.project.id); }
    else setMsg({ type: 'err', text: r.data?.error || 'Could not create the project.' });
  }
  async function assign(e) {
    e.preventDefault();
    if (!assignId) return;
    const r = await api(`/api/admin/projects/${selected}/members`, { method: 'POST', body: JSON.stringify({ userId: assignId }) });
    if (r.ok) { setMsg({ type: 'ok', text: `Assigned as ${r.data.membership.alias}.` }); setAssignId(''); loadDetail(selected); loadList(); }
    else setMsg({ type: 'err', text: r.data?.error || 'Could not assign this user.' });
  }
  async function revoke(m) {
    if (!window.confirm(`Revoke access for ${m.user.realName}? They will lose access immediately.`)) return;
    const r = await api(`/api/admin/memberships/${m.id}`, { method: 'DELETE' });
    if (r.ok) { setMsg({ type: 'ok', text: 'Access revoked.' }); loadDetail(selected); loadList(); }
    else setMsg({ type: 'err', text: r.data?.error || 'Could not revoke access.' });
  }

  const activeIds = new Set((detail?.members || []).filter((m) => m.status === 'ACTIVE').map((m) => m.user.id));
  const eligible = users.filter((u) => u.isActive && u.role !== 'ADMIN' && !activeIds.has(u.id));

  if (error) return <ErrorBox message={error} onRetry={loadList} />;
  if (!projects) return <Loading />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-1">
        <form onSubmit={createProject} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">New project</h2>
          <Field label="Name"><input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Description"><input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <button className={btnPrimary}>Create project</button>
        </form>
        <div>
          <h2 className="mb-2 font-semibold">Projects</h2>
          {projects.length === 0 ? <Empty title="No projects yet" hint="Create the first one above." /> : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <button onClick={() => { setSelected(p.id); setMsg({ type: '', text: '' }); }} aria-pressed={selected === p.id}
                    className={`w-full rounded-lg border p-3 text-left ${selected === p.id ? 'border-brand bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-slate-600">{p.activeMembers} active member{p.activeMembers === 1 ? '' : 's'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="lg:col-span-2">
        {!selected && <Empty title="Select a project" hint="Choose a project to see members and manage access." />}
        {selected && !detail && <Loading />}
        {detail && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{detail.name}</h2>
              {detail.description && <p className="text-sm text-slate-700">{detail.description}</p>}
            </div>
            {msg.text && <p role={msg.type === 'err' ? 'alert' : 'status'} className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-green-800'}`}>{msg.text}</p>}
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr><th className="p-3">Alias</th><th className="p-3">Real identity</th><th className="p-3">Role</th><th className="p-3">Access</th><th className="p-3"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.members.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-600">No members yet.</td></tr>}
                  {detail.members.map((m) => (
                    <tr key={m.id}>
                      <td className="p-3 font-medium">{m.alias}</td>
                      <td className="p-3">{m.user.realName}<span className="block text-xs text-slate-600">{m.user.email}{m.user.phone ? ` · ${m.user.phone}` : ''}</span></td>
                      <td className="p-3">{m.role}</td>
                      <td className="p-3"><Badge tone={m.status === 'ACTIVE' ? 'green' : 'red'}>{m.status === 'ACTIVE' ? 'Active' : 'Revoked'}</Badge>{m.revokedAt && <span className="block text-xs text-slate-600">{fmtTime(m.revokedAt)}</span>}</td>
                      <td className="p-3 text-right">{m.status === 'ACTIVE' && <button className={btnGhost} onClick={() => revoke(m)}>Revoke access</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form onSubmit={assign} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="min-w-[14rem] flex-1">
                <Field label="Assign a user">
                  <select className={inputCls} value={assignId} onChange={(e) => setAssignId(e.target.value)}>
                    <option value="">Choose a client or employee…</option>
                    {eligible.map((u) => <option key={u.id} value={u.id}>{u.realName} ({u.role.toLowerCase()})</option>)}
                  </select>
                </Field>
              </div>
              <button className={btnPrimary} disabled={!assignId}>Assign</button>
              <p className="w-full text-xs text-slate-600">One active client and one active employee per project. Aliases are generated automatically and differ per project.</p>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- Audit log ---------------- */
function AuditTab() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const r = await api(`/api/admin/audit?page=${page}&pageSize=20`);
    if (r.ok) { setData(r.data); setError(''); } else setError('Could not load the audit log.');
  }, [page]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Loading />;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div>
      {data.events.length === 0 ? <Empty title="No audit events yet" /> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr><th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.events.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap p-3">{fmtTime(e.createdAt)}</td>
                  <td className="p-3">{e.actorName}</td>
                  <td className="p-3 font-medium">{e.action}</td>
                  <td className="p-3">{e.entityType}</td>
                  <td className="max-w-xs break-words p-3 text-xs text-slate-700">{e.metadata ? JSON.stringify(e.metadata) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-700">Page {data.page} of {pages} · {data.total} events</span>
        <div className="flex gap-2">
          <button className={btnGhost} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className={btnGhost} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
