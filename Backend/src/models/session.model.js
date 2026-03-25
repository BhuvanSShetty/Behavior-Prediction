import mongoose from 'mongoose';


const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    
    // Mobile sends exactly these three fields per session.
    // start / end are ISO-8601 strings ("2024-01-15T16:00:00.000Z")
    raw: {
        start:    { type: Date, required: true },
        end:      { type: Date, required: true },
        duration: { type: Number, required: true }, // minutes
    },

   // computed features 
    features: {
        avgSessionDuration: { type: Number, default: 0 }, // avg duration today (min)
        shortSessionRatio:  { type: Number, default: 0 }, // 0–1
        reopenCount:        { type: Number, default: 0 }, // gaps < 2 min today
        interSessionGap:    { type: Number, default: 0 }, // avg gap today (min)
        dailyTotalTime:     { type: Number, default: 0 }, // total today (min)
        sessionsPerDay:     { type: Number, default: 0 }, // count today
        nightCount:         { type: Number, default: 0 }, // sessions 0–4 AM today
        trend:              { type: Number, default: 0 }, // today_total − oldest_day_total
    },

    //ml predection results
    prediction: {
        state:        { type: String, enum: ['Normal', 'Frustrated', 'Addicted', 'Unknown'], default: 'Unknown' },
        confidence:   { type: Number, default: 0 },
        addictionRisk:{ type: Number, default: 0 }, // 0–100
    },

    // Child feedback used to improve model quality over time
    feedback: {
        provided:   { type: Boolean, default: false },
        isCorrect:  { type: Boolean, default: null },
        actualState:{ type: String, enum: ['Normal', 'Frustrated', 'Addicted', 'Unknown'], default: 'Unknown' },
        note:       { type: String, default: '' },
        providedAt: { type: Date, default: null },
    },

    // alerts 
    alerts: {
        addictionAlert:       { type: Boolean, default: false },
        nightGamingAlert:     { type: Boolean, default: false },
        playtimeLimitExceeded:{ type: Boolean, default: false },
    },

}, { timestamps: true });

export default mongoose.model('Session', sessionSchema);
