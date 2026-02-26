import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import adminRoutes from './routes/admin';
import sessionRoutes from './routes/sessions';
import sessionTypeRoutes from './routes/session-types';
import votingRoutes from './routes/voting';
import gearRoutes from './routes/gear';
import path from 'path';
import { fileURLToPath } from 'url';
import history from 'connect-history-api-fallback';
import cookieParser from 'cookie-parser';

// ESM dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? true : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/session-types', sessionTypeRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/gear', gearRoutes);

// Shared route for iCal (also registered in sessions.ts but keeping here for backward compatibility if needed, 
// though /api/sessions/ical/:userId is preferred now. The original was /api/ical/:userId)
app.use('/api/ical', (req, res, next) => {
    // Forward /api/ical/:userId to sessions router logic if desired, 
    // but we can just use the sessions router directly by prefixing it.
    next();
});

if (process.env.NODE_ENV === 'production') {
    // 1. Serve static files from the build directory (Assets MUST come first)
    const distPath = path.join(__dirname, '../dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));

    // 2. Fallback for SPA routing - handles page refreshes on sub-routes
    app.use(history({
        rewrites: [
            // Ensure requests to '/api' aren't intercepted by history
            { from: /^\/api\/.*$/, to: function (context: any) { return context.parsedUrl?.pathname || '/'; } },

            // Re-route Vite's HTML entrypoints
            { from: /^\/dashboard$/, to: '/dashboard.html' },
            { from: /^\/about$/, to: '/about.html' },
            { from: /^\/join$/, to: '/join.html' },
            { from: /^\/competitions$/, to: '/competitions.html' },
            { from: /^\/gear$/, to: '/gear.html' },
            { from: /^\/login$/, to: '/login.html' },
            { from: /^\/elections$/, to: '/elections.html' }
        ]
    }));
}

export { app };


if (process.env.NODE_ENV !== 'test' || process.env.PLAYWRIGHT_TEST === 'true') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
