import { vi } from 'vitest';

// Global mock for nodemailer to prevent real emails from being sent during tests
vi.mock('nodemailer', () => {
    return {
        default: {
            createTransport: vi.fn().mockReturnValue({
                sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id' })
            })
        }
    };
});

// Global mock for googleapis to prevent real authentication calls during tests
vi.mock('googleapis', () => {
    return {
        google: {
            auth: {
                OAuth2: class {
                    setCredentials = vi.fn();
                    getAccessToken = vi.fn().mockImplementation((callback: any) => {
                        callback(null, 'mock-access-token');
                    });
                }
            }
        }
    };
});
