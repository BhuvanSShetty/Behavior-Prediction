import type { FilterQuery, UpdateQuery } from 'mongoose';
import User from '../models/user.model.js';
import type { IUser, IUserDocument } from '../interfaces/index.js';

export class UserRepository {
    async findByEmail(email: string): Promise<IUserDocument | null> {
        return User.findOne({ email });
    }

    async findById(id: string): Promise<IUserDocument | null> {
        return User.findById(id);
    }

    async findChildByEmail(email: string): Promise<IUserDocument | null> {
        return User.findOne({ email: email.toLowerCase().trim(), role: 'child' });
    }

    async findChildrenByName(name: string): Promise<IUserDocument[]> {
        return User.find({
            name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            role: 'child',
        });
    }

    async findByIdExcludePassword(id: string): Promise<IUserDocument | null> {
        return User.findById(id).select('-password') as unknown as IUserDocument | null;
    }

    async findByIdWithChildren(id: string): Promise<IUserDocument | null> {
        return User.findById(id).populate('children', 'name email ageGroup');
    }

    async findByIdWithParent(id: string): Promise<IUserDocument | null> {
        return User.findById(id).populate('parentId');
    }

    async create(data: Partial<IUser>): Promise<IUserDocument> {
        const user = new User(data);
        await user.save();
        return user;
    }

    async save(user: IUserDocument): Promise<IUserDocument> {
        return user.save();
    }

    async updateById(
        id: string,
        update: UpdateQuery<IUser>,
    ): Promise<IUserDocument | null> {
        return User.findByIdAndUpdate(id, update, { new: true });
    }

    async find(filter: FilterQuery<IUser>): Promise<IUserDocument[]> {
        return User.find(filter);
    }
}

export const userRepository = new UserRepository();
