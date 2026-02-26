if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('FATAL ERROR: JWT_SECRET must be defined in production environment.');
}

export const SECRET_KEY = process.env.JWT_SECRET || 'uscc-super-secret-key-development-only';

// Email Configuration
export const EMAIL_USER = process.env.EMAIL_USER || '';
export const EMAIL_CLIENT_ID = process.env.EMAIL_CLIENT_ID || '';
export const EMAIL_CLIENT_SECRET = process.env.EMAIL_CLIENT_SECRET || '';
export const EMAIL_REFRESH_TOKEN = process.env.EMAIL_REFRESH_TOKEN || '';
