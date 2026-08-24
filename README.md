# USMC — University of Sheffield Mountaineering & Climbing Club

Club website and member management platform: session booking, membership, gear hire,
elections/voting, gallery, committee admin, iCal feeds.

**Stack:** Express 5 + SQLite (backend) · Vite multi-page TypeScript + Tailwind (frontend) ·
Vitest + Playwright · GitHub Actions CI/CD → Docker on a VPS.

## Local development

```bash
npm install
cp .env.example .env      # fill in values; JWT_SECRET is required for production only
npm run dev:all           # backend on :3000 (tsx watch) + frontend on :5173 (Vite proxy)
```

Clean routes like `/dashboard`, `/about` are rewritten by `vite.config.ts` in dev and by the
Express history-fallback in production. Both tables live in that file — update **both** when
adding a page.

## Testing

```bash
npm run test:backend     # Vitest against an in-memory SQLite DB (NODE_ENV=test)
npm run test:e2e         # Playwright; boots its own backend (:3001) + Vite dev server (:5174)
npm test                 # both
```

CI runs everything on every push to `main`/`dev`; deploys are gated on it.

## Deployment

- `main` → prod (`uos_climbing` container, port 3000, volume `~/data`)
- `dev` → beta (`uos_climbing_beta`, port 3001, volume `~/data_beta`, behind a passcode gate)

Both jobs: pull → **pre-deploy DB backup** → build → swap container. A failed backup aborts
the deploy before anything is touched.

Beta gate: `IS_BETA=true` requires `BETA_ACCESS_SECRET` (server refuses to boot without it).
CSP ships report-only; violations are logged via `/api/csp-report`. Set `CSP_ENFORCE=true`
to enforce once reports have been quiet.

## Backups

Snapshots use SQLite's online backup API via the app's own Docker image, then gzip.
Each snapshot is verified with `PRAGMA integrity_check` before being counted as success.

**Automatic:** every deploy takes a pre-deploy snapshot of prod *and* beta.
**Scheduled (recommended):** daily cron on the VPS:

```cron
0 4   * * * ~/uos_climbing/scripts/backup-db.sh uos_climbing      ~/data      ~/backups/prod daily >> ~/backups/cron.log 2>&1
15 4  * * * ~/uos_climbing_beta/scripts/backup-db.sh uos_climbing_beta ~/data_beta ~/backups/beta daily >> ~/backups/cron.log 2>&1
```

Photos are **not** in SQLite. Archive them periodically (they're large — weekly is sensible
on a small disk):

```bash
INCLUDE_UPLOADS=true ~/uos_climbing/scripts/backup-db.sh uos_climbing ~/data ~/backups/prod weekly-uploads
```

Retention: 14 per directory (`RETENTION_COUNT`). Permissions: `umask 077` — backups contain
member PII including emergency contacts; keep them private.

### Manual backup

```bash
~/uos_climbing/scripts/backup-db.sh uos_climbing ~/data ~/backups/prod manual
```

### Restore procedure

```bash
docker stop uos_climbing
mv ~/data/uscc.db ~/data/uscc.db.corrupt        # preserve evidence
gunzip -c ~/backups/prod/uscc-pre-deploy-YYYYMMDD-HHMMSS.db.gz > ~/data/uscc.db
docker start uos_climbing                        # migrations self-apply on boot
```

Schema migrations in `backend/db.ts` are idempotent (`ALTER TABLE ... ADD COLUMN` with
error-swallowing), so restoring an older backup onto newer code generally just works — but
verify the site after any restore.

### Restore drill (do this quarterly)

1. Take a fresh backup: `scripts/backup-db.sh uos_climbing ~/data /tmp/drill drill`
2. Extract to a scratch dir and open read-only:
   ```bash
   gunzip -c /tmp/drill/uscc-drill-*.db.gz > /tmp/drill/restored.db
   sqlite3 /tmp/drill/restored.db 'PRAGMA integrity_check;'
   sqlite3 /tmp/drill/restored.db 'SELECT COUNT(*) FROM users;'
   ```
3. Full rehearsal: point a throwaway container at the restored file and log in.
   An untested backup is a rumour.

### Off-site gap

Backups currently live on the same VPS as the database — they survive container rebuilds
and bad deploys, but not loss of the host itself (OCI free tier has no spare capacity for a
second region). Options when capacity allows: encrypted backup upload from a scheduled CI job
(GPG-encrypt, upload as a private artifact), or `rclone` to any free object storage tier.
Treat this as the known weakest link until closed.
