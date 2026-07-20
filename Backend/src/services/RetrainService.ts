import axios from 'axios';
import { env } from '../config/index.js';
import { sessionRepository } from '../repositories/SessionRepository.js';
import type { ISessionDocument } from '../interfaces/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface FeedbackRow {
    sessionId: string;
    avgSessionDuration: number;
    shortSessionRatio: number;
    reopenCount: number;
    interSessionGap: number;
    dailyTotalTime: number;
    sessionsPerDay: number;
    nightCount: number;
    trend: number;
    actualState: string;
}

interface RetrainResponse {
    status: string;
    feedbackSamples: number;
    metrics: {
        trainAcc: number;
        testAcc: number;
        balancedAcc: number;
        f1Macro: number;
        f1Weighted: number;
        cvMean: number;
        cvStd: number;
    };
    trainedAt: string;
}

interface RetrainStatusResponse {
    trainedAt: string;
    classes: string[];
    feedbackSamples: number;
    metrics: Record<string, number>;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class RetrainService {
    private readonly mlUrl: string;

    constructor() {
        this.mlUrl = env.ML_SERVICE_URL;
    }

    /**
     * Query all sessions with feedback across ALL users,
     * format them as rows the ML service expects.
     */
    async exportFeedback(): Promise<FeedbackRow[]> {
        const sessions: ISessionDocument[] =
            await sessionRepository.findAllWithFeedback();

        return sessions.map((s) => ({
            sessionId: s._id.toString(),
            avgSessionDuration: s.features.avgSessionDuration,
            shortSessionRatio: s.features.shortSessionRatio,
            reopenCount: s.features.reopenCount,
            interSessionGap: s.features.interSessionGap,
            dailyTotalTime: s.features.dailyTotalTime,
            sessionsPerDay: s.features.sessionsPerDay,
            nightCount: s.features.nightCount,
            trend: s.features.trend,
            actualState: s.feedback.actualState,
        }));
    }

    /**
     * Export feedback from MongoDB and POST it to the ML service's /retrain endpoint.
     */
    async triggerRetrain(): Promise<RetrainResponse> {
        const feedbackRows = await this.exportFeedback();

        const response = await axios.post<RetrainResponse>(
            `${this.mlUrl}/retrain`,
            { feedbackRows },
            { timeout: 120_000 }, // training can take a while
        );

        return response.data;
    }

    /**
     * Get current model status from the ML service.
     */
    async getRetrainStatus(): Promise<RetrainStatusResponse> {
        const response = await axios.get<RetrainStatusResponse>(
            `${this.mlUrl}/retrain/status`,
            { timeout: 5000 },
        );
        return response.data;
    }

    /**
     * Get aggregated feedback stats from MongoDB.
     */
    async getFeedbackStats() {
        return sessionRepository.aggregateFeedbackStats();
    }
}

export const retrainService = new RetrainService();
