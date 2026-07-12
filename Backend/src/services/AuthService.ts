import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/index.js';
import { userRepository } from '../repositories/UserRepository.js';
import { ConflictError, AuthenticationError } from '../errors/index.js';
import type { IUserDocument } from '../interfaces/index.js';
import type { RegisterRequest, LoginRequest, AuthResponse } from '../dto/index.js';

export class AuthService {
    generateToken(userId: string): string {
        return jwt.sign({ id: userId }, jwtConfig.secret, {
            expiresIn: jwtConfig.expiresIn as any,
        });
    }

    async register(data: RegisterRequest): Promise<AuthResponse> {
        const existing = await userRepository.findByEmail(data.email);
        if (existing) {
            throw new ConflictError('Email already registered');
        }

        const user = await userRepository.create({
            name: data.name,
            email: data.email,
            password: data.password,
            role: data.role,
            ageGroup: data.ageGroup,
        });

        // If child provides a parentCode (parent's userId), link them
        if (data.role === 'child' && data.parentCode) {
            await this.linkChildOnRegister(user, data.parentCode);
        }

        return {
            token: this.generateToken(user._id.toString()),
            user: {
                id: user._id.toString(),
                name: data.name,
                email: data.email,
                role: data.role,
            },
        };
    }

    async login(data: LoginRequest): Promise<AuthResponse> {
        const user = await userRepository.findByEmail(data.email);
        if (!user) {
            throw new AuthenticationError('Invalid credentials');
        }

        const match = await user.comparePassword(data.password);
        if (!match) {
            throw new AuthenticationError('Invalid credentials');
        }

        return {
            token: this.generateToken(user._id.toString()),
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
            },
        };
    }

    private async linkChildOnRegister(
        child: IUserDocument,
        parentCode: string,
    ): Promise<void> {
        const parent = await userRepository.findById(parentCode);
        if (parent && parent.role === 'parent') {
            child.parentId = parent._id;
            parent.children.push(child._id);
            await Promise.all([
                userRepository.save(child),
                userRepository.save(parent),
            ]);
        }
    }
}

export const authService = new AuthService();
