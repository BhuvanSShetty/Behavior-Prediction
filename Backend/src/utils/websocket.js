import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_in_production';

// userId (string) → WebSocket — used only for pushing alerts OUT
const clients = new Map();

export const initWebSocket = (httpServer) => {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    wss.on('connection', (ws) => {
        let registeredUserId = null;

        ws.on('message', (raw) => {
            // The ONLY message this channel accepts from clients is REGISTER.
            // All data flows in via HTTP POST — WS is outbound-alerts only.
            try {
                const msg = JSON.parse(raw);

                if (msg.type === 'REGISTER') {
                    if (!msg.token) {
                        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Token required' }));
                    }
                    const decoded = jwt.verify(msg.token, JWT_SECRET);
                    registeredUserId = decoded.id;
                    clients.set(registeredUserId, ws);
                    console.log(`WS client registered: ${registeredUserId}`);
                    return ws.send(JSON.stringify({ type: 'REGISTERED', userId: registeredUserId }));
                }

                // Reject anything else — this socket is not a data-input channel
                ws.send(JSON.stringify({
                    type: 'ERROR',
                    message: 'This WebSocket channel is for alerts only. Send session data via HTTP POST /api/sessions/log',
                }));

            } catch (err) {
                const message = err.name === 'JsonWebTokenError' ? 'Invalid token' : 'Invalid message';
                ws.send(JSON.stringify({ type: 'ERROR', message }));
            }
        });

        ws.on('close', () => {
            if (registeredUserId) {
                clients.delete(registeredUserId);
                console.log(`WS client disconnected: ${registeredUserId}`);
            }
        });
    });

    console.log('WebSocket alert channel ready at /ws');
};

// Push a message to a specific user (child or parent)
export const pushToUser = (userId, payload) => {
    const ws = clients.get(userId);
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(payload));
        return true;
    }
    return false; // User not connected
};

// Push alert to both child and their parent
export const pushAlert = (childId, parentId, payload) => {
    pushToUser(childId, payload);
    if (parentId) pushToUser(parentId, payload);
};
