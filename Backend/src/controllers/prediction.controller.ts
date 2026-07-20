import type { Request, Response } from 'express';
import { predictionClient } from '../services/PredictionClient.js';
import { retrainService } from '../services/RetrainService.js';
import type { ISessionFeatures } from '../interfaces/index.js';

export const predict = async (req: Request, res: Response): Promise<void> => {
    try {
        const { features } = req.body as { features: ISessionFeatures };
        const result = await predictionClient.predict(features);
        res.json(result);
    } catch (err) {
        const error = err as Error;
        res.status(503).json({ message: 'ML service unavailable', error: error.message });
    }
};

export const mlHealth = async (_req: Request, res: Response): Promise<void> => {
    const result = await predictionClient.healthCheck();
    if (result.status === 'ML service reachable') {
        res.json({ status: result.status, data: result.data });
    } else {
        res.status(503).json({ status: result.status, error: result.data });
    }
};

export const retrainModel = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await retrainService.triggerRetrain();
        res.json(result);
    } catch (err) {
        const error = err as Error;
        res.status(503).json({
            message: 'Retrain failed',
            error: error.message,
        });
    }
};

export const getRetrainStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await retrainService.getRetrainStatus();
        res.json(result);
    } catch (err) {
        const error = err as Error;
        res.status(503).json({
            message: 'Could not fetch retrain status',
            error: error.message,
        });
    }
};

export const getFeedbackStats = async (_req: Request, res: Response): Promise<void> => {
    try {
        const stats = await retrainService.getFeedbackStats();
        res.json(stats);
    } catch (err) {
        const error = err as Error;
        res.status(500).json({
            message: 'Could not fetch feedback stats',
            error: error.message,
        });
    }
};
