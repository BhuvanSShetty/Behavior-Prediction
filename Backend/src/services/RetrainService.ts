import axios from 'axios';
import { env } from '../config/index.js';
import { sessionRepository } from '../repositories/SessionRepository.js';
import type { ISessionDocument } from '../interfaces/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface FeedbackRow {
    sessionId: string;
    avgSessionDuration: number;
    shortSessionRatio: number;
    reopenCount: number;
    interSessionGap: number;
    dailyTotalTime: number;
    sessionsPerDay: number;
    nightCount: number;
    trend: number;
    actualState: string;
}

interface RetrainResponse {
    status: string;
    feedbackSamples: number;
    metrics: {
        trainAcc: number;
        testAcc: number;
        balancedAcc: number;
        f1Macro: number;
        f1Weighted: number;
        cvMean: number;
        cvStd: number;
    };
    trainedAt: string;
}

interface RetrainStatusResponse {
    trainedAt: string;
    classes: string[];
    feedbackSamples: number;
    metrics: Record<string, number>;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class RetrainService {
    private readonly mlUrl: string;

    constructor() {
        this.mlUrl = env.ML_SERVICE_URL;
    }

    /**
     * Query all sessions with feedback across ALL users,
     * format them as rows the ML service expects.
     */
    async exportFeedback(): Promise<FeedbackRow[]> {
        const sessions: ISessionDocument[] =
            await sessionRepository.findAllWithFeedback();

        return sessions.map((s) => ({
            sessionId: s._id.toString(),
            avgSessionDuration: s.features.avgSessionDuration,
            shortSessionRatio: s.features.shortSessionRatio,
            reopenCount: s.features.reopenCount,
            interSessionGap: s.features.interSessionGap,
            dailyTotalTime: s.features.dailyTotalTime,
            sessionsPerDay: s.features.sessionsPerDay,
            nightCount: s.features.nightCount,
            trend: s.features.trend,
            actualState: s.feedback.actualState,
        }));
    }

    /**
     * Export feedback from MongoDB and POST it to BOTH ML services (/retrain).
     */
    async triggerRetrain(): Promise<any> {
        const feedbackRows = await this.exportFeedback();

        const [rfResponse, xgbResponse] = await Promise.allSettled([
            axios.post<RetrainResponse>(
                `${this.mlUrl}/retrain`,
                { feedbackRows },
                { timeout: 120_000 },
            ),
            axios.post<RetrainResponse>(
                `${env.ML_XGBOOST_URL}/retrain`,
                { feedbackRows },
                { timeout: 120_000 },
            ),
        ]);

        return {
            status: 'success',
            randomForest: rfResponse.status === 'fulfilled' ? rfResponse.value.data : { error: rfResponse.reason?.message },
            xgboost: xgbResponse.status === 'fulfilled' ? xgbResponse.value.data : { error: xgbResponse.reason?.message },
        };
    }

    /**
     * Get current model status from the primary ML service.
     */
    async getRetrainStatus(): Promise<RetrainStatusResponse> {
        const response = await axios.get<RetrainStatusResponse>(
            `${this.mlUrl}/retrain/status`,
            { timeout: 5000 },
        );
        return response.data;
    }

    /**
     * Get side-by-side comparison status and research-grade statistical analysis
     * (McNemar's test & LaTeX table) for both RandomForest and XGBoost models.
     */
    async getComparison(): Promise<any> {
        const [rfStatus, xgbStatus, rfResults, xgbResults] = await Promise.all([
            axios.get(`${this.mlUrl}/retrain/status`, { timeout: 5000 })
                .then((r) => r.data)
                .catch((e) => ({ error: e.message })),
            axios.get(`${env.ML_XGBOOST_URL}/retrain/status`, { timeout: 5000 })
                .then((r) => r.data)
                .catch((e) => ({ error: e.message })),
            axios.get(`${this.mlUrl}/experiment-results`, { timeout: 5000 })
                .then((r) => r.data)
                .catch(() => null),
            axios.get(`${env.ML_XGBOOST_URL}/experiment-results`, { timeout: 5000 })
                .then((r) => r.data)
                .catch(() => null),
        ]);

        let researchAnalysis: any = null;
        if (rfResults && xgbResults && rfResults.y_test && xgbResults.y_test) {
            const yTrue: string[] = rfResults.y_test;
            const rfPred: string[] = rfResults.y_pred;
            const xgbPred: string[] = xgbResults.y_pred;

            let n01 = 0; // RF wrong, XGB right
            let n10 = 0; // RF right, XGB wrong

            for (let i = 0; i < yTrue.length; i++) {
                const correct1 = rfPred[i] === yTrue[i];
                const correct2 = xgbPred[i] === yTrue[i];
                if (!correct1 && correct2) n01++;
                if (correct1 && !correct2) n10++;
            }

            const total = n01 + n10;
            let chi2Stat = 0;
            let pValue = 1.0;

            if (total > 0) {
                chi2Stat = Math.pow(Math.abs(n01 - n10) - 1, 2) / total;
                pValue = 1 - this.approxErf(Math.sqrt(chi2Stat / 2));
            }

            const rfM = rfResults.metrics || {};
            const xgbM = xgbResults.metrics || {};

            const latexTable = `\\begin{table}[h]
\\centering
\\caption{Performance comparison of RandomForest and XGBoost classifiers on the behavior prediction dataset.}
\\begin{tabular}{lcccccc}
\\hline
\\textbf{Classifier} & \\textbf{Accuracy} & \\textbf{Bal. Acc.} & \\textbf{F1 Macro} & \\textbf{ROC-AUC} & \\textbf{Kappa} & \\textbf{10-Fold CV $\\pm$ CI} \\\\
\\hline
RandomForest & ${rfM.testAcc ?? 0} & ${rfM.balancedAcc ?? 0} & ${rfM.f1Macro ?? 0} & ${rfM.rocAucMacro ?? 0} & ${rfM.cohenKappa ?? 0} & ${rfM.cvMean ?? 0} $\\pm$ ${rfM.cvCi95 ?? 0} \\\\
XGBoost & \\textbf{${xgbM.testAcc ?? 0}} & \\textbf{${xgbM.balancedAcc ?? 0}} & \\textbf{${xgbM.f1Macro ?? 0}} & \\textbf{${xgbM.rocAucMacro ?? 0}} & \\textbf{${xgbM.cohenKappa ?? 0}} & \\textbf{${xgbM.cvMean ?? 0} $\\pm$ ${xgbM.cvCi95 ?? 0}} \\\\
\\hline
\\end{tabular}
\\label{tab:ml_comparison}
\\end{table}`;

            researchAnalysis = {
                mcnemarTest: {
                    n01_rf_wrong_xgb_right: n01,
                    n10_rf_right_xgb_wrong: n10,
                    chi2_stat: Number(chi2Stat.toFixed(4)),
                    p_value: Number(pValue.toFixed(5)),
                    significant_at_005: pValue < 0.05,
                },
                latexTable,
            };
        }

        return {
            timestamp: new Date().toISOString(),
            models: {
                randomForest: rfStatus,
                xgboost: xgbStatus,
            },
            researchAnalysis,
        };
    }

    private approxErf(x: number): number {
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p  = 0.3275911;

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    }

    /**
     * Get aggregated feedback stats from MongoDB.
     */
    async getFeedbackStats() {
        return sessionRepository.aggregateFeedbackStats();
    }
}

export const retrainService = new RetrainService();
