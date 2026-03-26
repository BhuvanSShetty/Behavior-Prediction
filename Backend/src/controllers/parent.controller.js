import User from '../models/user.model.js';
import Session from '../models/session.model.js';


// Returns today's stats for a child
export const getChildDashboard = async (req, res) => {
    try {
        const { childId } = req.params;

        // Ensure this child belongs to the requesting parent
        const parent = await User.findById(req.user._id);
        if (!parent.children.map(String).includes(childId)) {
            return res.status(403).json({ message: 'Not your child' });
        }

        // IST-aware date calculation (safe by parts; no locale-order bugs)
        const parts = new Intl.DateTimeFormat('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'Asia/Kolkata'
        }).formatToParts(new Date());
        const year = parts.find((p) => p.type === 'year')?.value;
        const month = parts.find((p) => p.type === 'month')?.value;
        const day = parts.find((p) => p.type === 'day')?.value;

        const startOfDay = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
        const todaySessions = await Session.find({
            userId: childId,
            'raw.start': { $gte: startOfDay },
        }).sort({ 'raw.start': 1 });

        const latestSession = todaySessions[todaySessions.length - 1];
        const todayPlayTime = Number(
            todaySessions.reduce((sum, s) => sum + (s.raw?.duration || 0), 0).toFixed(2)
        );

        const nightSessions = todaySessions.filter(s => s.alerts?.nightGamingAlert).length;

        res.json({
            childId,
            todayPlayTime,
            sessionCount: todaySessions.length,
            state: latestSession?.prediction?.state || 'Unknown',
            addictionRisk: latestSession?.prediction?.addictionRisk || 0,
            trend: latestSession?.features?.trend || 0,
            nightSessions,
            alerts: latestSession?.alerts || {},
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Returns weekly playtime breakdown for bar chart (last 7 IST days, including today)
export const getChildWeeklyPlaytime = async (req, res) => {
    try {
        const { childId } = req.params;

        const parent = await User.findById(req.user._id);
        if (!parent.children.map(String).includes(childId)) {
            return res.status(403).json({ message: 'Not your child' });
        }

        const parts = new Intl.DateTimeFormat('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'Asia/Kolkata'
        }).formatToParts(new Date());
        const year = parts.find((p) => p.type === 'year')?.value;
        const month = parts.find((p) => p.type === 'month')?.value;
        const day = parts.find((p) => p.type === 'day')?.value;

        const dayMs = 24 * 60 * 60 * 1000;
        const startOfToday = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
        const startWindow = new Date(startOfToday.getTime() - 6 * dayMs);
        const endWindow = new Date(startOfToday.getTime() + dayMs);

        const sessions = await Session.find({
            userId: childId,
            'raw.start': { $gte: startWindow, $lt: endWindow },
        }, 'raw.start raw.duration').lean();

        const dailyBreakdown = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(startOfToday.getTime() - i * dayMs);
            const dayEnd = new Date(dayStart.getTime() + dayMs);

            const dayTotal = sessions.reduce((sum, s) => {
                const start = new Date(s.raw?.start);
                if (start >= dayStart && start < dayEnd) {
                    return sum + (s.raw?.duration || 0);
                }
                return sum;
            }, 0);

            dailyBreakdown.push({
                day: dayStart.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
                min: Number(dayTotal.toFixed(2)),
            });
        }

        res.json({ childId, dailyBreakdown });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


export const getChildren = async (req, res) => {
    try {
        const parent = await User.findById(req.user._id).populate('children', 'name email ageGroup');
        res.json(parent.children);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


export const updateControls = async (req, res) => {
    try {
        const { childId } = req.params;
        const { dailyLimitMinutes, nightRestriction } = req.body;

        const parent = await User.findById(req.user._id);
        if (!parent.children.map(String).includes(childId)) {
            return res.status(403).json({ message: 'Not your child' });
        }

        // Controls are stored on the parent document under the child
        // Simpler approach: store on parent.controls (applies to all children)
        // or store per-child — here we store on parent for simplicity
        const update = {};
        if (dailyLimitMinutes !== undefined) update['controls.dailyLimitMinutes'] = dailyLimitMinutes;
        if (nightRestriction !== undefined) update['controls.nightRestriction'] = nightRestriction;

        await User.findByIdAndUpdate(req.user._id, { $set: update });

        res.json({ message: 'Controls updated', update });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const linkChild = async (req, res) => {
    try {
        const { childId } = req.body;

        const child = await User.findById(childId);
        if (!child || child.role !== 'child') {
            return res.status(404).json({ message: 'Child not found' });
        }

        const parent = await User.findById(req.user._id);
        if (parent.children.map(String).includes(childId)) {
            return res.status(400).json({ message: 'Already linked' });
        }

        parent.children.push(childId);
        child.parentId = parent._id;

        await parent.save();
        await child.save();

        res.json({ message: 'Child linked successfully', childId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
