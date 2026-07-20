import type { ISessionRaw, PredictionState } from '../interfaces/index.js';

export interface LogSessionRequest {
    raw: ISessionRaw;
}

export interface FeedbackRequest {
    isCorrect: boolean;
    actualState?: PredictionState;
}
