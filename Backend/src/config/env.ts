import { z } from 'zod/v4';

const envSchema = z.object({
    // Server
    PORT: z.coerce.number().default(5050),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Database
    MONGO_URI: z.string().min(1, 'MONGO_URI is required').default('mongodb://localhost:27017/gaming_behavior'),

    // JWT
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    // ML Service
    ML_SERVICE_URL: z.string().url().default('http://localhost:8000'),
    ML_XGBOOST_URL: z.string().url().default('http://localhost:8001'),

    // Gmail SMTP
    GMAIL_USER: z.string().optional(),
    GMAIL_PASS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        console.error(result.error.format());
        process.exit(1);
    }

    return result.data;
}

export const env = validateEnv();
