import { z } from 'zod/v4';

export const registerSchema = {
    body: z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.email('Invalid email address'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        role: z.enum(['child', 'parent', 'admin']),
        ageGroup: z.enum(['10-12', '13-15', '16-18', '19-24', '24+']).optional(),
        parentCode: z.string().optional(),
    }),
};

export const loginSchema = {
    body: z.object({
        email: z.email('Invalid email address'),
        password: z.string().min(1, 'Password is required'),
    }),
};
