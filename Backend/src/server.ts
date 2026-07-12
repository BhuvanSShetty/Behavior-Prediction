import 'dotenv/config';
import { createServer } from 'http';

import { connectDB, env } from './config/index.js';
import app from './app.js';
import { webSocketGateway } from './websocket/WebSocketGateway.js';

const httpServer = createServer(app);

// Database
await connectDB();

// WebSocket
webSocketGateway.init(httpServer);

// Start
httpServer.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
});
