import type { Request, Response } from 'express';
import { parentService } from '../services/ParentService.js';
import type { IAuthenticatedRequest } from '../interfaces/index.js';

export const getChildDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as IAuthenticatedRequest;
        const { childId } = req.params as { childId: string };
        const result = await parentService.getChildDashboard(
            authReq.user._id.toString(),
            childId,
        );
        res.json(result);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};

export const getChildWeeklyPlaytime = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as IAuthenticatedRequest;
        const { childId } = req.params as { childId: string };
        const result = await parentService.getChildWeeklyPlaytime(
            authReq.user._id.toString(),
            childId,
        );
        res.json(result);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};

export const getChildren = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as IAuthenticatedRequest;
        const children = await parentService.getChildren(
            authReq.user._id.toString(),
        );
        res.json(children);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};

export const updateControls = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as IAuthenticatedRequest;
        const { childId } = req.params as { childId: string };
        const { dailyLimitMinutes, nightRestriction } = req.body as {
            dailyLimitMinutes?: number;
            nightRestriction?: boolean;
        };
        const result = await parentService.updateControls(
            authReq.user._id.toString(),
            childId,
            { dailyLimitMinutes, nightRestriction },
        );
        res.json(result);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};

export const linkChild = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as IAuthenticatedRequest;
        const { childId } = req.body as { childId: string };
        const result = await parentService.linkChild(
            authReq.user._id.toString(),
            childId,
        );
        res.json(result);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};
