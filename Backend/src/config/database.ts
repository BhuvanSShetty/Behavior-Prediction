import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(env.MONGO_URI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('MongoDB connection error:', message);
        process.exit(1);
    }
};
