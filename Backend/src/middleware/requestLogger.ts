import type { Request, Response, NextFunction } from 'express';

/**
 * Simple request logger middleware.
 * Logs method, URL, status code, and response time.
 */
export const requestLogger = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
            `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
        );
    });

    next();
};
