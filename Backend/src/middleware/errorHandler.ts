import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/index.js';

/**
 * Global error handling middleware.
 * Must be registered AFTER all routes.
 */
export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            message: err.message,
        });
        return;
    }

    // Unhandled errors
    console.error('Unhandled error:', err);
    res.status(500).json({
        message: 'Internal server error',
    });
};
