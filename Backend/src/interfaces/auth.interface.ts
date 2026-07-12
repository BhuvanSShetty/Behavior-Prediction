import type { Request } from 'express';
import type { IUserDocument } from './user.interface.js';

export interface IAuthPayload {
    id: string;
}

export interface IAuthenticatedRequest extends Request {
    user: IUserDocument;
}
