import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

import { env } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import sessionRoutes from './routes/session.routes.js';
import parentRoutes from './routes/parent.routes.js';
import predictionRoutes from './routes/prediction.routes.js';

// ── Logger ───────────────────────────────────────────────────────────────────

export const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
        env.NODE_ENV !== 'production'
            ? { target: 'pino/file', options: { destination: 1 } }
            : undefined,
});

// ── App ──────────────────────────────────────────────────────────────────────

const app = express();

// Trust proxy (for rate-limiter behind reverse proxy like Nginx)
app.set('trust proxy', 1);

// Request ID
app.use((_req: Request, res: Response, next: NextFunction) => {
    const requestId = uuidv4();
    res.setHeader('X-Request-Id', requestId);
    next();
});

// Security headers
app.use(helmet());

// Compression
app.use(compression());

// CORS
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,               // limit each IP to 100 requests per windowMs
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));

// HTTP request logging (Pino)
app.use(
    pinoHttp({
        logger,
        autoLogging: env.NODE_ENV === 'production',
    }),
);

// ── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/predictions', predictionRoutes);

app.get('/', (_req, res) => {
    res.json({ status: 'Gaming Behavior Backend running ' });
});

// Global error handler (must be after all routes)
app.use(errorHandler);

export default app;
