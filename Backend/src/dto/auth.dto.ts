import type { UserRole, AgeGroup } from '../interfaces/index.js';

export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    ageGroup?: AgeGroup;
    parentCode?: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
    };
}
