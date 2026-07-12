import { sessionRepository } from '../repositories/SessionRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import { predictionClient } from './PredictionClient.js';
import { notificationService } from './NotificationService.js';
import { computeFeatures, evaluateAlerts } from './FeatureEngine.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import type { ISessionDocument, ISessionFeatures, IPrediction, IAlerts, PredictionState } from '../interfaces/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_FEEDBACK = new Set<PredictionState>(['Normal', 'Frustrated', 'Addicted']);

interface CurrentSession {
    start: Date;
    end: Date;
    duration: number;
}

interface SessionSlice {
    start: Date | string;
    end: Date | string;
    duration: number;
}

function getISTStartOfToday(): Date {
    const parts = new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Kolkata',
    }).formatToParts(new Date());

    const year  = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day   = parts.find((p) => p.type === 'day')?.value;

    return new Date(`${year}-${month}-${day}T00:00:00+05:30`);
}

// ── Service ──────────────────────────────────────────────────────────────────

export class SessionService {
    async logSession(
        userId: string,
        raw: { start: string | Date; end: string | Date; duration: number },
    ): Promise<{
        session: ISessionDocument;
        features: ISessionFeatures;
        prediction: IPrediction;
        alerts: IAlerts;
    }> {
        const current: CurrentSession = {
            start: new Date(raw.start),
            end: new Date(raw.end),
            duration: raw.duration,
        };

        // 1. Fetch today + week sessions for feature computation (IST boundaries)
        const startOfToday = getISTStartOfToday();
        const weekAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [todayDocs, weekDocs] = await Promise.all([
            sessionRepository.findByDateRange(userId, startOfToday, undefined, 'raw'),
            sessionRepository.findByDateRange(userId, weekAgo, startOfToday, 'raw'),
        ]);

        const toPlain = (doc: ISessionDocument): SessionSlice => ({
            start: doc.raw.start,
            end: doc.raw.end,
            duration: doc.raw.duration,
        });
        const todaySessions = todayDocs.map(toPlain);
        const weekSessions  = weekDocs.map(toPlain);

        // 2. Compute 8 features
        const features = computeFeatures(current, todaySessions, weekSessions);

        // 3. Call ML microservice
        const prediction = await predictionClient.predict(features);

        // 4. Load parent controls
        const user = await userRepository.findByIdWithParent(userId);
        // After populate, parentId becomes the parent document or null
        const parentDoc = user?.parentId as unknown as {
            _id: { toString(): string };
            email: string;
            name: string;
            controls?: { dailyLimitMinutes?: number };
        } | null;
        const controls = parentDoc?.controls ?? {};
        const parentId = parentDoc?._id?.toString() ?? null;

        // 5. Evaluate alerts
        const alerts = evaluateAlerts(features, prediction, controls);

        // 6. Persist to MongoDB
        const session = await sessionRepository.create({
            userId: user!._id,
            raw: current,
            features,
            prediction,
            alerts,
        });

        // 7. Notify parent — WebSocket (instant) + Email (reliable)
        if (parentDoc && user) {
            const emailCtx = {
                parentEmail: parentDoc.email,
                parentName: parentDoc.name,
                childName: user.name,
            };

            if (alerts.addictionAlert) {
                notificationService.pushAlert(userId, parentId, {
                    type: 'ADDICTION_ALERT',
                    userId,
                    dailyTotalTime: features.dailyTotalTime,
                    trend: features.trend,
                    sessionId: session._id.toString(),
                });
                void notificationService.sendAddictionAlert({
                    ...emailCtx,
                    dailyTotalTime: features.dailyTotalTime,
                    addictionRisk: prediction.addictionRisk,
                    trend: features.trend,
                });
            }

            if (alerts.playtimeLimitExceeded) {
                notificationService.pushAlert(userId, parentId, {
                    type: 'PLAYTIME_LIMIT_EXCEEDED',
                    userId,
                    dailyTotalTime: features.dailyTotalTime,
                    limit: controls.dailyLimitMinutes,
                    sessionId: session._id.toString(),
                });
                void notificationService.sendPlaytimeLimitAlert({
                    ...emailCtx,
                    dailyTotalTime: features.dailyTotalTime,
                    limit: controls.dailyLimitMinutes!,
                });
            }

            if (alerts.nightGamingAlert) {
                notificationService.pushAlert(userId, parentId, {
                    type: 'NIGHT_GAMING_ALERT',
                    userId,
                    sessionId: session._id.toString(),
                    startedAt: raw.start,
                });
                void notificationService.sendNightGamingAlert({
                    ...emailCtx,
                    startedAt: raw.start,
                });
            }

            // Always push live update to parent dashboard
            notificationService.pushAlert(userId, parentId, {
                type: 'SESSION_UPDATE',
                userId,
                status: 'playing',
                duration: raw.duration,
                state: prediction.state,
            });
        }

        return { session, features, prediction, alerts };
    }

    async getMySessions(userId: string): Promise<ISessionDocument[]> {
        return sessionRepository.findByUserId(userId, {
            sort: { createdAt: -1 },
            limit: 50,
        });
    }

    async submitFeedback(
        sessionId: string,
        userId: string,
        isCorrect: boolean,
        actualState?: PredictionState,
    ): Promise<{ message: string; feedback: ISessionDocument['feedback'] }> {
        const session = await sessionRepository.findByIdAndUserId(sessionId, userId);
        if (!session) {
            throw new NotFoundError('Session not found');
        }

        // If correct, use predicted state. If wrong, use provided actualState.
        const resolvedState = isCorrect ? session.prediction.state : actualState;

        if (!resolvedState || !VALID_FEEDBACK.has(resolvedState)) {
            throw new ValidationError(
                `actualState must be one of: ${[...VALID_FEEDBACK].join(', ')}`,
            );
        }

        session.feedback = {
            provided: true,
            isCorrect,
            actualState: resolvedState,
            providedAt: new Date(),
        };
        await sessionRepository.save(session);

        return { message: 'Feedback saved', feedback: session.feedback };
    }
}

export const sessionService = new SessionService();
