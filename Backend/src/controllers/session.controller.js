import axios from 'axios';
import Session from '../models/session.model.js';
import User from '../models/user.model.js';
import { computeFeatures, evaluateAlerts } from '../utils/featureEngine.js';
import { pushAlert } from '../utils/websocket.js';
import {sendAddictionAlert,sendPlaytimeLimitAlert,sendNightGamingAlert} from '../utils/mailer.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sessions/log
//
// Mobile sends:
//   { "raw": { "start": "2024-01-15T16:00:00Z", "end": "2024-01-15T16:05:00Z", "duration": 5 } }
//
// Flow:
//   Mobile ──HTTP──▶ here ──▶ featureEngine (compute 8 features)
//                         ──▶ ML microservice (predict)
//                         ──▶ MongoDB (persist)
//                         ──▶ WebSocket (live push if parent dashboard is open)
//                         ──▶ Email (always delivered even if dashboard is closed)
//                         ──▶ HTTP 201 → mobile
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

        // 1. Fetch today's and this week's sessions for feature computation
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [todayDocs, weekDocs] = await Promise.all([
            Session.find({ userId, 'raw.start': { $gte: startOfToday } }, 'raw').lean(),
            Session.find({ userId, 'raw.start': { $gte: weekAgo, $lt: startOfToday } }, 'raw').lean(),
        ]);

        const toPlain = (doc) => ({ start: doc.raw.start, end: doc.raw.end, duration: doc.raw.duration });
        const todaySessions = todayDocs.map(toPlain);
        const weekSessions  = weekDocs.map(toPlain);

        // 2. Compute the 8 features
        const features = computeFeatures(current, todaySessions, weekSessions);

        // 3. Call ML microservice — gracefully degrade if unreachable
        let prediction = { state: 'Unknown', confidence: 0, addictionRisk: 0 };
        try {
            const mlRes = await axios.post(`${ML_SERVICE_URL}/predict`, { features });
            prediction = mlRes.data;
        } catch {
            console.warn('ML service unreachable — prediction skipped');
        }

        // 4. Load child + parent info (need parent email + name for emails)
        const user     = await User.findById(userId).populate('parentId');
        const controls = user.parentId?.controls || {};
        const parent   = user.parentId ?? null;
        const parentId = parent?._id?.toString() ?? null;

        // 5. Evaluate alert flags
        const alerts = evaluateAlerts(features, prediction, controls);

        // 6. Persist to MongoDB
        const session = await Session.create({ userId, raw: current, features, prediction, alerts });

        // ── 7. Notify parent ─────────────────────────────────────────────────
        // Both channels run in parallel (fire-and-forget).
        // WebSocket  → instant if parent dashboard tab is open
        // Email      → always delivered even if browser is closed

        if (parent) {
            const emailCtx = {
                parentEmail: parent.email,
                parentName:  parent.name,
                childName:   user.name,
            };

            if (alerts.addictionAlert) {
                // WebSocket
                pushAlert(userId, parentId, {
                    type:           'ADDICTION_ALERT',
                    userId,
                    dailyTotalTime: features.dailyTotalTime,
                    trend:          features.trend,
                    sessionId:      session._id,
                });
                // Email
                sendAddictionAlert({
                    ...emailCtx,
                    dailyTotalTime: features.dailyTotalTime,
                    addictionRisk:  prediction.addictionRisk,
                    trend:          features.trend,
                });
            }

            if (alerts.playtimeLimitExceeded) {
                pushAlert(userId, parentId, {
                    type:           'PLAYTIME_LIMIT_EXCEEDED',
                    userId,
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
                    type:      'NIGHT_GAMING_ALERT',
                    userId,
                    sessionId: session._id,
                    startedAt: raw.start,
                });
                sendNightGamingAlert({
                    ...emailCtx,
                    startedAt: raw.start,
                });
            }

            // Always push live SESSION_UPDATE to parent dashboard (WS only — no email for this)
            pushAlert(userId, parentId, {
                type:     'SESSION_UPDATE',
                userId,
                status:   'playing',
                duration: raw.duration,
                state:    prediction.state,
            });
        }

        // 8. Respond to mobile
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
