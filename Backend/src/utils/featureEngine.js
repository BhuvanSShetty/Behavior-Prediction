

const SHORT_SESSION_THRESHOLD_MIN = 5;   // sessions under 5 min = "short"
const REOPEN_THRESHOLD_MIN        = 2;   // gap under 2 min = reopen
const NIGHT_START_HOUR            = 0;   // 12 AM
const NIGHT_END_HOUR              = 4;   // 4 AM  (exclusive)



// All sessions sorted oldest → newest
const sortedByStart = (sessions) =>
    [...sessions].sort((a, b) => new Date(a.start) - new Date(b.start));

// Gap in minutes between session A's end and session B's start
const gapMinutes = (a, b) =>
    (new Date(b.start) - new Date(a.end)) / 60_000;

// Hour (0-23) that a session started
const startHour = (s) => new Date(s.start).getHours();

// ── feature 8: trend ─────────────────────────────────────────────────────────
// Sum durations per calendar day across weekSessions, then:
//   trend = today_total − total_of_oldest_day_in_window
const computeTrend = (allSessionsThisWeek, todayTotalTime) => {
    if (allSessionsThisWeek.length === 0) return 0;

    // Group by date string "YYYY-MM-DD"
    const byDay = {};
    for (const s of allSessionsThisWeek) {
        const day = new Date(s.start).toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + s.duration;
    }

    const days = Object.keys(byDay).sort(); // ascending
    if (days.length < 2) return 0;          // need at least two days to have a trend

    const oldestTotal = byDay[days[0]];
    return parseFloat((todayTotalTime - oldestTotal).toFixed(2));
};

// ── main export ───────────────────────────────────────────────────────────────

/**
 * @param {Object}   current       - The session just completed: { start, end, duration }
 * @param {Object[]} todaySessions - All sessions today (NOT including current)
 * @param {Object[]} weekSessions  - Last 7 days of sessions (NOT including current)     
 */
export const computeFeatures = (current, todaySessions = [], weekSessions = []) => {

    // Merge current into today's list so all calculations include it
    const allToday = sortedByStart([...todaySessions, current]);

    // ── 1. avgSessionDuration ─────────────────────────────────────────────
    const avgSessionDuration = parseFloat(
        (allToday.reduce((sum, s) => sum + s.duration, 0) / allToday.length).toFixed(2)
    );

    // ── 2. shortSessionRatio ─────────────────────────────────────────────
    const shortCount = allToday.filter(s => s.duration < SHORT_SESSION_THRESHOLD_MIN).length;
    const shortSessionRatio = parseFloat((shortCount / allToday.length).toFixed(2));

    // ── 3. reopenCount  &  4. interSessionGap ────────────────────────────
    let reopenCount    = 0;
    const gaps         = [];

    for (let i = 1; i < allToday.length; i++) {
        const gap = gapMinutes(allToday[i - 1], allToday[i]);
        gaps.push(gap);
        if (gap < REOPEN_THRESHOLD_MIN) reopenCount++;
    }

    const interSessionGap = gaps.length > 0
        ? parseFloat((gaps.reduce((s, g) => s + g, 0) / gaps.length).toFixed(2))
        : 0;

    // ── 5. dailyTotalTime ─────────────────────────────────────────────────
    const dailyTotalTime = parseFloat(
        allToday.reduce((sum, s) => sum + s.duration, 0).toFixed(2)
    );

    // ── 6. sessionsPerDay ─────────────────────────────────────────────────
    const sessionsPerDay = allToday.length;

    // ── 7. nightCount ─────────────────────────────────────────────────────
    const nightCount = allToday.filter(s => {
        const h = startHour(s);
        return h >= NIGHT_START_HOUR && h < NIGHT_END_HOUR;
    }).length;

    // ── 8. trend ──────────────────────────────────────────────────────────
    const allWeek = [...weekSessions, current];
    const trend   = computeTrend(allWeek, dailyTotalTime);

    return {
        avgSessionDuration,
        shortSessionRatio,
        reopenCount,
        interSessionGap,
        dailyTotalTime,
        sessionsPerDay,
        nightCount,
        trend,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// evaluateAlerts
// Decides which alert flags to set based on features + ML prediction + parent
// controls. Returns the alerts object that gets stored on the Session doc.
// ─────────────────────────────────────────────────────────────────────────────
export const evaluateAlerts = (features, prediction, controls = {}) => {
    const alerts = {
        addictionAlert:        false,
        nightGamingAlert:      false,
        playtimeLimitExceeded: false,
    };

    // ML model says addiction risk is high
    if (prediction.addictionRisk > 70 || prediction.state === 'Addicted') {
        alerts.addictionAlert = true;
    }

    // Any session started in the night window
    if (features.nightCount > 0) {
        alerts.nightGamingAlert = true;
    }

    // Parent has set a daily cap and child exceeded it
    if (controls.dailyLimitMinutes && features.dailyTotalTime > controls.dailyLimitMinutes) {
        alerts.playtimeLimitExceeded = true;
    }  

    return alerts;
};
