import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies

vi.mock('../../backend/config', () => {
    return {
        EMAIL_USER: 'test@example.com',
        EMAIL_CLIENT_ID: 'mock-client-id',
        EMAIL_CLIENT_SECRET: 'mock-client-secret',
        EMAIL_REFRESH_TOKEN: 'mock-refresh-token'
    };
});

vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn().mockReturnValue({
            sendMail: vi.fn().mockResolvedValue(true)
        })
    }
}));

vi.mock('googleapis', () => ({
    google: {
        auth: {
            OAuth2: class {
                setCredentials() { }
                getAccessToken(cb: any) {
                    cb(null, 'mock-access-token')
                }
            }
        }
    }
}));

import { sendEmail } from '../../backend/services/email';
import nodemailer from 'nodemailer';

describe('Email Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully send an email', async () => {
        const result = await sendEmail('user@example.com', 'Test Subject', 'Test Body', '<p>Test Body</p>');
        expect(result).toBe(true);
        expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });
});
