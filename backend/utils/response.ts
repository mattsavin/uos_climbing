import { Response } from 'express';

export function standardDbResponse(res: Response, successPayload: any = { success: true }) {
    return function (err: Error | null) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(successPayload);
    };
}
