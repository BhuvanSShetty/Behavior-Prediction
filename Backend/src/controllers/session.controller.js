import axios from 'axios';
import Session from '../models/session.model.js';
import User from '../models/user.model.js';
import { computeFeatures, evaluateAlerts } from '../utils/featureEngine.js';
import { pushAlert, pushToUser } from '../utils/websocket.js';
import { sendAddictionAlert, sendPlaytimeLimitAlert, sendNightGamingAlert } from '../utils/mailer.js';

const ML_SERVICE_URL  = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const VALID_FEEDBACK  = new Set(['Normal', 'Frustrated', 'Addicted']);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/log
//
// Mobile sends: { "raw": { "start", "end", "duration" } }
// Flow: featureEngine → ML → MongoDB → WebSocket + Email alerts
// ─────────────────────────────────────────────────────────────────────────────
export const logSession = async (req, res) => {
    try {
        const userId  = req.user._id.toString();
        const { raw } = req.body;

        if (!raw?.start || !raw?.end || raw?.duration == null) {
            return res.status(400).json({ message: 'raw.start, raw.end and raw.duration are required' });
        }

        const current = {
            start:    new Date(raw.start),
            end:      new Date(raw.end),
            duration: raw.duration,
        };

        // 1. Fetch today + week sessions for feature computation
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [todayDocs, weekDocs] = await Promise.all([
            Session.find({ userId, 'raw.start': { $gte: startOfToday } }, 'raw').lean(),
            Session.find({ userId, 'raw.start': { $gte: weekAgo, $lt: startOfToday } }, 'raw').lean(),
        ]);

        const toPlain       = (doc) => ({ start: doc.raw.start, end: doc.raw.end, duration: doc.raw.duration });
        const todaySessions = todayDocs.map(toPlain);
        const weekSessions  = weekDocs.map(toPlain);

        // 2. Compute 8 features
        const features = computeFeatures(current, todaySessions, weekSessions);

        // 3. Call ML microservice
        let prediction = { state: 'Unknown', confidence: 0, addictionRisk: 0 };
        try {
            const mlRes = await axios.post(`${ML_SERVICE_URL}/predict`, { features });
            prediction  = mlRes.data;
        } catch {
            console.warn('ML service unreachable — prediction skipped');
        }

        // 4. Load parent controls
        const user     = await User.findById(userId).populate('parentId');
        const controls = user.parentId?.controls || {};
        const parent   = user.parentId ?? null;
        const parentId = parent?._id?.toString() ?? null;

        // 5. Evaluate alerts
        const alerts = evaluateAlerts(features, prediction, controls);

        // 6. Persist to MongoDB
        const session = await Session.create({ userId, raw: current, features, prediction, alerts });

        // 7. Notify parent — WebSocket (instant) + Email (reliable)
        if (parent) {
            const emailCtx = {
                parentEmail: parent.email,
                parentName:  parent.name,
                childName:   user.name,
            };

            if (alerts.addictionAlert) {
                pushAlert(userId, parentId, {
                    type: 'ADDICTION_ALERT', userId,
                    dailyTotalTime: features.dailyTotalTime,
                    trend:          features.trend,
                    sessionId:      session._id,
                });
                sendAddictionAlert({
                    ...emailCtx,
                    dailyTotalTime: features.dailyTotalTime,
                    addictionRisk:  prediction.addictionRisk,
                    trend:          features.trend,
                });
            }

            if (alerts.playtimeLimitExceeded) {
                pushAlert(userId, parentId, {
                    type: 'PLAYTIME_LIMIT_EXCEEDED', userId,
                    dailyTotalTime: features.dailyTotalTime,
                    limit:          controls.dailyLimitMinutes,
                    sessionId:      session._id,
                });
                sendPlaytimeLimitAlert({
                    ...emailCtx,
                    dailyTotalTime: features.dailyTotalTime,
                    limit:          controls.dailyLimitMinutes,
                });
            }

            if (alerts.nightGamingAlert) {
                pushAlert(userId, parentId, {
                    type: 'NIGHT_GAMING_ALERT', userId,
                    sessionId: session._id,
                    startedAt: raw.start,
                });
                sendNightGamingAlert({ ...emailCtx, startedAt: raw.start });
            }

            // Always push live update to parent dashboard
            pushAlert(userId, parentId, {
                type:     'SESSION_UPDATE',
                userId,
                status:   'playing',
                duration: raw.duration,
                state:    prediction.state,
            });
        }

        // 8. Ask child to confirm prediction (feedback for retraining)
        // Ask for all states — every correction improves the model
        if (prediction.state !== 'Unknown') {
            pushToUser(userId, {
                type:           'PREDICTION_FEEDBACK_REQUEST',
                sessionId:      session._id,
                predictedState: prediction.state,
                message:        'Was this prediction correct?',
            });
        }

        // 9. Respond to mobile
        res.status(201).json({ session, features, prediction, alerts });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sessions/my
export const getMySessions = async (req, res) => {
    try {
        const sessions = await Session.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/sessions/:sessionId/feedback
// Child confirms or corrects the predicted state → sent to ML for retraining
export const submitSessionFeedback = async (req, res) => {
    try {
        const { sessionId }              = req.params;
        const { isCorrect, actualState, note } = req.body;
        const userId = req.user._id.toString();

        if (typeof isCorrect !== 'boolean') {
            return res.status(400).json({ message: 'isCorrect (boolean) is required' });
        }

        const session = await Session.findOne({ _id: sessionId, userId });
        if (!session) return res.status(404).json({ message: 'Session not found' });

        // If correct, use predicted state. If wrong, use provided actualState.
        const resolvedState = isCorrect ? session.prediction.state : actualState;

        if (!resolvedState || !VALID_FEEDBACK.has(resolvedState)) {
            return res.status(400).json({
                message: `actualState must be one of: ${[...VALID_FEEDBACK].join(', ')}`,
            });
        }

        session.feedback = {
            provided:    true,
            isCorrect,
            actualState: resolvedState,
            note:        typeof note === 'string' ? note.trim().slice(0, 500) : '',
            providedAt:  new Date(),
        };
        await session.save();

        // Forward to ML service for retraining pipeline (best effort)
        try {
            await axios.post(`${ML_SERVICE_URL}/feedback`, {
                sessionId:      session._id,
                userId,
                predictedState: session.prediction.state,
                actualState:    resolvedState,
                isCorrect,
                note:           session.feedback.note,
                features:       session.features,
                createdAt:      session.feedback.providedAt,
            });
        } catch {
            console.warn('ML /feedback unreachable — feedback stored in MongoDB only');
        }

        res.json({ message: 'Feedback saved', feedback: session.feedback });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};