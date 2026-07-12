import type { Document, Types } from 'mongoose';

export type UserRole = 'child' | 'parent';
export type AgeGroup = '10-12' | '13-15' | '16-18' | '19-24' | '24+';

export interface IChildControls {
    dailyLimitMinutes: number;
}

export interface IUser {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    ageGroup: AgeGroup;
    parentId: Types.ObjectId | null;
    children: Types.ObjectId[];
    controls: IChildControls;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserMethods {
    comparePassword(plain: string): Promise<boolean>;
}

export type IUserDocument = Document<Types.ObjectId, object, IUser> & IUser & IUserMethods & {
    _id: Types.ObjectId;
};
