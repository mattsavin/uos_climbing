import type { NextFunction, Request, Response } from 'express';

/**
 * Slow-request logging (P0-B in docs/BUILD_IMPROVEMENTS.md).
 *
 * Cloudflare free-plan 504s mean the origin exceeded ~100s — roughly 1,900 5xx
 * a week land on legit member paths (/api/auth/me, /, /api/gallery) and we have
 * no origin-side visibility into which requests were slow. This middleware is
 * mounted outermost (right after trust proxy), starts a timer per request and
 * emits one JSON line when the socket closes having taken over SLOW_REQUEST_MS:
 *
 *   [PERF] {"method":"GET","path":"/api/auth/me","durationMs":4123,"status":200}
 *
 * 'close' is used rather than 'finish' so client-abandoned requests (Cloudflare
 * giving up on a hung origin) are captured too.
 *
 * Gated on PERF_LOG=true so local/dev default stays quiet; overhead is one
 * process.hrtime() pair and (only for slow requests) a single log line.
 */
export const SLOW_REQUEST_MS = 1000;

/** Path segments that carry bearer-equivalent secrets (calendar/verify tokens). */
function redactPath(path: string): string {
    return path.replace(/(\/ical\/|\/verify\/)([^/?]+)/gi, '$1<redacted>');
}

export function slowRequestLog(req: Request, res: Response, next: NextFunction): void {
    if (process.env.PERF_LOG !== 'true') {
        next();
        return;
    }
    const start = process.hrtime.bigint();
    res.on('close', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        if (durationMs > SLOW_REQUEST_MS) {
            // req.originalUrl is path+query; the log wants the path only.
            const payload: Record<string, unknown> = {
                method: req.method,
                path: redactPath(req.originalUrl.split('?')[0]),
                durationMs: Math.round(durationMs),
                status: res.statusCode
            };
            // Client gave up (Cloudflare abandoning a hung origin): nothing was
            // sent, so the statusCode is just the default. Flag it so slow logs
            // don't read as server responses.
            if (!res.writableEnded) payload.aborted = true;
            console.log(`[PERF] ${JSON.stringify(payload)}`);
        }
    });
    next();
}
