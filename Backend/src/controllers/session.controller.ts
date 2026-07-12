import type { Request, Response } from 'express';
import { sessionService } from '../services/SessionService.js';
import type { IAuthenticatedRequest } from '../interfaces/index.js';

export const logSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as IAuthenticatedRequest;
        const userId = authReq.user._id.toString();
        const { raw } = req.body as { raw?: { start?: string; end?: string; duration?: number } };

        if (!raw?.start || !raw?.end || raw?.duration == null) {
            res.status(400).json({
                message: 'raw.start, raw.end and raw.duration are required',
            });
            return;
        }

        const result = await sessionService.logSession(userId, {
            start: raw.start,
            end: raw.end,
            duration: raw.duration,
        });

        res.status(201).json(result);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};

export const getMySessions = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as IAuthenticatedRequest;
        const sessions = await sessionService.getMySessions(
            authReq.user._id.toString(),
        );
        res.json(sessions);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};

export const submitSessionFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as IAuthenticatedRequest;
        const { sessionId } = req.params as { sessionId: string };
        const { isCorrect, actualState } = req.body as {
            isCorrect?: boolean;
            actualState?: string;
        };

        if (typeof isCorrect !== 'boolean') {
            res.status(400).json({ message: 'isCorrect (boolean) is required' });
            return;
        }

        const result = await sessionService.submitFeedback(
            sessionId,
            authReq.user._id.toString(),
            isCorrect,
            actualState as 'Normal' | 'Frustrated' | 'Addicted' | undefined,
        );

        res.json(result);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};
