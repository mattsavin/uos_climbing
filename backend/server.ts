import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import adminRoutes from './routes/admin';
import helmet from 'helmet';
import { slowRequestLog } from './perfLog';
import rateLimit from 'express-rate-limit';
import sessionRoutes from './routes/sessions';
import sessionTypeRoutes from './routes/session-types';
import membershipTypeRoutes from './routes/membership-types';
import votingRoutes from './routes/voting';
import gearRoutes from './routes/gear';
import tripRoutes from './routes/trips';
import committeeRoutes from './routes/committee';
import verifyRoutes from './routes/verify';
import galleryRoutes from './routes/gallery';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { betaGate } from './middleware/beta-gate';
import jwt from 'jsonwebtoken';
import { UPLOAD_BASE_DIR } from './config';
import { startReminderScheduler } from './services/bookings';

// ESM dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// If running behind a reverse proxy (nginx, Cloudflare, load balancer),
// enable `trust proxy` so Express reads the `X-Forwarded-*` headers.
// This is required for correct client IP detection (used by express-rate-limit).
if (process.env.TRUST_PROXY || process.env.NODE_ENV === 'production') {
    // If TRUST_PROXY is set to a specific value use it, otherwise trust the first proxy.
    app.set('trust proxy', process.env.TRUST_PROXY || 1);
}

// Slow-request logging (P0-B, docs/BUILD_IMPROVEMENTS.md): outermost middleware,
// single [PERF] JSON line for any request over 1s. PERF_LOG=true to enable —
// permanently useful, negligible overhead, quiet by default outside prod ops.
app.use(slowRequestLog);
const PORT = process.env.PORT || 3000;

app.use(
    cors({
        origin:
            process.env.NODE_ENV === 'production'
                ? process.env.APP_URL || false
                : ['http://localhost:5173', 'http://127.0.0.1:5173'],
        credentials: true
    })
);

// Apply security headers
// CSP ships in report-only mode: browsers evaluate the policy and POST violations
// to /api/csp-report, but nothing is blocked yet. Once reports are quiet for a
// while, set CSP_ENFORCE=true (env var, no redeploy needed) to switch to an
// enforcing Content-Security-Policy.
app.use(
    helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
            reportOnly: process.env.CSP_ENFORCE !== 'true',
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                scriptSrcAttr: ["'none'"], // no inline event handlers anywhere in the templates
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                imgSrc: ["'self'", 'data:', 'blob:'], // blob: for photo-crop previews
                connectSrc: ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'], // fonts.googleapis/gstatic: social-post export embeds Outfit font files
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
                reportUri: ['/api/csp-report']
            }
        }
    })
);

// Global rate limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per IP
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(globalLimiter);

app.use(express.json());
app.use(cookieParser());

// Liveness/readiness probe: verifies the process can reach its database.
// Public (allow-listed through the beta gate) so uptime monitors and Docker
// HEALTHCHECK work regardless of gate state.
app.get('/api/health', (_req, res) => {
    // Fail-safe: if the database never opens (e.g. unwritable volume), sqlite3
    // queues operations without invoking callbacks — answer 503 rather than hang,
    // because a health probe that hangs defeats its own purpose.
    let settled = false;
    const timeout = setTimeout(() => {
        if (!settled) {
            settled = true;
            res.status(503).json({ ok: false, db: 'timeout' });
        }
    }, 2000);
    timeout.unref?.();

    db.get('SELECT 1', [], (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (err) {
            console.error('Health check DB failure:', err.message);
            return res.status(503).json({ ok: false, db: false });
        }
        res.json({ ok: true, db: true, uptime: Math.round(process.uptime()) });
    });
});

// Collect Content-Security-Policy violation reports from browsers.
// Browsers POST application/csp-report bodies here when a directive trips,
// including from the beta gate page (path is allow-listed in beta-gate.ts).
const cspReportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false
});
app.post(
    '/api/csp-report',
    cspReportLimiter,
    express.json({ type: ['application/csp-report', 'application/reports+json'] }),
    (req, res) => {
        const report = req.body?.['csp-report'] ?? req.body;
        if (report && typeof report === 'object') {
            console.warn(
                '[CSP]',
                JSON.stringify({
                    directive: report['violated-directive'] ?? report.effectiveDirective,
                    blocked: report['blocked-uri'] ?? report.blockedURL,
                    page: report['document-uri'] ?? report.documentURI,
                    sourceFile: report['source-file'],
                    line: report['line-number']
                })
            );
        }
        res.status(204).end();
    }
);

// Serve profile photos
app.use('/uploads', express.static(UPLOAD_BASE_DIR));

// Beta Gate Middleware
app.use(betaGate);

// Beta Auth Route
app.post('/api/beta-auth', (req, res) => {
    const { passcode } = req.body;
    const correctPasscode = process.env.BETA_PASSCODE;

    if (!correctPasscode) {
        return res.status(500).json({ success: false, message: 'BETA_PASSCODE not configured' });
    }

    // Constant-time comparison so response latency can't be used to recover the passcode.
    const given = Buffer.from(String(passcode ?? ''), 'utf8');
    const expected = Buffer.from(correctPasscode, 'utf8');
    const passcodeOk = given.length === expected.length && crypto.timingSafeEqual(given, expected);

    if (!passcodeOk) {
        return res.status(401).json({ success: false, message: 'Invalid passcode' });
    }

    // No fallback secret: config.ts fails fast at boot when IS_BETA=true without
    // BETA_ACCESS_SECRET. This 500 is belt-and-braces for misconfigured environments.
    const secret = process.env.BETA_ACCESS_SECRET;
    if (!secret) {
        return res.status(500).json({ success: false, message: 'BETA_ACCESS_SECRET not configured' });
    }

    const token = jwt.sign({ access: true }, secret, { expiresIn: '7d' });

    res.cookie('BETA_ACCESS_TOKEN', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ success: true });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/session-types', sessionTypeRoutes);
app.use('/api/membership-types', membershipTypeRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/gear', gearRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/committee', committeeRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/gallery', galleryRoutes);

if (process.env.NODE_ENV === 'production') {
    // 1. Serve static files from the build directory (Assets MUST come first)
    const distPath = path.join(__dirname, '../dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));

    // Single source of truth for clean page routes on this server.
    // (vite.config.ts keeps its own dev-server copy — see backlog note.)
    const PAGE_ROUTES: Record<string, string> = {
        '/': 'index.html',
        '/about': 'about.html',
        '/competitions': 'competitions.html',
        '/schedule': 'schedule.html',
        '/dashboard': 'dashboard.html',
        '/dashboard/elections': 'elections.html',
        '/dashboard/gear': 'gear.html',
        '/dashboard/admin': 'admin.html',
        '/dashboard/gallery-manager': 'gallery-manager.html',
        '/dashboard/social-post': 'social-post.html',
        '/beginners': 'beginners.html',
        '/walls': 'walls.html',
        '/faq': 'faq.html',
        '/gear': 'gear.html',
        '/login': 'login.html',
        '/elections': 'elections.html',
        '/gallery': 'gallery.html',
        '/gallery-manager': 'gallery-manager.html',
        '/social-agm': 'social-post.html',
        '/beta-gate': 'beta-gate.html',
        '/verify': 'verify.html'
    };

    // 2. Page routing: known clean routes serve their entry files directly.
    //    (Replaces connect-history-api-fallback: an explicit map is typed,
    //    testable, and lets unknown URLs fall through to the branded 404
    //    instead of soft-404ing as index.html.)
    app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
        const pathname = req.path.replace(/\/+$/, '') || '/';
        if (pathname === '/') {
            return res.sendFile(path.join(distPath, 'index.html'));
        }
        const page = PAGE_ROUTES[pathname];
        if (page) {
            return res.sendFile(path.join(distPath, page));
        }
        if (pathname.startsWith('/verify/')) {
            return res.sendFile(path.join(distPath, 'verify.html'));
        }
        next(); // unknown -> terminal 404 below
    });

    // 4. Terminal handler: everything still unmatched is a genuine 404.
    //    (Previously unknown pages silently served index.html — soft-404s.)
    app.use((req, res) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'Not found' });
        }
        if (String(req.headers.accept || '').includes('text/html')) {
            return res.status(404).sendFile(path.join(distPath, '404.html'));
        }
        res.status(404).json({ error: 'Not found' });
    });
} else {
    // Also handle beta-gate in dev for testing
    app.get('/beta-gate', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/beta-gate.html'));
    });
}

export { app };

if (process.env.NODE_ENV !== 'test' || process.env.PLAYWRIGHT_TEST === 'true') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    // Hourly booking-reminder sweep (no-op under test runners)
    startReminderScheduler();
}
