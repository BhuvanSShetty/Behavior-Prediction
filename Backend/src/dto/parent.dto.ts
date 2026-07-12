import type { PredictionState, IAlerts } from '../interfaces/index.js';

export interface UpdateControlsRequest {
    dailyLimitMinutes?: number;
    nightRestriction?: boolean;
}

export interface LinkChildRequest {
    childId: string;
}

export interface ParentDashboardResponse {
    childId: string;
    todayPlayTime: number;
    sessionCount: number;
    state: PredictionState;
    addictionRisk: number;
    trend: number;
    nightSessions: number;
    alerts: IAlerts | Record<string, never>;
}

export interface WeeklyPlaytimeDay {
    day: string;
    min: number;
}

export interface WeeklyPlaytimeResponse {
    childId: string;
    dailyBreakdown: WeeklyPlaytimeDay[];
}

export interface PredictionResponse {
    state: PredictionState;
    confidence: number;
    addictionRisk: number;
}
