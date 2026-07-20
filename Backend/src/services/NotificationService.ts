import nodemailer from 'nodemailer';
import { mailConfig } from '../config/index.js';

// ── Transporter setup ────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
    service: mailConfig.service,
    auth: {
        user: mailConfig.user,
        pass: mailConfig.pass,
    },
});

transporter.verify((err) => {
    if (err) console.warn('Mailer not ready (check GMAIL_USER / GMAIL_PASS):', err.message);
    else     console.log('Mailer ready ');
});

// ── Shared send helper ───────────────────────────────────────────────────────

interface MailOptions {
    to: string;
    subject: string;
    html: string;
}

const sendMail = async ({ to, subject, html }: MailOptions): Promise<void> => {
    if (!mailConfig.isConfigured) {
        console.warn('Email skipped — GMAIL_USER or GMAIL_PASS not set');
        return;
    }
    try {
        await transporter.sendMail({
            from: `"Gaming Monitor" <${mailConfig.user}>`,
            to,
            subject,
            html,
        });
        console.log(`Email sent → ${to} | ${subject}`);
    } catch (err) {
        // Never let a failed email crash the main request
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Email send failed:', message);
    }
};

// ── Alert email types ────────────────────────────────────────────────────────

interface AddictionAlertParams {
    parentEmail: string;
    parentName: string;
    childName: string;
    dailyTotalTime: number;
    addictionRisk: number;
    trend: number;
}

interface PlaytimeLimitAlertParams {
    parentEmail: string;
    parentName: string;
    childName: string;
    dailyTotalTime: number;
    limit: number;
}

interface NightGamingAlertParams {
    parentEmail: string;
    parentName: string;
    childName: string;
    startedAt: string | Date;
}

// ── WebSocket push (imported lazily to avoid circular deps) ──────────────────

interface WebSocketPayload {
    type: string;
    [key: string]: unknown;
}

type PushAlertFn = (childId: string, parentId: string | null, payload: WebSocketPayload) => void;

let pushAlertFn: PushAlertFn | null = null;

export function registerPushAlert(fn: PushAlertFn): void {
    pushAlertFn = fn;
}

function pushAlert(childId: string, parentId: string | null, payload: WebSocketPayload): void {
    if (pushAlertFn) {
        pushAlertFn(childId, parentId, payload);
    }
}

// ── Public API ───────────────────────────────────────────────────────────────

export class NotificationService {
    pushAlert(childId: string, parentId: string | null, payload: WebSocketPayload): void {
        pushAlert(childId, parentId, payload);
    }

    async sendAddictionAlert({
        parentEmail,
        parentName,
        childName,
        dailyTotalTime,
        addictionRisk,
        trend,
    }: AddictionAlertParams): Promise<void> {
        await sendMail({
            to: parentEmail,
            subject: `⚠️ Addiction Risk Alert — ${childName}`,
            html: `
                <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                    <div style="background:#ef4444;padding:20px 24px">
                        <h2 style="color:#fff;margin:0">⚠️ Addiction Risk Detected</h2>
                    </div>
                    <div style="padding:24px">
                        <p style="margin:0 0 16px">Hi <strong>${parentName}</strong>,</p>
                        <p style="margin:0 0 16px">Our system has flagged a high addiction risk for <strong>${childName}</strong> based on today's gaming behaviour.</p>
                        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                            <tr style="background:#fef2f2">
                                <td style="padding:10px 12px;border:1px solid #fecaca;font-weight:600">Addiction Risk Score</td>
                                <td style="padding:10px 12px;border:1px solid #fecaca;color:#ef4444;font-weight:700">${addictionRisk} / 100</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 12px;border:1px solid #e5e7eb">Total Play Time Today</td>
                                <td style="padding:10px 12px;border:1px solid #e5e7eb">${dailyTotalTime} minutes</td>
                            </tr>
                            <tr style="background:#f9fafb">
                                <td style="padding:10px 12px;border:1px solid #e5e7eb">Weekly Trend</td>
                                <td style="padding:10px 12px;border:1px solid #e5e7eb">${trend >= 0 ? '+' : ''}${trend} min vs oldest day this week</td>
                            </tr>
                        </table>
                        <p style="margin:0;color:#6b7280;font-size:13px">Consider talking to ${childName} about healthy gaming habits.</p>
                    </div>
                    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
                        <p style="margin:0;font-size:12px;color:#9ca3af">Gaming Behavior Monitor — automated alert</p>
                    </div>
                </div>
            `,
        });
    }

    async sendPlaytimeLimitAlert({
        parentEmail,
        parentName,
        childName,
        dailyTotalTime,
        limit,
    }: PlaytimeLimitAlertParams): Promise<void> {
        await sendMail({
            to: parentEmail,
            subject: `⏱️ Playtime Limit Exceeded — ${childName}`,
            html: `
                <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                    <div style="background:#f59e0b;padding:20px 24px">
                        <h2 style="color:#fff;margin:0">⏱️ Daily Playtime Limit Exceeded</h2>
                    </div>
                    <div style="padding:24px">
                        <p style="margin:0 0 16px">Hi <strong>${parentName}</strong>,</p>
                        <p style="margin:0 0 16px"><strong>${childName}</strong> has exceeded the daily gaming limit you set.</p>
                        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                            <tr style="background:#fffbeb">
                                <td style="padding:10px 12px;border:1px solid #fde68a;font-weight:600">Your Limit</td>
                                <td style="padding:10px 12px;border:1px solid #fde68a">${limit} minutes</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600">Actual Play Time</td>
                                <td style="padding:10px 12px;border:1px solid #e5e7eb;color:#f59e0b;font-weight:700">${dailyTotalTime} minutes</td>
                            </tr>
                            <tr style="background:#f9fafb">
                                <td style="padding:10px 12px;border:1px solid #e5e7eb">Over by</td>
                                <td style="padding:10px 12px;border:1px solid #e5e7eb">${dailyTotalTime - limit} minutes</td>
                            </tr>
                        </table>
                    </div>
                    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
                        <p style="margin:0;font-size:12px;color:#9ca3af">Gaming Behavior Monitor — automated alert</p>
                    </div>
                </div>
            `,
        });
    }

    async sendNightGamingAlert({
        parentEmail,
        parentName,
        childName,
        startedAt,
    }: NightGamingAlertParams): Promise<void> {
        const time = new Date(startedAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
        });
        await sendMail({
            to: parentEmail,
            subject: `🌙 Night Gaming Detected — ${childName}`,
            html: `
                <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                    <div style="background:#6366f1;padding:20px 24px">
                        <h2 style="color:#fff;margin:0">🌙 Night Gaming Detected</h2>
                    </div>
                    <div style="padding:24px">
                        <p style="margin:0 0 16px">Hi <strong>${parentName}</strong>,</p>
                        <p style="margin:0 0 16px"><strong>${childName}</strong> started a gaming session late at night.</p>
                        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                            <tr style="background:#eef2ff">
                                <td style="padding:10px 12px;border:1px solid #c7d2fe;font-weight:600">Session Started At</td>
                                <td style="padding:10px 12px;border:1px solid #c7d2fe;color:#6366f1;font-weight:700">${time}</td>
                            </tr>
                            <tr>
                                <td style="padding:10px 12px;border:1px solid #e5e7eb">Night Window</td>
                                <td style="padding:10px 12px;border:1px solid #e5e7eb">12:00 AM – 4:00 AM</td>
                            </tr>
                        </table>
                        <p style="margin:0;color:#6b7280;font-size:13px">Late night gaming can affect sleep and performance. Consider reviewing screen time rules.</p>
                    </div>
                    <div style="background:#f9fafb;padding:12px 24px;border-top:1px solid #e5e7eb">
                        <p style="margin:0;font-size:12px;color:#9ca3af">Gaming Behavior Monitor — automated alert</p>
                    </div>
                </div>
            `,
        });
    }
}

export const notificationService = new NotificationService();
