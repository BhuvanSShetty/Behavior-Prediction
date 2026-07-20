import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/index.js';
import { websocketConfig } from '../config/index.js';
import { registerPushAlert } from '../services/NotificationService.js';
import type { IAuthPayload } from '../interfaces/index.js';

interface WebSocketPayload {
    type: string;
    [key: string]: unknown;
}

export class WebSocketGateway {
    private wss: WebSocketServer | null = null;
    private readonly clients = new Map<string, WebSocket>();

    /** Heartbeat interval (30s) */
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    init(httpServer: HttpServer): void {
        this.wss = new WebSocketServer({
            server: httpServer,
            path: websocketConfig.path,
        });

        this.wss.on('connection', (ws: WebSocket) => {
            let registeredUserId: string | null = null;

            // Mark alive for heartbeat
            (ws as WebSocket & { isAlive: boolean }).isAlive = true;
            ws.on('pong', () => {
                (ws as WebSocket & { isAlive: boolean }).isAlive = true;
            });

            ws.on('message', (raw: Buffer | string) => {
                // The ONLY message this channel accepts from clients is REGISTER.
                // All data flows in via HTTP POST — WS is outbound-alerts only.
                try {
                    const msg = JSON.parse(raw.toString()) as {
                        type?: string;
                        token?: string;
                    };

                    if (msg.type === 'REGISTER') {
                        if (!msg.token) {
                            ws.send(
                                JSON.stringify({
                                    type: 'ERROR',
                                    message: 'Token required',
                                }),
                            );
                            return;
                        }

                        const decoded = jwt.verify(
                            msg.token,
                            jwtConfig.secret,
                        ) as IAuthPayload;
                        registeredUserId = decoded.id;
                        this.clients.set(registeredUserId, ws);
                        console.log(`WS client registered: ${registeredUserId}`);
                        ws.send(
                            JSON.stringify({
                                type: 'REGISTERED',
                                userId: registeredUserId,
                            }),
                        );
                        return;
                    }

                    // Reject anything else — this socket is not a data-input channel
                    ws.send(
                        JSON.stringify({
                            type: 'ERROR',
                            message:
                                'This WebSocket channel is for alerts only. Send session data via HTTP POST /api/sessions/log',
                        }),
                    );
                } catch (err) {
                    const message =
                        err instanceof jwt.JsonWebTokenError
                            ? 'Invalid token'
                            : 'Invalid message';
                    ws.send(JSON.stringify({ type: 'ERROR', message }));
                }
            });

            ws.on('close', () => {
                if (registeredUserId) {
                    this.clients.delete(registeredUserId);
                    console.log(`WS client disconnected: ${registeredUserId}`);
                }
            });
        });

        // Heartbeat — ping every 30s, terminate dead connections
        this.heartbeatInterval = setInterval(() => {
            this.wss?.clients.forEach((ws) => {
                const extWs = ws as WebSocket & { isAlive: boolean };
                if (!extWs.isAlive) {
                    extWs.terminate();
                    return;
                }
                extWs.isAlive = false;
                extWs.ping();
            });
        }, 30_000);

        // Register push function with NotificationService
        registerPushAlert((childId, parentId, payload) => {
            this.pushAlert(childId, parentId, payload);
        });

        console.log(`WebSocket alert channel ready at ${websocketConfig.path}`);
    }

    /** Push a message to a specific user (child or parent) */
    pushToUser(userId: string, payload: WebSocketPayload): boolean {
        const ws = this.clients.get(userId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
            return true;
        }
        return false; // User not connected
    }

    /** Push alert to both child and their parent */
    pushAlert(
        childId: string,
        parentId: string | null,
        payload: WebSocketPayload,
    ): void {
        this.pushToUser(childId, payload);
        if (parentId) this.pushToUser(parentId, payload);
    }

    /** Clean shutdown */
    close(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.wss?.close();
    }
}

export const webSocketGateway = new WebSocketGateway();
