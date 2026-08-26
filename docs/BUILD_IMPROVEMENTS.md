# Build-side improvements from Cloudflare edge data (2026-08-26)

Evidence source: 7-day Cloudflare analytics window (2026-08-20..27, ~21.5k requests),
reproducible any time via `~/.local/bin/cfq.py aggregate <start> <end>` on cachyos-ideapad
(token `~/.config/uos/cf-analytics-token`). Headline numbers driving each task are quoted.

Conventions: follow CONTRIBUTING.md; conventional commits; all existing tests must pass
(`npm test`) plus new tests listed per task. Do not change CSP directives or PAGE_ROUTES.

---

## P0-A — Static asset caching (fixes: cache hit ratio ~0%, 11 hits out of 21k requests)

**Evidence:** every request currently served as `dynamic`/`none` — including `/climbing%20team%20logo.png`
and Vite bundle JS/CSS. Root cause in code: `backend/server.ts` serves production with bare
`app.use(express.static(distPath))` and `app.use('/uploads', express.static(UPLOAD_BASE_DIR))`,
neither with any `maxAge`. Express then emits `Cache-Control: public, max-age=0`, which tells
Cloudflare's edge (and browsers) never to cache. Fixing origin headers lights up CF edge caching
with zero dashboard changes.

**Tasks** (all in `backend/server.ts` production block):

1. Hashed bundles: mount a dedicated handler for Vite's content-hashed output
   (`dist/assets/*` — verify emitted path/naming against vite.config.ts first):
   `Cache-Control: public, max-age=31536000, immutable`.
2. Other long-lived public files (logo PNG, favicon, fonts, robots.txt, sitemap.xml) inside `dist`:
   `Cache-Control: public, max-age=604800` (7d). These are _not_ hash-named — do NOT use `immutable`.
3. HTML entry pages (everything routed through PAGE_ROUTES map and index.html):
   `Cache-Control: no-cache` (must revalidate; club content changes around elections/freshers).
   The cleanest implementation: set this header in the page-routing middleware right next to
   each `res.sendFile(distPath ...)` call rather than globally.
4. `/uploads`: inspect how files are named (profile photos vs gallery images). If names are
   unique-per-upload (check gallery.ts + users routes), serve `public, max-age=2592000, must-revalidate`;
   otherwise cap at 3600. State your finding in the PR description.
5. Add `compression` middleware (npm `compression`) above the static mounts; add to runtime deps.

**Acceptance criteria:**

- New Vitest/Playwright assertions: production-mode smoke test hits an `/assets/*.js` URL and a
  page route and asserts the exact `Cache-Control` values above.
- Manual proof recorded in PR: `curl -sI https://sheffieldclimbing.org/assets/<a-bundle>.css`
  shows the new header.
- After merge, `python3 ~/.local/bin/cfq.py aggregate` within 48h shows cacheStatus majority `hit`
  on asset paths (origin still uncached classes only where correct).
- Dev mode (`npm run dev:all`) unaffected: no caching changes outside the production branch.

## P0-B — Origin hang diagnosis (fixes: ~1,900 5xx/week, incl. 504s for GB members on legit paths)

**Evidence:** 504s concentrated on `/api/auth/me` (127), `/` (126), `/api/gallery` (62),
`/api/session-types` (45), `/api/sessions` (45). A CF free-plan 504 means origin exceeded
~100s response time — something hangs or deadlocks briefly. GB users hit these too, so this is
real member pain, not bot noise. Suspects (in order):

- `sqlite3` v6 callback-API lock contention: WAL is already enabled (`backend/db.ts:46`) but
  **no `busy_timeout`** pragma anywhere; a held write lock makes read callbacks queue silently.
- Reminder scheduler (`startReminderScheduler`) or admin bulk actions holding a long transaction.
- Docker restart/mem pressure sharing host with beta container.

**Tasks:**

1. In `initializeDatabase()`: add `PRAGMA busy_timeout = 5000;` and
   `PRAGMA foreign_keys = ON;` alongside the WAL line.
2. Add a slow-request logging middleware (JSON single-line `[PERF] {method,path,durationMs,status}`
   for any request >1000ms) as the outermost middleware after trust-proxy, permanently useful,
   negligible overhead. Gate on env var PERF_LOG=true so local/dev default stays quiet.
3. Instrument the five worst endpoints' handlers with duration stamps if the middleware alone
   can't attribute internals (auth/me does a DB lookup + jwt verify — likely contended DB).
4. Write up hypothesis + evidence in the PR after reproducing at least one >5s request locally
   (e.g., parallel load script with playwright/vitest simulating auth-me spam during an admin
   photo upload). If not reproducible locally, say so — instrumentation ships anyway and we read
   the next week of [PERF] logs before code changes beyond (1)(2)(3).

**Acceptance criteria:** pragmas live in db.ts init; perf middleware tested by forcing a delay;
no behavior change on happy path; explicit statement of what was/wasn't reproduced.

## P1 — Fast-fail scanner paths (protects rate-limit budget from FR probing swarm)

**Evidence:** FR = 35.8% of traffic (7.7k), mostly hammering `.env*/wp-admin/config/yaml`
paths that 404 properly but each count against the in-memory global rate limiter (1000/15min/IP)
and burn origin cycles. CF already rate-limits some (4.1k 429s), but leak-through continues.

**Task:** tiny middleware registered before rate limiter: exact-match prefix list
(`/.env`, `/wp-admin`, `/wp-login`, `/config/`, `/actuator/`, `/.git`, `/phpmyadmin`) →
respond 404 immediately (text body) with no further processing. Keep list in one typed constant
with comment linking to cfq.py methodology. Unit test: those paths return 404 fast AND do NOT
increment anything the real limiter counts.

**Acceptance:** `curl -I https://sheffieldclimbing.org/.env.example-style probe` style requests
short-circuit; legit app paths untouched; test suite green.

## Non-build follow-ups (not this agent's scope, flagged here so nobody repeats them)

- CF dashboard WAF/firewall rule (country+path deny for the FR pattern) would be quicker than
  middleware but is account-side config, not version-controlled.
- SEO known-gap JSON-LD structured data is tracked separately; out of scope here.
- If 504s persist post-instrumentation, consider splitting reminders into a separate process.

## Definition of Done overall

All tests green, dist builds, deploy through normal ci-cd.yml promotion flow (dev→main via PR),
headers verified in prod via curl, second cfq.py pull compared with the baseline pasted above
(expect: cacheStatus flips to majority-hit on assets; 429/404 share stable; 504 share reported
before/after any DB change).
