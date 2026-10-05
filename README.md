# Confidential Communication Portal

Clients and employees discuss project work through **project-specific aliases** (for example "Client A" and "Project Specialist B"). Neither side sees the other's real identity. Administrators see real identities, manage assignments, and review messages that the automated rules hold or flag.

All accounts and data in this repository are **fictional demo data**.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 14 (App Router), plain JavaScript | One deployable unit for UI and API |
| Database | PostgreSQL (Neon) via Prisma | Relational integrity for memberships, messages and audit |
| Styling | Tailwind CSS | Fast, consistent, responsive |
| Validation | Zod | Every API input is validated on the server |
| Passwords | bcryptjs (cost 12) | Pure JS, no native build problems on Vercel |
| Hosting | Vercel + Neon free tiers | HTTPS by default, no paid services needed |

## Quick start (local)

Prerequisites: Node 18.18+ and a PostgreSQL database (a free Neon project works).

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npx prisma migrate dev --name init
npm run db:seed
npm run dev                 # http://localhost:3000/login
```

`.env` values:

- `DATABASE_URL`: your Postgres connection string
- `SESSION_SECRET`: a long random string (`openssl rand -hex 32`)
- `APP_URL`: `http://localhost:3000` locally, the public https URL when hosted
- `SEED_ADMIN_PASSWORD`, `SEED_CLIENT_PASSWORD`, `SEED_EMPLOYEE_PASSWORD`: demo passwords of your choice (8+ characters). They are only read by the seed script.

## Demo accounts

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@demo.example` | Sees real identities, reviews flags |
| Client | `client1@demo.example` | "Client A" in Website Redesign |
| Client | `client2@demo.example` | "Client A" in Mobile App MVP |
| Employee | `employee1@demo.example` | "Project Specialist B" in Website Redesign and "Project Specialist A" in Mobile App MVP |
| Employee | `employee2@demo.example` | On no project (used for isolation tests) |

Passwords are supplied privately to the reviewer.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Run, build, serve |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:seed` | Create demo users, two projects, seeded rules (safe to repeat) |
| `npm run db:reset-demo` | Remove all demo users, projects and their data |
| `npm test` | Unit tests for the moderation rules |
| `node scripts/acceptance.mjs` | End-to-end acceptance run against `BASE_URL` |
| `scripts/deploy.sh` | Test, build, migrate, deploy, verify |

## How access control works

- Every API route authenticates the session and authorises on the **server**; hiding UI controls is never relied upon.
- Participants only reach a project through an **ACTIVE membership**. Any failure (unknown ID, someone else's project, revoked access) returns **404**, so project existence is not revealed.
- Revoking a membership takes effect on the next request, because membership is checked on every call. Deactivating a user deletes their sessions.
- Participant-facing responses are built by whitelist mappers in `lib/dto.js`. Real names, emails and phone numbers are never selected into them.
- Held and rejected messages are excluded by the database query for everyone except the original sender.
- Clients cannot choose the sender, membership or status of a message; those are set by the server.
- Sessions use random tokens in `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookies. Only an HMAC of the token is stored. Cross-origin writes are rejected.
- Passwords, session tokens and message bodies are never logged.

## Moderation

Seeded rules cover contact sharing, off-platform requests, commercial discussion and abuse (see `lib/default-rules.mjs`). Contact sharing is always held. Other categories can be switched between "allow and flag" and "hold for review" at `/admin/rules`. Each flag shows the rule, reason, severity and category, and admins approve, reject or dismiss it with a note. Decisions notify the sender (without identity details) and are written to the audit log. Approval retries and simultaneous approvals never deliver a message twice.

A flag requests human review. It does not establish wrongdoing.

## Privacy boundaries (please read)

- Participants are **pseudonymous to each other**; administrators can identify everyone.
- This is **not end-to-end encrypted** and does **not guarantee anonymity**.
- Message content can reveal identity (a name, a company, a distinctive detail) and no automated check can prevent that.
- Automated rules can miss attempts and can flag harmless messages. See `docs/ARCHITECTURE_AND_LIMITATIONS.md` for verified examples.

## Removing demo data

```bash
npm run db:reset-demo
```

This deletes every `@demo.example` account together with its sessions, memberships, notifications, audit events, and any project those accounts belonged to (with its conversations, messages and flags). Rules are kept.

## Documentation

- `docs/DEPLOYMENT.md`: hosting, environment variables, migrations, redeploy, recovery, live verification
- `docs/ARCHITECTURE_AND_LIMITATIONS.md`: design choices, rules, known limitations, third-party services
