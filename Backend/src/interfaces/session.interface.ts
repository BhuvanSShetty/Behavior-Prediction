import type { Document, Types } from 'mongoose';

export interface ISessionRaw {
    start: Date;
    end: Date;
    duration: number; // minutes
}

export interface ISessionFeatures {
    avgSessionDuration: number;
    shortSessionRatio: number;
    reopenCount: number;
    interSessionGap: number;
    dailyTotalTime: number;
    sessionsPerDay: number;
    nightCount: number;
    trend: number;
}

export type PredictionState = 'Normal' | 'Frustrated' | 'Addicted' | 'Unknown';

export interface IPrediction {
    state: PredictionState;
    confidence: number;
    addictionRisk: number; // 0–100
}

export interface IAlerts {
    addictionAlert: boolean;
    nightGamingAlert: boolean;
    playtimeLimitExceeded: boolean;
}

export interface IFeedback {
    provided: boolean;
    isCorrect: boolean | null;
    actualState: PredictionState;
    providedAt: Date | null;
}

export interface ISession {
    userId: Types.ObjectId;
    raw: ISessionRaw;
    features: ISessionFeatures;
    prediction: IPrediction;
    feedback: IFeedback;
    alerts: IAlerts;
    createdAt: Date;
    updatedAt: Date;
}

export type ISessionDocument = Document<Types.ObjectId, object, ISession> & ISession & {
    _id: Types.ObjectId;
};
