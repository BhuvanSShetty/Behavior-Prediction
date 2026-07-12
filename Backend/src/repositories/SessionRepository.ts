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
}

export const sessionRepository = new SessionRepository();
