import { env } from './env.js';

export const mailConfig = {
    service: 'gmail' as const,
    user: env.GMAIL_USER,
    pass: env.GMAIL_PASS,
    get isConfigured(): boolean {
        return Boolean(this.user && this.pass);
    },
} as const;
