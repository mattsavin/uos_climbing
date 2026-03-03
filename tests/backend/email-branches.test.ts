import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadEmailService(config: {
    EMAIL_USER?: string;
    EMAIL_CLIENT_ID?: string;
    EMAIL_CLIENT_SECRET?: string;
    EMAIL_REFRESH_TOKEN?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
}, sendMailImpl: (...args: any[]) => Promise<any>) {
    vi.resetModules();

    const createTransport = vi.fn().mockImplementation(() => ({
        sendMail: vi.fn().mockImplementation(sendMailImpl)
    }));

    vi.doMock('../../backend/config', () => ({
        EMAIL_USER: config.EMAIL_USER || '',
        EMAIL_CLIENT_ID: config.EMAIL_CLIENT_ID || '',
        EMAIL_CLIENT_SECRET: config.EMAIL_CLIENT_SECRET || '',
        EMAIL_REFRESH_TOKEN: config.EMAIL_REFRESH_TOKEN || '',
        RESEND_API_KEY: config.RESEND_API_KEY || '',
        EMAIL_FROM: config.EMAIL_FROM || ''
    }));
    vi.doMock('nodemailer', () => ({
        default: { createTransport }
    }));
    vi.doMock('googleapis', () => ({
        google: {
            auth: {
                OAuth2: class {
                    setCredentials() { }
                    getAccessToken(cb: any) {
                        cb(null, 'mock-access-token');
                    }
                }
            }
        }
    }));

    const { sendEmail } = await import('../../backend/services/email');
    return { sendEmail, createTransport };
}

describe('Email Service Branches', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns false when no email provider is configured', async () => {
        const { sendEmail } = await loadEmailService({}, async () => ({ messageId: 'x' }));
        const result = await sendEmail('user@example.com', 'Subject', 'Text');
        expect(result).toBe(false);
    });

    it('uses resend successfully when configured', async () => {
        const { sendEmail, createTransport } = await loadEmailService(
            { RESEND_API_KEY: 'rk', EMAIL_FROM: 'from@example.com' },
            async () => ({ messageId: 'resend-id' })
        );
        const result = await sendEmail('user@example.com', 'Subject', 'Text', '<p>Text</p>');
        expect(result).toBe(true);
        expect(createTransport).toHaveBeenCalledTimes(1);
    });

    it('falls back to Gmail when resend fails and Gmail is configured', async () => {
        let callCount = 0;
        const { sendEmail, createTransport } = await loadEmailService(
            {
                RESEND_API_KEY: 'rk',
                EMAIL_FROM: 'from@example.com',
                EMAIL_USER: 'gmail@example.com',
                EMAIL_CLIENT_ID: 'id',
                EMAIL_CLIENT_SECRET: 'secret',
                EMAIL_REFRESH_TOKEN: 'refresh'
            },
            async () => {
                callCount += 1;
                if (callCount === 1) throw new Error('resend failed');
                return { messageId: 'gmail-id' };
            }
        );
        const result = await sendEmail('user@example.com', 'Subject', 'Text');
        expect(result).toBe(true);
        expect(createTransport).toHaveBeenCalledTimes(2);
    });

    it('returns false when resend fails and Gmail is unavailable', async () => {
        const { sendEmail } = await loadEmailService(
            { RESEND_API_KEY: 'rk', EMAIL_FROM: 'from@example.com' },
            async () => {
                throw new Error('resend failed');
            }
        );
        const result = await sendEmail('user@example.com', 'Subject', 'Text');
        expect(result).toBe(false);
    });
});
