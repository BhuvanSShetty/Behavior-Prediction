import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { connectDB } from './src/db/mongoose.js';
import { initWebSocket } from './src/utils/websocket.js';
import 'dotenv/config';

import authRoutes from './src/routes/auth.routes.js';
import sessionRoutes from './src/routes/session.routes.js';
import parentRoutes from './src/routes/parent.routes.js';
import predictionRoutes from './src/routes/prediction.routes.js';

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// DB
await connectDB();

// WebSocket
initWebSocket(httpServer);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/predictions', predictionRoutes);

app.get('/', (req, res) => {
    res.json({ status: 'Gaming Behavior Backend running ' });
});

httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
