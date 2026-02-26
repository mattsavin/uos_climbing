import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { EMAIL_USER, EMAIL_CLIENT_ID, EMAIL_CLIENT_SECRET, EMAIL_REFRESH_TOKEN } from '../config';

const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
    try {
        const oauth2Client = new OAuth2(
            EMAIL_CLIENT_ID,
            EMAIL_CLIENT_SECRET,
            "https://developers.google.com/oauthplayground"
        );

        oauth2Client.setCredentials({
            refresh_token: EMAIL_REFRESH_TOKEN
        });

        const accessToken = await new Promise<string>((resolve, reject) => {
            oauth2Client.getAccessToken((err, token) => {
                if (err) {
                    console.error('Error creating access token', err);
                    reject('Failed to create access token');
                }
                resolve(token as string);
            });
        });

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: EMAIL_USER,
                accessToken,
                clientId: EMAIL_CLIENT_ID,
                clientSecret: EMAIL_CLIENT_SECRET,
                refreshToken: EMAIL_REFRESH_TOKEN
            }
        });

        return transporter;
    } catch (error) {
        console.error('Error creating email transporter:', error);
        throw error;
    }
};

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
    try {
        if (!EMAIL_USER || !EMAIL_CLIENT_ID || !EMAIL_CLIENT_SECRET || !EMAIL_REFRESH_TOKEN) {
            console.warn('Email credentials not fully configured. Skipping email send to:', to);
            return false;
        }

        const emailTransporter = await createTransporter();
        const mailOptions = {
            from: EMAIL_USER,
            to,
            subject,
            text,
            html: html || text
        };

        const result = await emailTransporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};
