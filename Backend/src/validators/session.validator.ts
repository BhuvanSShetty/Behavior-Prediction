import { z } from 'zod/v4';

export const logSessionSchema = {
    body: z.object({
        raw: z.object({
            start: z.string().min(1, 'raw.start is required'),
            end: z.string().min(1, 'raw.end is required'),
            duration: z.number({ message: 'raw.duration must be a number' }),
        }),
    }),
};

export const feedbackSchema = {
    body: z.object({
        isCorrect: z.boolean({ message: 'isCorrect (boolean) is required' }),
        actualState: z.enum(['Normal', 'Frustrated', 'Addicted']).optional(),
    }),
    params: z.object({
        sessionId: z.string().min(1, 'sessionId is required'),
    }),
};
