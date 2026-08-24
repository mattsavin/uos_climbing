import path from 'path';
import os from 'os';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET must be defined in production environment.');
}

export const SECRET_KEY = process.env.JWT_SECRET || 'uscc-super-secret-key-development-only';

// Beta gate configuration.
// When IS_BETA=true the site sits behind a passcode gate whose tokens are signed with
// BETA_ACCESS_SECRET, so it must be provided explicitly — an unset secret would make the
// gate forgeable by anyone who reads the public source.
if (process.env.IS_BETA === 'true' && !process.env.BETA_ACCESS_SECRET) {
    throw new Error('FATAL ERROR: BETA_ACCESS_SECRET must be defined when IS_BETA=true.');
}

// Root admin bootstrap password for NON-PRODUCTION environments only (local dev / tests).
// Production generates a unique random password on first boot instead — see db.ts.
export const DEV_ROOT_PASSWORD = process.env.DEV_ROOT_PASSWORD || 'SuperSecret123!';

// Email Configuration
export const EMAIL_USER = process.env.EMAIL_USER || '';
export const EMAIL_CLIENT_ID = process.env.EMAIL_CLIENT_ID || '';
export const EMAIL_CLIENT_SECRET = process.env.EMAIL_CLIENT_SECRET || '';
export const EMAIL_REFRESH_TOKEN = process.env.EMAIL_REFRESH_TOKEN || '';
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const EMAIL_FROM = process.env.EMAIL_FROM || '';

// Uploads Directory Configuration
export const UPLOAD_BASE_DIR = process.env.NODE_ENV === 'production'
    ? '/data/uploads'
    : process.env.NODE_ENV === 'test'
        ? path.join(os.tmpdir(), 'uos_test_uploads')
        : path.join(process.cwd(), 'uploads');
