import axios from 'axios';
import { env } from '../config/index.js';
import type { ISessionFeatures, IPrediction } from '../interfaces/index.js';

export class XGBoostPredictionClient {
    private readonly baseUrl: string;

    constructor() {
        this.baseUrl = env.ML_XGBOOST_URL;
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
            console.warn('XGBoost ML service unreachable — prediction skipped');
            return fallback;
        }
    }

    async healthCheck(): Promise<{ status: string; data?: unknown }> {
        try {
            const response = await axios.get(`${this.baseUrl}/health`, {
                timeout: 5000,
            });
            return { status: 'XGBoost ML service reachable', data: response.data };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return { status: 'XGBoost ML service unreachable', data: message };
        }
    }

    async getStatus(): Promise<any> {
        try {
            const response = await axios.get(`${this.baseUrl}/retrain/status`, {
                timeout: 5000,
            });
            return response.data;
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    }
}

export const xgboostPredictionClient = new XGBoostPredictionClient();
