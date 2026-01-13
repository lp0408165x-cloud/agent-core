// ============================================
// Agent Core - WebSocket Server
// ============================================

import {
  RealtimeMessage,
  RealtimeServerConfig,
  ConnectionInfo,
  CommandPayload,
  SubscribePayload
} from './types';
import { EventEmitter, generateId } from '../utils';

// Re-export config type
export type { RealtimeServerConfig } from './types';

// WebSocket types (compatible with 'ws' library)
interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState: number;
  on(event: string, handler: (...args: any[]) => void): void;
  ping?(data?: any): void;
}

interface WebSocketServerLike {
  on(event: string, handler: (...args: any[]) => void): void;
  close(callback?: () => void): void;
  clients: Set<WebSocketLike>;
}

export class RealtimeServer extends EventEmitter {
  private wss: WebSocketServerLike | null = null;
  private connections: Map<string, {
    ws: WebSocketLike;
    info: ConnectionInfo;
  }> = new Map();
  private config: Required<RealtimeServerConfig>;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: RealtimeServerConfig = {}) {
    super();
    this.config = {
      port: config.port || 8080,
      path: config.path || '/ws',
      heartbeatInterval: config.heartbeatInterval || 30000,
      heartbeatTimeout: config.heartbeatTimeout || 10000,
      maxConnections: config.maxConnections || 100,
      cors: config.cors || { origin: '*' }
    };
  }

  // -------------------- Server Lifecycle --------------------

  async start(wsServer?: WebSocketServerLike): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    if (wsServer) {
      // Use provided WebSocket server
      this.wss = wsServer;
    } else {
      // Create new WebSocket server (requires 'ws' package)
      try {
        const { WebSocketServer } = await import('ws');
        this.wss = new WebSocketServer({
          port: this.config.port,
          path: this.config.path
        }) as unknown as WebSocketServerLike;
      } catch (error) {
        throw new Error('WebSocket server requires "ws" package. Install with: npm install ws');
      }
    }

    this.setupServerHandlers();
    this.startHeartbeat();
    this.isRunning = true;

    this.emit('server:started', { port: this.config.port, path: this.config.path });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.stopHeartbeat();

    // Close all connections
    for (const [clientId, { ws }] of this.connections) {
      ws.close(1000, 'Server shutting down');
    }
    this.connections.clear();

    // Close server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
      this.wss = null;
    }

    this.isRunning = false;
    this.emit('server:stopped', {});
  }

  // -------------------- Server Handlers --------------------

  private setupServerHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocketLike, req?: any) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error: Error) => {
      this.emit('server:error', { error });
    });
  }

  private handleConnection(ws: WebSocketLike, req?: any): void {
    // Check max connections
    if (this.connections.size >= this.config.maxConnections) {
      ws.close(1013, 'Maximum connections reached');
      return;
    }

    // Create client info
    const clientId = generateId('client');
    const info: ConnectionInfo = {
      clientId,
      state: 'connected',
      connectedAt: Date.now(),
      lastMessageAt: Date.now(),
      subscribedTasks: new Set()
    };

    this.connections.set(clientId, { ws, info });

    // Send connection message
    this.sendToClient(clientId, {
      id: generateId('msg'),
      type: 'connection',
      timestamp: Date.now(),
      payload: {
        clientId,
        serverTime: Date.now(),
        version: '1.0.0'
      }
    });

    // Setup client handlers
    ws.on('message', (data: any) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', (code: number, reason: string) => {
      this.handleDisconnect(clientId, code, reason);
    });

    ws.on('error', (error: Error) => {
      this.emit('client:error', { clientId, error });
    });

    ws.on('pong', () => {
      const conn = this.connections.get(clientId);
      if (conn) {
        conn.info.lastMessageAt = Date.now();
      }
    });

    this.emit('client:connected', { clientId, info });
  }

  private handleMessage(clientId: string, data: any): void {
    const conn = this.connections.get(clientId);
    if (!conn) return;

    conn.info.lastMessageAt = Date.now();

    try {
      const message: RealtimeMessage = JSON.parse(
        typeof data === 'string' ? data : data.toString()
      );

      // Handle special message types
      switch (message.type) {
        case 'ping':
          this.sendToClient(clientId, {
            id: generateId('msg'),
            type: 'pong',
            timestamp: Date.now(),
            payload: {}
          });
          break;

        case 'subscribe':
          this.handleSubscribe(clientId, message.payload as SubscribePayload);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.payload as SubscribePayload);
          break;

        case 'command':
          this.handleCommand(clientId, message.payload as CommandPayload);
          break;

        default:
          this.emit('message', { clientId, message });
      }
    } catch (error) {
      this.sendToClient(clientId, {
        id: generateId('msg'),
        type: 'error',
        timestamp: Date.now(),
        payload: { message: 'Invalid message format' }
      });
    }
  }

  private handleDisconnect(clientId: string, code: number, reason: string): void {
    const conn = this.connections.get(clientId);
    if (conn) {
      conn.info.state = 'disconnected';
      this.connections.delete(clientId);
      this.emit('client:disconnected', { clientId, code, reason });
    }
  }

  private handleSubscribe(clientId: string, payload: SubscribePayload): void {
    const conn = this.connections.get(clientId);
    if (!conn) return;

    if (payload.taskId) {
      conn.info.subscribedTasks.add(payload.taskId);
    }

    this.emit('client:subscribed', { clientId, payload });
  }

  private handleUnsubscribe(clientId: string, payload: SubscribePayload): void {
    const conn = this.connections.get(clientId);
    if (!conn) return;

    if (payload.taskId) {
      conn.info.subscribedTasks.delete(payload.taskId);
    }

    this.emit('client:unsubscribed', { clientId, payload });
  }

  private handleCommand(clientId: string, payload: CommandPayload): void {
    this.emit('command', { clientId, payload });
  }

  // -------------------- Heartbeat --------------------

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.heartbeatTimeout;

      for (const [, { ws, info }] of this.connections) {
        // Check for timeout
        const lastMessage = info.lastMessageAt ?? info.connectedAt ?? now;
        if (now - lastMessage > timeout) {
          ws.close(1000, 'Heartbeat timeout');
          continue;
        }

        // Send ping
        if (ws.ping) {
          ws.ping();
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // -------------------- Send Methods --------------------

  sendToClient(clientId: string, message: RealtimeMessage): boolean {
    const conn = this.connections.get(clientId);
    if (!conn || conn.ws.readyState !== 1) { // 1 = OPEN
      return false;
    }

    try {
      conn.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.emit('send:error', { clientId, error });
      return false;
    }
  }

  broadcast(message: RealtimeMessage, filter?: (info: ConnectionInfo) => boolean): number {
    let sent = 0;

    for (const [clientId, { info }] of this.connections) {
      if (!filter || filter(info)) {
        if (this.sendToClient(clientId, message)) {
          sent++;
        }
      }
    }

    return sent;
  }

  broadcastToTask(taskId: string, message: RealtimeMessage): number {
    message.taskId = taskId;
    
    return this.broadcast(message, (info) => 
      info.subscribedTasks.has(taskId) || info.subscribedTasks.size === 0
    );
  }

  // -------------------- Agent Event Broadcasting --------------------

  broadcastTaskStart(taskId: string, description: string, context?: any): void {
    this.broadcastToTask(taskId, {
      id: generateId('msg'),
      type: 'task:start',
      taskId,
      timestamp: Date.now(),
      payload: { taskId, description, context }
    });
  }

  broadcastTaskComplete(taskId: string, success: boolean, duration: number, summary?: string): void {
    this.broadcastToTask(taskId, {
      id: generateId('msg'),
      type: 'task:complete',
      taskId,
      timestamp: Date.now(),
      payload: { taskId, success, duration, summary }
    });
  }

  broadcastTaskError(taskId: string, error: Error): void {
    this.broadcastToTask(taskId, {
      id: generateId('msg'),
      type: 'task:error',
      taskId,
      timestamp: Date.now(),
      payload: {
        taskId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }
    });
  }

  broadcastPlanCreated(taskId: string, plan: any): void {
    this.broadcastToTask(taskId, {
      id: generateId('msg'),
      type: 'plan:created',
      taskId,
      timestamp: Date.now(),
      payload: {
        taskId,
        plan: {
          id: plan.id,
          steps: plan.steps.map((s: any) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            description: s.description
          })),
          estimatedTime: plan.estimatedTime
        }
      }
    });
  }

  broadcastStepStart(taskId: string, step: any, index: number, total: number): void {
    this.broadcastToTask(taskId, {
      id: generateId('msg'),
      type: 'step:start',
      taskId,
      timestamp: Date.now(),
      payload: {
        taskId,
        stepId: step.id,
        stepName: step.name,
        stepIndex: index,
        totalSteps: total,
        type: step.type
      }
    });
  }

  broadcastStepProgress(taskId: string, stepId: string, progress: number, message?: string): void {
    this.broadcastToTask(taskId, {
      id: generateId('msg'),
      type: 'step:progress',
      taskId,
      timestamp: Date.now(),
      payload: { taskId, stepId, progress, message }
    });
  }

  broadcastStepComplete(taskId: string, result: any): void {
    this.broadcastToTask(taskId, {
      id: generateId('msg'),
      type: 'step:complete',
      taskId,
      timestamp: Date.now(),
      payload: {
        taskId,
        stepId: result.stepId,
        stepName: result.stepName,
        status: result.status,
        duration: result.duration,
        output: result.output
      }
    });
  }

  broadcastStateChange(taskId: string | undefined, prev: string, current: string, trigger: string): void {
    const message: RealtimeMessage = {
      id: generateId('msg'),
      type: 'state:change',
      taskId,
      timestamp: Date.now(),
      payload: {
        taskId,
        previousState: prev,
        currentState: current,
        trigger
      }
    };

    if (taskId) {
      this.broadcastToTask(taskId, message);
    } else {
      this.broadcast(message);
    }
  }

  broadcastWaitingConfirmation(taskId: string, stepId: string, stepName: string, description: string): void {
    this.broadcastToTask(taskId, {
      id: generateId('msg'),
      type: 'waiting:confirmation',
      taskId,
      timestamp: Date.now(),
      payload: { taskId, stepId, stepName, description }
    });
  }

  // -------------------- Getters --------------------

  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values()).map(c => c.info);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  isClientConnected(clientId: string): boolean {
    const conn = this.connections.get(clientId);
    return conn !== undefined && conn.ws.readyState === 1;
  }

  getClientInfo(clientId: string): ConnectionInfo | undefined {
    return this.connections.get(clientId)?.info;
  }
}
