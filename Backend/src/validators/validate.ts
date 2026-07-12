import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';

/**
 * Generic validation middleware factory.
 * Validates req.body, req.params, and req.query against provided Zod schemas.
 */
export function validate(schema: {
    body?: z.ZodType;
    params?: z.ZodType;
    query?: z.ZodType;
}) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const errors: Array<{ location: string; issues: z.ZodError['issues'] }> = [];

        if (schema.body) {
            const result = schema.body.safeParse(req.body);
            if (!result.success) {
                errors.push({ location: 'body', issues: result.error.issues });
            } else {
                req.body = result.data;
            }
        }

        if (schema.params) {
            const result = schema.params.safeParse(req.params);
            if (!result.success) {
                errors.push({ location: 'params', issues: result.error.issues });
            }
        }

        if (schema.query) {
            const result = schema.query.safeParse(req.query);
            if (!result.success) {
                errors.push({ location: 'query', issues: result.error.issues });
            }
        }

        if (errors.length > 0) {
            res.status(400).json({
                message: 'Validation failed',
                errors: errors.map((e) => ({
                    location: e.location,
                    issues: e.issues.map((i) => ({
                        path: i.path.join('.'),
                        message: i.message,
                    })),
                })),
            });
            return;
        }

        next();
    };
}
