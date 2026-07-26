import axios from 'axios';
import { env } from '../config/index.js';
import type { ISessionFeatures, IPrediction } from '../interfaces/index.js';

export type MLModelName = 'RandomForest' | 'XGBoost';

export class PredictionClient {
    private activeModelName: MLModelName = 'RandomForest';

    private getActiveUrl(): string {
        return this.activeModelName === 'XGBoost'
            ? env.ML_XGBOOST_URL
            : env.ML_SERVICE_URL;
    }

    getActiveModel(): { activeModel: MLModelName; url: string } {
        return {
            activeModel: this.activeModelName,
            url: this.getActiveUrl(),
        };
    }

    setActiveModel(modelName: MLModelName): { activeModel: MLModelName; url: string } {
        if (modelName !== 'RandomForest' && modelName !== 'XGBoost') {
            throw new Error("Invalid model name. Must be 'RandomForest' or 'XGBoost'");
        }
        this.activeModelName = modelName;
        console.log(`🔀 Active ML model switched to: ${this.activeModelName} (${this.getActiveUrl()})`);
        return this.getActiveModel();
    }

    async predict(features: ISessionFeatures): Promise<IPrediction> {
        const fallback: IPrediction = {
            state: 'Unknown',
            confidence: 0,
            addictionRisk: 0,
        };

        try {
            const response = await axios.post<IPrediction>(
                `${this.getActiveUrl()}/predict`,
                { features },
                { timeout: 5000 },
            );
            return response.data;
        } catch {
            console.warn(`${this.activeModelName} ML service unreachable — prediction skipped`);
            return fallback;
        }
    }

    async healthCheck(): Promise<{ status: string; data?: unknown }> {
        try {
            const response = await axios.get(`${this.getActiveUrl()}/health`, {
                timeout: 5000,
            });
            return { status: `${this.activeModelName} ML service reachable`, data: response.data };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return { status: `${this.activeModelName} ML service unreachable`, data: message };
        }
    }
}

export const predictionClient = new PredictionClient();
