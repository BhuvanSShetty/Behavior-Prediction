import { z } from 'zod/v4';

export const updateControlsSchema = {
    body: z.object({
        dailyLimitMinutes: z.number().positive().optional(),
        nightRestriction: z.boolean().optional(),
    }),
    params: z.object({
        childId: z.string().min(1, 'childId is required'),
    }),
};

export const linkChildSchema = {
    body: z.object({
        identifier: z.string().min(1, "Child's name or email is required"),
    }),
};

export const childIdParamSchema = {
    params: z.object({
        childId: z.string().min(1, 'childId is required'),
    }),
};
