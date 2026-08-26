import { Request, Response, NextFunction } from 'express';

/**
 * URL prefixes reserved by scanners/tooling that this site will never serve.
 * Derived from Cloudflare path aggregates for sheffieldclimbing.org — FR bot
 * traffic was 35.8% of origin requests (2026-08-26 baseline), mostly probing
 * these paths. Methodology: `python3 ~/.local/bin/cfq.py aggregate`, spec in
 * docs/BUILD_IMPROVEMENTS.md (P1). Each leak-through probe used to run the
 * full middleware chain and consume global rate-limiter budget shared with
 * real members; anything matching here is answered 404 before the limiter.
 */
export const SCANNER_PATH_PREFIXES: readonly string[] = [
    '/.env',
    '/.git',
    '/wp-admin',
    '/wp-login',
    '/config/',
    '/actuator/',
    '/phpmyadmin'
];

export const scannerFastFail = (req: Request, res: Response, next: NextFunction) => {
    // Decode + lowercase before matching so %2e-encoded or case-shifted probes
    // (/.ENV, /%2Eenv) short-circuit too. decodeURIComponent never throws on
    // normal paths, but malformed sequences exist, hence the guarded fallback.
    let path = req.path;
    try {
        path = decodeURIComponent(path).toLowerCase();
    } catch {
        /* keep raw path */
    }

    if (SCANNER_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        return res.status(404).type('text/plain').send('Not found');
    }
    next();
};
