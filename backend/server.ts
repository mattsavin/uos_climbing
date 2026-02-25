import express from 'express';
import cors from 'cors';
import { db } from './db';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import adminRoutes from './routes/admin';
import sessionRoutes from './routes/sessions';
import votingRoutes from './routes/voting';
import gearRoutes from './routes/gear';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/gear', gearRoutes);

// Shared route for iCal (also registered in sessions.ts but keeping here for backward compatibility if needed, 
// though /api/sessions/ical/:userId is preferred now. The original was /api/ical/:userId)
app.use('/api/ical', (req, res, next) => {
    // Forward /api/ical/:userId to sessions router logic if desired, 
    // but we can just use the sessions router directly by prefixing it.
    next();
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
