import type { Request, Response } from 'express';
import { authService } from '../services/AuthService.js';
import type { IAuthenticatedRequest } from '../interfaces/index.js';
import type { RegisterRequest, LoginRequest } from '../dto/index.js';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = req.body as RegisterRequest;
        const result = await authService.register(data);
        res.status(201).json(result);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = req.body as LoginRequest;
        const result = await authService.login(data);
        res.json(result);
    } catch (err) {
        const error = err as Error & { statusCode?: number };
        res.status(error.statusCode ?? 500).json({ message: error.message });
    }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthenticatedRequest;
    res.json(authReq.user);
};
