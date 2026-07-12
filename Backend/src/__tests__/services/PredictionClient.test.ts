import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PredictionClient } from '../../services/PredictionClient.js';
import type { ISessionFeatures } from '../../interfaces/index.js';

// Mock config
vi.mock('../../config/index.js', () => ({
    env: {
        ML_SERVICE_URL: 'http://localhost:8000',
    },
}));

// Mock axios
vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
        get: vi.fn(),
    },
}));

import axios from 'axios';
const mockedAxios = vi.mocked(axios);

describe('PredictionClient', () => {
    let client: PredictionClient;

    const mockFeatures: ISessionFeatures = {
        avgSessionDuration: 30,
        shortSessionRatio: 0,
        reopenCount: 0,
        interSessionGap: 0,
        dailyTotalTime: 60,
        sessionsPerDay: 2,
        nightCount: 0,
        trend: 0,
    };

    beforeEach(() => {
        client = new PredictionClient();
        vi.clearAllMocks();
    });

    describe('predict', () => {
        it('should return prediction from ML service', async () => {
            const mockPrediction = {
                state: 'Normal' as const,
                confidence: 0.95,
                addictionRisk: 10,
            };
            mockedAxios.post.mockResolvedValue({ data: mockPrediction });

            const result = await client.predict(mockFeatures);

            expect(result).toEqual(mockPrediction);
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'http://localhost:8000/predict',
                { features: mockFeatures },
                { timeout: 5000 },
            );
        });

        it('should return fallback when ML service is unreachable', async () => {
            mockedAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));

            const result = await client.predict(mockFeatures);

            expect(result).toEqual({
                state: 'Unknown',
                confidence: 0,
                addictionRisk: 0,
            });
        });
    });

    describe('healthCheck', () => {
        it('should return reachable status when service is up', async () => {
            mockedAxios.get.mockResolvedValue({ data: { status: 'ok' } });

            const result = await client.healthCheck();

            expect(result.status).toBe('ML service reachable');
        });

        it('should return unreachable status when service is down', async () => {
            mockedAxios.get.mockRejectedValue(new Error('timeout'));

            const result = await client.healthCheck();

            expect(result.status).toBe('ML service unreachable');
        });
    });
});
