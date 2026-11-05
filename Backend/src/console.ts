import 'dotenv/config';
import repl from 'node:repl';
import path from 'node:path';
import os from 'node:os';
import mongoose from 'mongoose';

import { connectDB, env } from './config/index.js';

// Models
import User from './models/user.model.js';
import Session from './models/session.model.js';

// Repositories
import { UserRepository, userRepository } from './repositories/UserRepository.js';
import { SessionRepository, sessionRepository } from './repositories/SessionRepository.js';

// Services
import { authService } from './services/AuthService.js';
import { parentService } from './services/ParentService.js';
import { sessionService } from './services/SessionService.js';
import { notificationService } from './services/NotificationService.js';
import { predictionClient } from './services/PredictionClient.js';
import { retrainService } from './services/RetrainService.js';
import { computeFeatures, evaluateAlerts } from './services/FeatureEngine.js';

// 1. Connect to Database
await connectDB();

console.log('\n======================================================');
console.log(' Backend Console');
console.log('======================================================');
console.log('Available in scope:');
console.log('  Models:       User, Session');
console.log('  Repos:        userRepository, sessionRepository');
console.log('  Services:     authService, parentService, sessionService,');
console.log('                notificationService, predictionClient, retrainService');
console.log('  Utils:        ObjectId, computeFeatures, evaluateAlerts, env, mongoose');
console.log('======================================================\n');

// 2. Start REPL with custom depth (prevents nested docs collapsing into [Object])
const r = repl.start({
    prompt: 'backend > ',
    useColors: true,
});
(r.writer as any).options.depth = 5;

// 3. Persistent Up-arrow history (saved to ~/.backend_repl_history)
r.setupHistory(path.join(os.homedir(), '.backend_repl_history'), () => { });

// 4. Inject into REPL context
Object.assign(r.context, {
    // Models
    User,
    Session,

    // Repositories
    UserRepository,
    userRepository,
    SessionRepository,
    sessionRepository,

    // Services
    authService,
    parentService,
    sessionService,
    notificationService,
    predictionClient,
    retrainService,

    // Helpers
    ObjectId: mongoose.Types.ObjectId,
    computeFeatures,
    evaluateAlerts,
    env,
    mongoose,
});

// 5. Clean disconnect on exit
r.on('exit', async () => {
    console.log('\nClosing MongoDB connection...');
    await mongoose.disconnect();
    process.exit(0);
});
