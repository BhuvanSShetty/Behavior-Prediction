import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/index.js';
import { userRepository } from '../repositories/UserRepository.js';
import type { IAuthPayload, IAuthenticatedRequest } from '../interfaces/index.js';

export const protect = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }

    try {
        const token = authHeader.split(' ')[1]!;
        const decoded = jwt.verify(token, jwtConfig.secret) as IAuthPayload;
        const user = await userRepository.findByIdExcludePassword(decoded.id);

        if (!user) {
            res.status(401).json({ message: 'User not found' });
            return;
        }

        (req as IAuthenticatedRequest).user = user;
        next();
    } catch {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

export const requireParent = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const authReq = req as IAuthenticatedRequest;
    if (authReq.user.role !== 'parent') {
        res.status(403).json({ message: 'Access restricted to parents only' });
        return;
    }
    next();
};
