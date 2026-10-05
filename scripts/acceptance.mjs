#!/usr/bin/env node
// Automated acceptance run against any deployment.
//   BASE_URL=https://your-app.vercel.app SEED_ADMIN_PASSWORD=... SEED_CLIENT_PASSWORD=... SEED_EMPLOYEE_PASSWORD=... node scripts/acceptance.mjs
//   add --after-redeploy to verify earlier results survived a restart/redeploy.
import fs from 'node:fs';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const PW = {
  admin: process.env.SEED_ADMIN_PASSWORD,
  client: process.env.SEED_CLIENT_PASSWORD,
  employee: process.env.SEED_EMPLOYEE_PASSWORD,
};
if (!PW.admin || !PW.client || !PW.employee) {
  console.error('Set SEED_ADMIN_PASSWORD, SEED_CLIENT_PASSWORD and SEED_EMPLOYEE_PASSWORD to the demo passwords.');
  process.exit(2);
}
const STATE_FILE = new URL('./.acceptance-state.json', import.meta.url);
const AFTER_REDEPLOY = process.argv.includes('--after-redeploy');

class Session {
  constructor() { this.cookie = ''; }
  async req(method, path, body) {
    const res = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  }
  get(p) { return this.req('GET', p); }
  post(p, b = {}) { return this.req('POST', p, b); }
  del(p) { return this.req('DELETE', p); }
  async login(email, password) {
    const res = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    const cookie = (res.headers.getSetCookie?.() || []).map((s) => s.split(';')[0]).find((s) => s.startsWith('portal_session='));
    if (!res.ok || !cookie) throw new Error(`Login failed for ${email} (HTTP ${res.status})`);
    this.cookie = cookie;
  }
}

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `  -> ${detail}` : ''}`); }
}
const CONSONANTS = 'bcdfghjklmnpqrstvwxz';
const marker = () => Array.from({ length: 10 }, () => CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]).join('');
let n = 0;
const cid = () => `acc-${Date.now().toString(36)}-${++n}`;

async function login(email, kind) { const s = new Session(); await s.login(email, PW[kind]); return s; }
const visible = async (s, pid) => (await s.get(`/api/projects/${pid}/messages`)).json?.messages ?? [];

async function persistenceCheck() {
  if (!fs.existsSync(STATE_FILE)) { console.error('No saved state. Run the full acceptance script first.'); process.exit(2); }
  const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const admin = await login('admin@demo.example', 'admin');
  const emp = await login('employee1@demo.example', 'employee');
  const msgs = await visible(emp, st.p1);
  check('After redeploy: approved message still delivered (exactly once)', msgs.filter((m) => m.body.includes(st.approved.marker)).length === 1);
  check('After redeploy: rejected message still invisible to recipient', !msgs.some((m) => m.body.includes(st.rejected.marker)));
  check('After redeploy: ordinary message history still present', msgs.some((m) => m.body.includes(st.ordinary)));
  const audit = (await admin.get('/api/admin/audit?pageSize=100')).json?.events ?? [];
  for (const [action, id] of [['FLAG_APPROVED', st.approved.messageId], ['FLAG_REJECTED', st.rejected.messageId], ['FLAG_DISMISSED', st.dismissed.messageId]]) {
    check(`After redeploy: audit log still has ${action}`, audit.some((e) => e.action === action && e.entityId === id));
  }
}

async function main() {
  console.log(`Target: ${BASE}\n`);
  if (AFTER_REDEPLOY) { await persistenceCheck(); return; }

  // ---- health
  const health = await new Session().get('/api/health');
  check('Health endpoint reports ok and exposes no secrets', health.status === 200 && health.json?.db === 'ok' && !/postgres|secret|password/i.test(health.text));

  const admin = await login('admin@demo.example', 'admin');
  const c1 = await login('client1@demo.example', 'client');
  const c2 = await login('client2@demo.example', 'client');
  const e1 = await login('employee1@demo.example', 'employee');
  const e2 = await login('employee2@demo.example', 'employee');
  const participantText = []; // every participant-facing body, scanned for identity leaks at the end

  check('Unauthenticated request is rejected', (await new Session().get('/api/projects')).status === 401);

  // ---- projects & aliases
  const c1p = await c1.get('/api/projects'); participantText.push(c1p.text);
  const c2p = await c2.get('/api/projects'); participantText.push(c2p.text);
  const e1p = await e1.get('/api/projects'); participantText.push(e1p.text);
  const e2p = await e2.get('/api/projects'); participantText.push(e2p.text);
  const p1 = c1p.json?.projects?.find((p) => p.projectName === 'Website Redesign')?.projectId;
  const p2 = c2p.json?.projects?.find((p) => p.projectName === 'Mobile App MVP')?.projectId;
  check('Client 1 sees only their own project', c1p.json?.projects?.length === 1 && !!p1);
  check('Client 2 sees only their own project', c2p.json?.projects?.length === 1 && !!p2);
  if (!p1 || !p2) { console.log('\nSeed data not found. Run npm run db:seed first.'); process.exit(1); }
  const aliases = (e1p.json?.projects ?? []).map((p) => p.myAlias);
  check('Same employee has different aliases across projects', aliases.length === 2 && aliases[0] !== aliases[1], aliases.join(' vs '));
  check('Unrelated employee sees no projects', (e2p.json?.projects ?? []).length === 0);
  const me = await c1.get('/api/auth/me'); participantText.push(me.text);

  // ---- ordinary chat + persistence + safe retry
  const ordinary = `Ordinary update ${marker()}: the wireframes are ready for review.`;
  const ordId = cid();
  const s1 = await c1.post(`/api/projects/${p1}/messages`, { text: ordinary, clientMessageId: ordId });
  check('Client sends an ordinary message (delivered)', s1.status === 201 && s1.json?.message?.status === 'DELIVERED');
  const retry = await c1.post(`/api/projects/${p1}/messages`, { text: ordinary, clientMessageId: ordId });
  check('Retrying the same send returns the original message', retry.json?.duplicate === true && retry.json?.message?.id === s1.json?.message?.id);
  const empView = await e1.get(`/api/projects/${p1}/messages`); participantText.push(empView.text);
  check('Employee receives it exactly once, with an alias', (empView.json?.messages ?? []).filter((m) => m.body === ordinary).length === 1
    && empView.json.messages.find((m) => m.body === ordinary).senderAlias === 'Client A');
  const reply = `Reply ${marker()}: thanks, starting the homepage now.`;
  check('Employee replies', (await e1.post(`/api/projects/${p1}/messages`, { text: reply, clientMessageId: cid() })).status === 201);
  const reload = await visible(c1, p1);
  check('Conversation history persists across a fresh request (reload)', reload.some((m) => m.body === ordinary) && reload.some((m) => m.body === reply));

  // ---- access control by changing IDs
  const forbidden = [
    ['Unrelated employee cannot READ project 1', await e2.get(`/api/projects/${p1}/messages`)],
    ['Unrelated employee cannot SEND to project 1', await e2.post(`/api/projects/${p1}/messages`, { text: 'sneaky', clientMessageId: cid() })],
    ['Client 1 cannot READ project 2', await c1.get(`/api/projects/${p2}/messages`)],
    ['Client 1 cannot SEND to project 2', await c1.post(`/api/projects/${p2}/messages`, { text: 'sneaky', clientMessageId: cid() })],
    ['Made-up project id returns 404', await c1.get('/api/projects/doesnotexist123/messages')],
    ['Participant cannot call admin users API', await c1.get('/api/admin/users')],
    ['Participant cannot call admin flags API', await e1.get('/api/admin/flags')],
    ['Participant cannot decide a flag', await c1.post('/api/admin/flags/anything/decision', { decision: 'APPROVE' })],
  ];
  for (const [name, r] of forbidden) check(name, r.status === 404, `HTTP ${r.status}`);
  const cross = await new Session().req('POST', '/api/auth/logout'); // sanity: logout without session must not crash
  check('Logout without a session does not error', cross.status < 500);

  // ---- client cannot forge sender/status
  const forgedMarker = marker();
  const forged = await c1.post(`/api/projects/${p1}/messages`, {
    text: `Please email me at ${forgedMarker}@example.com`, clientMessageId: cid(), status: 'DELIVERED', senderMembershipId: 'x',
  });
  check('Client-supplied status is ignored (contact message still HELD)', forged.json?.message?.status === 'HELD', forged.text);

  // ---- contact sharing held & invisible
  const held = marker();
  const heldRes = await c1.post(`/api/projects/${p1}/messages`, { text: `Please email me at ${held}@example.com`, clientMessageId: cid() });
  check('Contact-sharing message is HELD for the sender', heldRes.json?.message?.status === 'HELD');
  const empAfter = await e1.get(`/api/projects/${p1}/messages`); participantText.push(empAfter.text);
  check('Held message is absent from the recipient response', !empAfter.text.includes(held));
  check('Sender still sees own held message with HELD state', (await visible(c1, p1)).some((m) => m.body.includes(held) && m.status === 'HELD'));

  // ---- pricing => alert, delivered; normal => no flag
  const price = marker();
  const priceRes = await c1.post(`/api/projects/${p1}/messages`, { text: `What is the price for the extra page? ${price}`, clientMessageId: cid() });
  check('Pricing message is delivered', priceRes.json?.message?.status === 'DELIVERED');
  const queue = async () => (await admin.get('/api/admin/flags?status=PENDING&pageSize=100')).json?.flags ?? [];
  let flags = await queue();
  const priceFlag = flags.find((f) => f.preview.includes(price));
  check('Pricing message creates a COMMERCIAL admin flag', priceFlag?.category === 'COMMERCIAL', priceFlag ? priceFlag.category : 'no flag');
  check('Ordinary message created no flag', !flags.some((f) => f.preview.includes(ordinary.slice(0, 30))));
  const alerts = (await admin.get('/api/notifications')).json;
  check('Admin has in-app alerts', (alerts?.unread ?? 0) > 0 || (alerts?.notifications ?? []).some((x) => x.type === 'FLAG'));

  // ---- admin decisions: approve, reject, dismiss
  const mk = async (label) => {
    const m = marker();
    const r = await c1.post(`/api/projects/${p1}/messages`, { text: `${label} reach me at ${m}@example.com`, clientMessageId: cid() });
    return { marker: m, messageId: r.json?.message?.id };
  };
  const A = await mk('approve'), R = await mk('reject'), D = await mk('dismiss'), C = await mk('concurrent');
  flags = await queue();
  const flagOf = (m) => flags.find((f) => f.preview.includes(m.marker));
  const decide = (flag, decision, note = 'acceptance test') => admin.post(`/api/admin/flags/${flag.id}/decision`, { decision, note });
  check('Held messages appear in the review queue', [A, R, D, C].every((x) => flagOf(x)));
  const ctx = await admin.get(`/api/admin/flags/${flagOf(A).id}`);
  check('Admin sees conversation context with real identities', (ctx.json?.context ?? []).some((m) => m.senderRealName) && ctx.json.context.length > 1);

  const ap = await decide(flagOf(A), 'APPROVE');
  check('Admin approves a held message', ap.json?.result === 'applied' && ap.json?.messageStatus === 'DELIVERED');
  const rj = await decide(flagOf(R), 'REJECT');
  check('Admin rejects a held message', rj.json?.result === 'applied' && rj.json?.messageStatus === 'REJECTED');
  const ds = await decide(flagOf(D), 'DISMISS');
  check('Admin dismisses a false positive', ds.json?.result === 'applied' && ds.json?.flagStatus === 'DISMISSED');

  const ap2 = await decide(flagOf(A), 'APPROVE');
  check('Approval retry is a no-op (already_decided)', ap2.json?.result === 'already_decided');
  const [x1, x2] = await Promise.all([decide(flagOf(C), 'APPROVE'), decide(flagOf(C), 'APPROVE')]);
  check('Two simultaneous approvals apply exactly once', [x1, x2].filter((x) => x.json?.result === 'applied').length === 1);

  const empFinal = await e1.get(`/api/projects/${p1}/messages`); participantText.push(empFinal.text);
  const count = (m) => (empFinal.json?.messages ?? []).filter((x) => x.body.includes(m.marker)).length;
  check('Approved message delivered exactly once', count(A) === 1);
  check('Rejected message never delivered', count(R) === 0);
  check('Dismissed (false positive) message delivered once', count(D) === 1);
  check('Concurrently approved message delivered exactly once', count(C) === 1);
  const sender = await visible(c1, p1);
  check('Sender sees REJECTED state on their rejected message', sender.some((m) => m.body.includes(R.marker) && m.status === 'REJECTED'));
  const notes = (await c1.get('/api/notifications')).json?.notifications ?? [];
  participantText.push(JSON.stringify(notes));
  check('Sender was notified of decisions', notes.filter((x) => x.type === 'DECISION').length >= 3);

  const audit = (await admin.get('/api/admin/audit?pageSize=100')).json?.events ?? [];
  for (const [action, m] of [['FLAG_APPROVED', A], ['FLAG_REJECTED', R], ['FLAG_DISMISSED', D]]) {
    check(`Audit log records ${action}`, audit.some((e) => e.action === action && e.entityId === m.messageId && e.actorName));
  }

  // ---- revoke membership
  const detail = (await admin.get(`/api/admin/projects/${p1}`)).json?.project;
  const mem = detail?.members?.find((m) => m.user.email === 'employee1@demo.example' && m.status === 'ACTIVE');
  check('Admin sees real identities in project detail', !!mem?.user?.realName && !!mem?.user?.email);
  const rev = await admin.del(`/api/admin/memberships/${mem?.id}`);
  check('Admin revokes a membership', rev.status === 200);
  check('Revoked user can no longer READ', (await e1.get(`/api/projects/${p1}/messages`)).status === 404);
  check('Revoked user can no longer SEND', (await e1.post(`/api/projects/${p1}/messages`, { text: 'hello?', clientMessageId: cid() })).status === 404);
  check('Revoked project disappears from their list', !((await e1.get('/api/projects')).json?.projects ?? []).some((p) => p.projectId === p1));
  const back = await admin.post(`/api/admin/projects/${p1}/members`, { userId: mem?.user?.id });
  check('Admin can restore access (alias preserved)', back.status === 201 && back.json?.membership?.alias === mem?.alias);
  check('Restored user can read again', (await e1.get(`/api/projects/${p1}/messages`)).status === 200);

  // ---- privacy: scan every participant-facing response
  const LEAK = /demo\.example|Rohan|Priya|Karan|Meera|Asha|\+91|90000/;
  const leaked = participantText.filter((t) => LEAK.test(t));
  check('No real identity data in any participant-facing response', leaked.length === 0, leaked[0]?.slice(0, 120));

  fs.writeFileSync(STATE_FILE, JSON.stringify({
    p1, ordinary,
    approved: { marker: A.marker, messageId: A.messageId },
    rejected: { marker: R.marker, messageId: R.messageId },
    dismissed: { marker: D.marker, messageId: D.messageId },
  }));
}

main()
  .catch((e) => { fail++; console.log(`FAIL  Script error: ${e.message}`); })
  .finally(() => {
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
