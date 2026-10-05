# Deployment Guide

**Architecture:** one Next.js full-stack app on **Vercel** (UI and API routes as serverless functions) plus a **Neon** PostgreSQL database. HTTPS is provided by Vercel. The app is single-origin, so no CORS configuration is needed and cross-origin writes are rejected by `middleware.js`.

## 1. Prerequisites

- Node 18.18+ and npm
- A GitHub account (private repository), a Vercel account, a Neon account (all free tiers)
- Optional: Vercel CLI (`npm i -g vercel`)

## 2. Environment variables

Set these in **Vercel > Project > Settings > Environment Variables** (Production). Never commit values.

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | app (runtime) | Neon connection string. Use the **pooled** string on Vercel |
| `SESSION_SECRET` | app | 32+ random characters (`openssl rand -hex 32`) |
| `APP_URL` | docs/scripts | Public https URL |
| `SEED_ADMIN_PASSWORD`, `SEED_CLIENT_PASSWORD`, `SEED_EMPLOYEE_PASSWORD` | seed script only | Run from your own machine; **not needed on Vercel** |
| `MIGRATE_DATABASE_URL` | `scripts/deploy.sh` | Neon **direct** (non-pooled) string, used from your machine for migrations |

Secrets are read only on the server and are not exposed to the frontend bundle (none use the `NEXT_PUBLIC_` prefix).

## 3. One-time setup

1. **Neon:** create a project, copy both the *pooled* and *direct* connection strings.
2. **GitHub:** push this repository as **private**. Confirm `.env` and any PDFs are ignored.
3. **Vercel:** *Add New > Project*, import the repository, and add `DATABASE_URL` (pooled) and `SESSION_SECRET` before the first build. Optionally set the function region near your Neon region in project settings.
4. **Migrate and seed from your machine** (direct URL):
   ```bash
   export DATABASE_URL="<direct Neon url>"
   export SEED_ADMIN_PASSWORD="..." SEED_CLIENT_PASSWORD="..." SEED_EMPLOYEE_PASSWORD="..."
   npm ci
   npm run db:deploy      # applies migrations
   npm run db:seed        # fictional demo users + two isolated projects + rules
   ```
   Migration order is the folder order in `prisma/migrations` (oldest first). The seed always runs **after** migrations.
5. **Deploy:** push to the main branch (or run `vercel deploy --prod`).

## 4. Redeploy (every release)

```bash
export MIGRATE_DATABASE_URL="<direct Neon url>"
export APP_URL="https://<your-app>.vercel.app"
./scripts/deploy.sh
```

The script runs: install, unit tests, build check, `prisma migrate deploy`, deploy, then polls `/api/health`. Migrations run **before** the new code goes live, so write migrations that are backwards compatible with the previous release (add columns before using them).

## 5. Health check and database connectivity

`GET $APP_URL/api/health` returns:

```json
{ "status": "ok", "db": "ok" }
```

It runs `SELECT 1` and returns HTTP 503 with `"db":"unreachable"` if the database cannot be reached. It never returns secrets, identities or message content. To verify connectivity: `curl -i $APP_URL/api/health`.

## 6. Live verification

Run the automated acceptance script against the hosted URL, then repeat the scenarios manually in three browser sessions (admin, client, employee) for the walkthrough video:

```bash
BASE_URL=https://<your-app>.vercel.app \
SEED_ADMIN_PASSWORD=... SEED_CLIENT_PASSWORD=... SEED_EMPLOYEE_PASSWORD=... \
node scripts/acceptance.mjs | tee docs/verification-live.txt
```

**Restart / redeploy persistence:** after the run above, trigger a redeploy (Vercel > Deployments > Redeploy, or push a commit), then run:

```bash
BASE_URL=... SEED_...=... node scripts/acceptance.mjs --after-redeploy | tee docs/verification-after-redeploy.txt
```

This confirms approved messages, rejected messages and audit events survived. Keep both output files as your evidence.

The login rate limiter allows 8 attempts per email per 10 minutes per server instance. The acceptance script logs in once per account, so avoid running it more than a few times in 10 minutes.

### Acceptance checklist

| Scenario | Automated check | Manual (video) | Result |
|---|---|---|---|
| Client and employee exchange messages via aliases; survives reload | yes | yes | |
| Unrelated user blocked when changing project / conversation / message ID | yes | yes (DevTools or curl) | |
| No real identity in participant responses; aliases differ across projects | yes | yes | |
| Contact-sharing message held and invisible until approved | yes | yes | |
| Pricing message raises admin alert; normal chat unaffected | yes | yes | |
| Admin approves one, rejects one, dismisses one; audit log shows all | yes | yes | |
| Removing membership revokes access | yes | yes | |
| Approval retry does not deliver twice (including simultaneous) | yes | yes | |
| Data survives redeploy | `--after-redeploy` | yes | |

Fill the *Result* column with PASS and the date after running them.

## 7. Recovery from a failed release

1. **Bad build or runtime errors:** Vercel > Deployments > pick the last good deployment > *Promote to Production* (instant rollback, no rebuild).
2. **Migration failed part-way:** `prisma migrate deploy` stops on the first failing migration. Fix the migration, then either re-run, or if it was applied manually, mark it with `npx prisma migrate resolve --applied <migration_name>` (or `--rolled-back <name>` after reverting by hand).
3. **Bad data change:** Neon > Branches > restore to a point in time (free tier keeps a short history) or create a branch from before the change and point `DATABASE_URL` at it.
4. **Verify:** `curl $APP_URL/api/health`, then run `node scripts/acceptance.mjs`.

Deployment errors are written to the Vercel function logs. The app logs error types only, never passwords, tokens or message bodies.

## 8. Hosting limitations (disclose to the reviewer)

- **Neon free tier** suspends the database after a few minutes of inactivity; the first request afterwards can take a few seconds. Open `/api/health` once before a demo.
- **Vercel Hobby** serverless functions have cold starts and execution limits. WebSockets are not supported, so chat uses polling every 3 seconds.
- **In-memory login rate limiting** is per server instance, so it is best effort on serverless.
- **Moderation rule edits** can take up to 30 seconds to reach every instance (rule cache).

## 9. Cleanup

```bash
export DATABASE_URL="<direct Neon url>"
npm run db:reset-demo     # removes all @demo.example users, projects, messages, flags, audit events
```

To remove everything, delete the Vercel project and the Neon project.

## 10. Demo accounts

Emails are in `README.md`. Passwords are shared privately with the reviewer and are never stored in the repository.
