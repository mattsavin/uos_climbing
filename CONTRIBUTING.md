# Contributing to the USMC Club Website

Welcome! This guide covers everything you need to start contributing.

## The one rule

**Never push directly to `main`.** Branch protection enforces this anyway —
all changes go through `dev` and pull requests.

## Workflow

```
dev  ──(your work: commits, feature branches)──>  PR  ──(CI + review)──>  main  ──>  production
```

1. `main` is production. It deploys automatically to the live site.
2. `dev` is the integration branch. It deploys automatically to the **beta**
   site (password-protected) — push here freely, it's where you break things safely.
3. Open pull requests from `dev` → `main` for releases. CI must be green, and
   an AI code review (Copilot or similar agent) is expected before merging.

## Local setup

```bash
git clone https://github.com/uos-climbing/club-website.git
cd club-website
npm install
cp .env.example .env      # fill in values (ask Matt for dev credentials)
npm run dev:all           # backend :3000 + frontend :5173
```

## Before you push

```bash
npm run lint              # eslint — must be error-free
npm run format:check      # prettier — run `npm run format` to fix
npm run typecheck         # backend strict typecheck
npm test                  # backend tests + e2e (needs `npm run build` first for some)
```

CI runs all of this plus the dependency audit. If it fails, the deploy is blocked —
that's the point. Fix forward, never bypass.

## Conventions

- **Commits**: conventional-commit style (`feat:`, `fix:`, `chore:`, `refactor:` …)
- **Formatting**: Prettier owns formatting — don't hand-style; run `npm run format`
- **Escaping**: any dynamic value interpolated into HTML must go through
  `escapeHTML()` (see `src/utils.ts`) — lint warns about this
- **DB access in routes**: prefer the promisified helpers in `backend/utils/db.ts`
  (`dbGet/dbAll/dbRun`). Transactional flows (bookings, gear approve/return) keep
  `db.serialize()` blocks — see comments in those files before changing them
- **Secrets** live in GitHub Actions secrets and `.env` (never committed)

## Where things run

| Environment         | What                              | Where                          |
| ------------------- | --------------------------------- | ------------------------------ |
| Production (`main`) | Live site, port 3000              | VPS, Docker, volume `~/data`   |
| Beta (`dev`)        | Password-gated staging, port 3001 | Same VPS, volume `~/data_beta` |

Deploys are automatic on push and **fail-closed**: a database snapshot is taken
before every deploy, and the previous image is tagged `last-known-good` for
instant rollback. See `README.md` for the backup/restore runbook.

## Access & safety notes

- Collaborators have **push access to code only** — deploy secrets, SSH keys and
  the VPS are not exposed through the repo
- Admin actions (approve/reject/reset…) are recorded in the audit trail
  (`GET /api/admin/audit-log`)
- The database contains member personal data (emergency contacts). Don't copy it
  into issues, screenshots or your local machine beyond what testing requires
