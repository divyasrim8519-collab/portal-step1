#!/usr/bin/env bash
# Repeatable release: test -> build check -> migrate -> deploy -> verify.
# Required env: MIGRATE_DATABASE_URL (direct, non-pooled Neon URL), APP_URL (public https URL)
set -euo pipefail

: "${MIGRATE_DATABASE_URL:?Set MIGRATE_DATABASE_URL to the DIRECT Neon connection string}"
: "${APP_URL:?Set APP_URL to the public https URL, e.g. https://your-app.vercel.app}"

echo "1/6 Installing dependencies";  npm ci
echo "2/6 Unit tests";               npm test
echo "3/6 Build check";              DATABASE_URL="$MIGRATE_DATABASE_URL" SESSION_SECRET="build-check-only-not-a-real-secret" npm run build
echo "4/6 Database migrations";      DATABASE_URL="$MIGRATE_DATABASE_URL" npx prisma migrate deploy

echo "5/6 Deploying"
if command -v vercel >/dev/null 2>&1; then
  vercel deploy --prod
else
  echo "Vercel CLI not found; pushing to origin (Vercel Git integration will build)."
  git push origin HEAD
fi

echo "6/6 Verifying health (waits for the new build)"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "$APP_URL/api/health" | grep -q '"db":"ok"'; then echo "Healthy."; exit 0; fi
  echo "  not ready yet ($i/10)..."; sleep 10
done
echo "Health check failed. See docs/DEPLOYMENT.md > Recovery."; exit 1
