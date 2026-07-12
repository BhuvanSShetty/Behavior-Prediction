import { describe, it, expect } from 'vitest';
import { computeFeatures, evaluateAlerts } from '../../services/FeatureEngine.js';
import type { ISessionFeatures, IPrediction } from '../../interfaces/index.js';

describe('FeatureEngine', () => {
    describe('computeFeatures', () => {
        const baseSession = {
            start: '2026-07-12T10:00:00+05:30',
            end: '2026-07-12T10:30:00+05:30',
            duration: 30,
        };

        it('should compute features for a single session', () => {
            const features = computeFeatures(baseSession);

            expect(features.avgSessionDuration).toBe(30);
            expect(features.dailyTotalTime).toBe(30);
            expect(features.sessionsPerDay).toBe(1);
            expect(features.shortSessionRatio).toBe(0);
            expect(features.reopenCount).toBe(0);
            expect(features.interSessionGap).toBe(0);
            expect(features.nightCount).toBe(0);
        });

        it('should count short sessions correctly', () => {
            const shortSession = {
                start: '2026-07-12T11:00:00+05:30',
                end: '2026-07-12T11:03:00+05:30',
                duration: 3,
            };

            const features = computeFeatures(shortSession, [baseSession]);

            expect(features.sessionsPerDay).toBe(2);
            expect(features.shortSessionRatio).toBe(0.5);
        });

        it('should detect reopens (gaps < 2 min)', () => {
            const quickReopen = {
                start: '2026-07-12T10:31:00+05:30',
                end: '2026-07-12T10:45:00+05:30',
                duration: 14,
            };

            const features = computeFeatures(quickReopen, [baseSession]);

            expect(features.reopenCount).toBe(1);
        });

        it('should compute inter-session gap', () => {
            const laterSession = {
                start: '2026-07-12T12:00:00+05:30',
                end: '2026-07-12T12:30:00+05:30',
                duration: 30,
            };

            const features = computeFeatures(laterSession, [baseSession]);

            // Gap between 10:30 and 12:00 = 90 minutes
            expect(features.interSessionGap).toBe(90);
        });

        it('should detect night gaming (0–4 AM IST)', () => {
            const nightSession = {
                start: '2026-07-12T01:00:00+05:30',
                end: '2026-07-12T01:30:00+05:30',
                duration: 30,
            };

            const features = computeFeatures(nightSession);

            expect(features.nightCount).toBe(1);
        });

        it('should compute daily total across multiple sessions', () => {
            const session2 = {
                start: '2026-07-12T14:00:00+05:30',
                end: '2026-07-12T14:45:00+05:30',
                duration: 45,
            };

            const features = computeFeatures(session2, [baseSession]);

            expect(features.dailyTotalTime).toBe(75);
        });

        it('should compute trend from weekly data', () => {
            const weekSessions = [
                {
                    start: '2026-07-06T10:00:00+05:30',
                    end: '2026-07-06T10:20:00+05:30',
                    duration: 20,
                },
            ];

            const features = computeFeatures(baseSession, [], weekSessions);

            // trend = dailyTotalTime(30) - oldestDayTotal(20) = 10
            expect(features.trend).toBe(10);
        });
    });

    describe('evaluateAlerts', () => {
        const baseFeatures: ISessionFeatures = {
            avgSessionDuration: 30,
            shortSessionRatio: 0,
            reopenCount: 0,
            interSessionGap: 0,
            dailyTotalTime: 60,
            sessionsPerDay: 2,
            nightCount: 0,
            trend: 0,
        };

        const basePrediction: IPrediction = {
            state: 'Normal',
            confidence: 0.9,
            addictionRisk: 30,
        };

        it('should return no alerts for normal behavior', () => {
            const alerts = evaluateAlerts(baseFeatures, basePrediction);

            expect(alerts.addictionAlert).toBe(false);
            expect(alerts.nightGamingAlert).toBe(false);
            expect(alerts.playtimeLimitExceeded).toBe(false);
        });

        it('should trigger addiction alert when risk > 70', () => {
            const prediction = { ...basePrediction, addictionRisk: 80 };
            const alerts = evaluateAlerts(baseFeatures, prediction);

            expect(alerts.addictionAlert).toBe(true);
        });

        it('should trigger addiction alert when state is Addicted', () => {
            const prediction: IPrediction = { ...basePrediction, state: 'Addicted' };
            const alerts = evaluateAlerts(baseFeatures, prediction);

            expect(alerts.addictionAlert).toBe(true);
        });

        it('should trigger night gaming alert when nightCount > 0', () => {
            const features = { ...baseFeatures, nightCount: 1 };
            const alerts = evaluateAlerts(features, basePrediction);

            expect(alerts.nightGamingAlert).toBe(true);
        });

        it('should trigger playtime limit exceeded alert', () => {
            const features = { ...baseFeatures, dailyTotalTime: 150 };
            const controls = { dailyLimitMinutes: 120 };
            const alerts = evaluateAlerts(features, basePrediction, controls);

            expect(alerts.playtimeLimitExceeded).toBe(true);
        });

        it('should not trigger playtime alert when under limit', () => {
            const features = { ...baseFeatures, dailyTotalTime: 60 };
            const controls = { dailyLimitMinutes: 120 };
            const alerts = evaluateAlerts(features, basePrediction, controls);

            expect(alerts.playtimeLimitExceeded).toBe(false);
        });
    });
});
