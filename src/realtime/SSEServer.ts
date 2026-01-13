// ============================================
// Agent Core - Server-Sent Events (SSE) Server
// ============================================

import {
  RealtimeMessage,
  RealtimeServerConfig,
  ConnectionInfo
} from './types';
import { EventEmitter, generateId } from '../utils';

// HTTP types
interface HttpRequest {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface HttpResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  write(data: string): boolean;
  end(): void;
  on(event: string, handler: () => void): void;
  flushHeaders?(): void;
}

export interface SSEServerConfig {
  heartbeatInterval?: number;
  retry?: number;  // Reconnection interval for clients (ms)
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
}

export class SSEServer extends EventEmitter {
  private connections: Map<string, {
    res: HttpResponse;
    info: ConnectionInfo;
  }> = new Map();
  private config: Required<SSEServerConfig>;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: SSEServerConfig = {}) {
    super();
    this.config = {
      heartbeatInterval: config.heartbeatInterval || 30000,
      retry: config.retry || 3000,
      cors: config.cors || { origin: '*' }
    };
  }

  // -------------------- Connection Handling --------------------

  /**
   * Handle incoming SSE connection request
   * Use in Express: app.get('/events', (req, res) => sseServer.handleConnection(req, res))
   */
  handleConnection(req: HttpRequest, res: HttpResponse): string {
    const clientId = generateId('sse');
    
    // Set SSE headers
    const corsOrigin = Array.isArray(this.config.cors.origin) 
      ? this.config.cors.origin[0] 
      : this.config.cors.origin;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Credentials': this.config.cors.credentials ? 'true' : 'false',
      'X-Accel-Buffering': 'no'  // Disable nginx buffering
    });

    // Flush headers immediately
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    // Create connection info
    const info: ConnectionInfo = {
      clientId,
      state: 'connected',
      connectedAt: Date.now(),
      lastMessageAt: Date.now(),
      subscribedTasks: new Set()
    };

    this.connections.set(clientId, { res, info });

    // Send initial connection message
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

    // Send retry interval
    res.write(`retry: ${this.config.retry}\n\n`);

    // Handle disconnect
    res.on('close', () => {
      this.handleDisconnect(clientId);
    });

    // Start heartbeat if not already running
    if (!this.heartbeatTimer) {
      this.startHeartbeat();
    }

    this.emit('client:connected', { clientId, info });
    
    return clientId;
  }

  private handleDisconnect(clientId: string): void {
    const conn = this.connections.get(clientId);
    if (conn) {
      conn.info.state = 'disconnected';
      this.connections.delete(clientId);
      this.emit('client:disconnected', { clientId });
    }

    // Stop heartbeat if no connections
    if (this.connections.size === 0) {
      this.stopHeartbeat();
    }
  }

  // -------------------- Subscription (via query param or separate endpoint) --------------------

  subscribeToTask(clientId: string, taskId: string): void {
    const conn = this.connections.get(clientId);
    if (conn) {
      conn.info.subscribedTasks.add(taskId);
      this.emit('client:subscribed', { clientId, taskId });
    }
  }

  unsubscribeFromTask(clientId: string, taskId: string): void {
    const conn = this.connections.get(clientId);
    if (conn) {
      conn.info.subscribedTasks.delete(taskId);
      this.emit('client:unsubscribed', { clientId, taskId });
    }
  }

  // -------------------- Heartbeat --------------------

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      // Send comment as heartbeat (keeps connection alive)
      for (const [clientId, { res }] of this.connections) {
        try {
          res.write(': heartbeat\n\n');
        } catch (error) {
          // Connection might be closed
          this.handleDisconnect(clientId);
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

  private formatSSEMessage(message: RealtimeMessage): string {
    const lines: string[] = [];
    
    // Event type
    lines.push(`event: ${message.type}`);
    
    // Message ID
    lines.push(`id: ${message.id}`);
    
    // Data (can be multiline)
    const data = JSON.stringify(message);
    lines.push(`data: ${data}`);
    
    // End with double newline
    return lines.join('\n') + '\n\n';
  }

  sendToClient(clientId: string, message: RealtimeMessage): boolean {
    const conn = this.connections.get(clientId);
    if (!conn) return false;

    try {
      conn.res.write(this.formatSSEMessage(message));
      conn.info.lastMessageAt = Date.now();
      return true;
    } catch (error) {
      this.handleDisconnect(clientId);
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
    return this.connections.has(clientId);
  }

  closeConnection(clientId: string): void {
    const conn = this.connections.get(clientId);
    if (conn) {
      try {
        conn.res.end();
      } catch {
        // Already closed
      }
      this.handleDisconnect(clientId);
    }
  }

  closeAllConnections(): void {
    for (const clientId of this.connections.keys()) {
      this.closeConnection(clientId);
    }
  }
}
