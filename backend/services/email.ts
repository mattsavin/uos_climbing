import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import {
    EMAIL_USER,
    EMAIL_CLIENT_ID,
    EMAIL_CLIENT_SECRET,
    EMAIL_REFRESH_TOKEN,
    RESEND_API_KEY,
    EMAIL_FROM
} from '../config';

const OAuth2 = google.auth.OAuth2;

function canUseResend() {
    return !!RESEND_API_KEY && !!EMAIL_FROM;
}

function canUseGmail() {
    return !!EMAIL_USER && !!EMAIL_CLIENT_ID && !!EMAIL_CLIENT_SECRET && !!EMAIL_REFRESH_TOKEN;
}

async function createResendTransporter() {
    return nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: { user: 'resend', pass: RESEND_API_KEY }
    });
}

async function createGmailTransporter() {
    const oauth2Client = new OAuth2(
        EMAIL_CLIENT_ID,
        EMAIL_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
        refresh_token: EMAIL_REFRESH_TOKEN
    });

    const accessToken = await new Promise<string>((resolve, reject) => {
        oauth2Client.getAccessToken((err, token) => {
            if (err || !token) {
                reject(err || new Error('Failed to create Gmail access token'));
                return;
            }
            resolve(token as string);
        });
    });

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: EMAIL_USER,
            accessToken,
            clientId: EMAIL_CLIENT_ID,
            clientSecret: EMAIL_CLIENT_SECRET,
            refreshToken: EMAIL_REFRESH_TOKEN
        }
    });
}

async function sendWithResend(to: string, subject: string, text: string, html?: string) {
    const transporter = await createResendTransporter();
    return transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html: html || text
    });
}

async function sendWithGmail(to: string, subject: string, text: string, html?: string) {
    const transporter = await createGmailTransporter();
    return transporter.sendMail({
        from: EMAIL_USER,
        to,
        subject,
        text,
        html: html || text
    });
}

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
    const resendEnabled = canUseResend();
    const gmailEnabled = canUseGmail();

    if (!resendEnabled && !gmailEnabled) {
        console.warn('No email provider configured. Skipping email send to:', to);
        return false;
    }

    // Resend is primary; Gmail is fallback.
    if (resendEnabled) {
        try {
            const result = await sendWithResend(to, subject, text, html);
            console.log('Email sent via Resend:', result?.messageId || '');
            return true;
        } catch (error) {
            console.error('Resend send failed:', error);
            if (!gmailEnabled) return false;
            console.warn('Falling back to Gmail OAuth2 sender...');
        }
    }

    if (gmailEnabled) {
        try {
            const result = await sendWithGmail(to, subject, text, html);
            console.log('Email sent via Gmail fallback:', result?.messageId || '');
            return true;
        } catch (error) {
            console.error('Gmail fallback send failed:', error);
            return false;
        }
    }

    return false;
};
