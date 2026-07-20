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

        try {
            const response = await axios.post<IPrediction>(
                `${this.baseUrl}/predict`,
                { features },
                { timeout: 5000 },
            );
            return response.data;
        } catch {
            console.warn('ML service unreachable — prediction skipped');
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
