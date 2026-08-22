import axios from 'axios';
import { env } from '../config/index.js';
import type { ISessionFeatures, IPrediction } from '../interfaces/index.js';

export class PredictionClient {
    private readonly baseUrl: string;

    constructor() {
        this.baseUrl = env.ML_SERVICE_URL;
    }

    async predict(features: ISessionFeatures): Promise<IPrediction> {
        const fallback: IPrediction = {
            state: 'Unknown',
            confidence: 0,
            addictionRisk: 0,
        };

        const url = `${this.baseUrl}/predict`;
        try {
            console.log(`[PredictionClient] Calling ML service: POST ${url}`);
            const response = await axios.post<IPrediction>(
                url,
                { features },
                { timeout: 5000 },
            );
            console.log(`[PredictionClient] ML response:`, JSON.stringify(response.data));
            return response.data;
        } catch (err: unknown) {
            const axiosErr = err as { message?: string; code?: string; response?: { status?: number; data?: unknown } };
            console.error(`[PredictionClient] ML service error calling ${url}:`, {
                message: axiosErr.message,
                code: axiosErr.code,
                status: axiosErr.response?.status,
                data: axiosErr.response?.data,
            });
            return fallback;
        }
    }

    async healthCheck(): Promise<{ status: string; data?: unknown }> {
        try {
            const response = await axios.get(`${this.baseUrl}/health`, {
                timeout: 5000,
            });
            return { status: 'ML service reachable', data: response.data };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return { status: 'ML service unreachable', data: message };
        }
    }
}

export const predictionClient = new PredictionClient();
