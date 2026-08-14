import { userRepository } from '../repositories/UserRepository.js';
import { sessionRepository } from '../repositories/SessionRepository.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../errors/index.js';
import type { IUserDocument, ISessionDocument } from '../interfaces/index.js';
import type { ParentDashboardResponse, WeeklyPlaytimeResponse } from '../dto/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

export class ParentService {
    private async assertIsChild(parentId: string, childId: string): Promise<IUserDocument> {
        const parent = await userRepository.findById(parentId);
        if (!parent) {
            throw new NotFoundError('Parent not found');
        }
        if (!parent.children.map(String).includes(childId)) {
            throw new ForbiddenError('Not your child');
        }
        return parent;
    }

    async getChildDashboard(
        parentId: string,
        childId: string,
    ): Promise<ParentDashboardResponse> {
        await this.assertIsChild(parentId, childId);

        const startOfDay = getISTStartOfToday();
        const todaySessions = await sessionRepository.findTodaySessions(
            childId,
            startOfDay,
        );

        const latestSession = todaySessions[todaySessions.length - 1];
        const todayPlayTime = Number(
            todaySessions
                .reduce((sum, s) => sum + (s.raw?.duration || 0), 0)
                .toFixed(2),
        );
        const nightSessions = todaySessions.filter(
            (s) => s.alerts?.nightGamingAlert,
        ).length;

        return {
            childId,
            todayPlayTime,
            sessionCount: todaySessions.length,
            state: latestSession?.prediction?.state || 'Unknown',
            addictionRisk: latestSession?.prediction?.addictionRisk || 0,
            trend: latestSession?.features?.trend || 0,
            nightSessions,
            alerts: latestSession?.alerts || {},
        };
    }

    async getChildWeeklyPlaytime(
        parentId: string,
        childId: string,
    ): Promise<WeeklyPlaytimeResponse> {
        await this.assertIsChild(parentId, childId);

        const dayMs = 24 * 60 * 60 * 1000;
        const startOfToday = getISTStartOfToday();
        const startWindow = new Date(startOfToday.getTime() - 6 * dayMs);
        const endWindow = new Date(startOfToday.getTime() + dayMs);

        const sessions = (await sessionRepository.findByDateRange(
            childId,
            startWindow,
            endWindow,
            'raw.start raw.duration',
        )) as unknown as Array<{ raw: { start: Date | string; duration?: number } }>;

        const dailyBreakdown: Array<{ day: string; min: number }> = [];
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
                day: dayStart.toLocaleDateString('en-IN', {
                    weekday: 'short',
                    timeZone: 'Asia/Kolkata',
                }),
                min: Number(dayTotal.toFixed(2)),
            });
        }

        return { childId, dailyBreakdown };
    }

    async getChildren(parentId: string): Promise<IUserDocument['children']> {
        const parent = await userRepository.findByIdWithChildren(parentId);
        if (!parent) {
            throw new NotFoundError('Parent not found');
        }
        return parent.children;
    }

    async updateControls(
        parentId: string,
        childId: string,
        controls: { dailyLimitMinutes?: number; nightRestriction?: boolean },
    ): Promise<{ message: string; update: Record<string, unknown> }> {
        await this.assertIsChild(parentId, childId);

        const update: Record<string, unknown> = {};
        if (controls.dailyLimitMinutes !== undefined) {
            update['controls.dailyLimitMinutes'] = controls.dailyLimitMinutes;
        }
        if (controls.nightRestriction !== undefined) {
            update['controls.nightRestriction'] = controls.nightRestriction;
        }

        await userRepository.updateById(parentId, { $set: update });

        return { message: 'Controls updated', update };
    }

    async linkChild(
        parentId: string,
        identifier: string,
    ): Promise<{ message: string; childId: string }> {
        const trimmed = identifier.trim();
        const isEmail = trimmed.includes('@');

        let child: IUserDocument | null;
        if (isEmail) {
            child = await userRepository.findChildByEmail(trimmed);
            if (!child) {
                throw new NotFoundError('Child not found');
            }
        } else {
            const matches = await userRepository.findChildrenByName(trimmed);
            if (matches.length === 0) {
                throw new NotFoundError('Child not found');
            }
            if (matches.length > 1) {
                throw new ConflictError(
                    'Multiple children found with that name. Please use email instead.',
                );
            }
            child = matches[0] as IUserDocument;
        }

        const parent = await userRepository.findById(parentId);
        if (!parent) {
            throw new NotFoundError('Parent not found');
        }

        const childId = child._id.toString();

        if (parent.children.map(String).includes(childId)) {
            throw new ConflictError('Already linked');
        }

        parent.children.push(child._id);
        child.parentId = parent._id;

        await Promise.all([
            userRepository.save(parent),
            userRepository.save(child),
        ]);

        return { message: 'Child linked successfully', childId };
    }
}

export const parentService = new ParentService();
