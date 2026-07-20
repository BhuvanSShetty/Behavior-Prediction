import type { FilterQuery } from 'mongoose';
import Session from '../models/session.model.js';
import type { ISession, ISessionDocument } from '../interfaces/index.js';

export class SessionRepository {
    async create(data: Partial<ISession>): Promise<ISessionDocument> {
        return Session.create(data) as Promise<ISessionDocument>;
    }

    async findByUserId(
        userId: string,
        options?: { limit?: number; sort?: Record<string, 1 | -1> },
    ): Promise<ISessionDocument[]> {
        let query = Session.find({ userId });
        if (options?.sort) query = query.sort(options.sort);
        if (options?.limit) query = query.limit(options.limit);
        return query;
    }

    async findByDateRange(
        userId: string,
        startDate: Date,
        endDate?: Date,
        projection?: string,
    ): Promise<ISessionDocument[]> {
        const filter: FilterQuery<ISession> = {
            userId,
            'raw.start': endDate
                ? { $gte: startDate, $lt: endDate }
                : { $gte: startDate },
        };

        let query = Session.find(filter);
        if (projection) query = query.select(projection);
        return query.lean() as unknown as ISessionDocument[];
    }

    async findTodaySessions(
        userId: string,
        startOfDay: Date,
    ): Promise<ISessionDocument[]> {
        return Session.find({
            userId,
            'raw.start': { $gte: startOfDay },
        }).sort({ 'raw.start': 1 });
    }

    async findByIdAndUserId(
        sessionId: string,
        userId: string,
    ): Promise<ISessionDocument | null> {
        return Session.findOne({ _id: sessionId, userId });
    }

    async save(session: ISessionDocument): Promise<ISessionDocument> {
        return session.save();
    }

    async findWithProjection(
        filter: FilterQuery<ISession>,
        projection: string,
    ): Promise<ISessionDocument[]> {
        return Session.find(filter, projection).lean() as unknown as ISessionDocument[];
    }

    async findAllWithFeedback(): Promise<ISessionDocument[]> {
        return Session.find(
            { 'feedback.provided': true },
            'features feedback.actualState _id userId',
        )
            .lean() as unknown as ISessionDocument[];
    }

    async aggregateFeedbackStats(): Promise<{
        total: number;
        byState: Record<string, number>;
        byUser: { userId: string; count: number }[];
    }> {
        const [byState, byUser] = await Promise.all([
            Session.aggregate([
                { $match: { 'feedback.provided': true } },
                { $group: { _id: '$feedback.actualState', count: { $sum: 1 } } },
            ]),
            Session.aggregate([
                { $match: { 'feedback.provided': true } },
                { $group: { _id: '$userId', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 50 },
            ]),
        ]);

        const stateMap: Record<string, number> = {};
        let total = 0;
        for (const row of byState) {
            stateMap[row._id as string] = row.count as number;
            total += row.count as number;
        }

        return {
            total,
            byState: stateMap,
            byUser: byUser.map((r) => ({
                userId: (r._id as string).toString(),
                count: r.count as number,
            })),
        };
    }
}

export const sessionRepository = new SessionRepository();
