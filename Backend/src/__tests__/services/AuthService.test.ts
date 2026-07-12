import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../services/AuthService.js';

// Mock repositories
vi.mock('../../repositories/UserRepository.js', () => ({
    userRepository: {
        findByEmail: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
        save: vi.fn(),
    },
}));

vi.mock('../../config/index.js', () => ({
    jwtConfig: {
        secret: 'test-secret-key-for-testing',
        expiresIn: '7d',
    },
}));

import { userRepository } from '../../repositories/UserRepository.js';

const mockedRepo = vi.mocked(userRepository);

describe('AuthService', () => {
    let authService: AuthService;

    beforeEach(() => {
        authService = new AuthService();
        vi.clearAllMocks();
    });

    describe('generateToken', () => {
        it('should generate a JWT token', () => {
            const token = authService.generateToken('user123');
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
        });
    });

    describe('register', () => {
        it('should throw ConflictError if email exists', async () => {
            mockedRepo.findByEmail.mockResolvedValue({ email: 'test@test.com' } as never);

            await expect(
                authService.register({
                    name: 'Test',
                    email: 'test@test.com',
                    password: 'password123',
                    role: 'child',
                }),
            ).rejects.toThrow('Email already registered');
        });

        it('should register a new user successfully', async () => {
            mockedRepo.findByEmail.mockResolvedValue(null);
            mockedRepo.create.mockResolvedValue({
                _id: { toString: () => 'new-user-id' },
                name: 'Test',
                email: 'test@test.com',
                role: 'child',
            } as never);

            const result = await authService.register({
                name: 'Test',
                email: 'test@test.com',
                password: 'password123',
                role: 'child',
            });

            expect(result.token).toBeDefined();
            expect(result.user.name).toBe('Test');
            expect(result.user.email).toBe('test@test.com');
            expect(result.user.role).toBe('child');
        });
    });

    describe('login', () => {
        it('should throw AuthenticationError for non-existent email', async () => {
            mockedRepo.findByEmail.mockResolvedValue(null);

            await expect(
                authService.login({ email: 'nope@test.com', password: 'pass' }),
            ).rejects.toThrow('Invalid credentials');
        });

        it('should throw AuthenticationError for wrong password', async () => {
            mockedRepo.findByEmail.mockResolvedValue({
                comparePassword: vi.fn().mockResolvedValue(false),
            } as never);

            await expect(
                authService.login({ email: 'test@test.com', password: 'wrong' }),
            ).rejects.toThrow('Invalid credentials');
        });

        it('should return token and user on success', async () => {
            mockedRepo.findByEmail.mockResolvedValue({
                _id: { toString: () => 'user-id' },
                name: 'Test',
                email: 'test@test.com',
                role: 'child',
                comparePassword: vi.fn().mockResolvedValue(true),
            } as never);

            const result = await authService.login({
                email: 'test@test.com',
                password: 'correct',
            });

            expect(result.token).toBeDefined();
            expect(result.user.id).toBe('user-id');
        });
    });
});
