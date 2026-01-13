// ============================================
// Agent Core - WebSocket Client
// ============================================

import {
  RealtimeMessage,
  MessageType,
  RealtimeClientConfig,
  RealtimeTransport,
  ConnectionState,
  MessageHandler,
  ConnectionHandler,
  DisconnectHandler,
  ErrorHandler,
  CommandPayload,
  SubscribePayload
} from './types';
import { EventEmitter, generateId } from '../utils';

export class WebSocketClient extends EventEmitter implements RealtimeTransport {
  private ws: WebSocket | null = null;
  private config: Required<RealtimeClientConfig>;
  private state: ConnectionState = 'disconnected';
  private clientId: string | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: RealtimeMessage[] = [];
  private subscribedTasks: Set<string> = new Set();

  // Event handlers
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<DisconnectHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  constructor(config: RealtimeClientConfig) {
    super();
    this.config = {
      url: config.url,
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 3000,
      reconnectAttempts: config.reconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 25000,
      protocols: config.protocols || []
    };
  }

  // -------------------- Connection --------------------

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.state = 'connecting';
    this.emit('state:change', { state: this.state });

    return new Promise((resolve, reject) => {
      try {
        // Browser WebSocket or Node.js ws
        const WebSocketImpl = typeof WebSocket !== 'undefined' 
          ? WebSocket 
          : require('ws');

        const ws = new WebSocketImpl(
          this.config.url,
          this.config.protocols.length > 0 ? this.config.protocols : undefined
        );
        
        this.ws = ws;

        ws.onopen = () => {
          this.handleOpen();
          resolve();
        };

        ws.onclose = (event: CloseEvent) => {
          this.handleClose(event.code, event.reason);
        };

        ws.onerror = () => {
          this.handleError(new Error('WebSocket error'));
          if (this.state === 'connecting') {
            reject(new Error('Connection failed'));
          }
        };

        ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data);
        };

      } catch (error) {
        this.state = 'error';
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopReconnect();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = 'disconnected';
    this.emit('state:change', { state: this.state });
  }

  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === 1;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getClientId(): string | null {
    return this.clientId;
  }

  // -------------------- Event Handlers --------------------

  private handleOpen(): void {
    this.state = 'connected';
    this.reconnectAttempts = 0;
    
    this.startHeartbeat();
    this.flushMessageQueue();
    this.resubscribe();

    this.emit('state:change', { state: this.state });
    this.connectHandlers.forEach(handler => handler());
  }

  private handleClose(code: number, reason: string): void {
    this.stopHeartbeat();
    
    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';
    this.ws = null;

    this.emit('state:change', { state: this.state, code, reason });
    this.disconnectHandlers.forEach(handler => handler(reason));

    // Auto reconnect
    if (wasConnected && this.config.reconnect) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event | Error): void {
    const err = error instanceof Error ? error : new Error('WebSocket error');
    this.emit('error', { error: err });
    this.errorHandlers.forEach(handler => handler(err));
  }

  private handleMessage(data: string | ArrayBuffer | Blob): void {
    try {
      const text = typeof data === 'string' ? data : data.toString();
      const message: RealtimeMessage = JSON.parse(text);

      // Handle connection message
      if (message.type === 'connection') {
        this.clientId = message.payload.clientId;
        this.emit('connected', message.payload);
      }

      // Handle pong
      if (message.type === 'pong') {
        this.emit('pong', {});
        return;
      }

      // Emit typed event
      this.emit(message.type, message);
      this.emit('message', message);

      // Call registered handlers
      this.messageHandlers.forEach(handler => handler(message));

    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  // -------------------- Reconnection --------------------

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      this.state = 'error';
      this.emit('reconnect:failed', { attempts: this.reconnectAttempts });
      return;
    }

    this.state = 'reconnecting';
    this.reconnectAttempts++;

    this.emit('reconnecting', { 
      attempt: this.reconnectAttempts, 
      maxAttempts: this.config.reconnectAttempts 
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Will trigger handleClose -> scheduleReconnect
      });
    }, this.config.reconnectInterval);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -------------------- Heartbeat --------------------

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendPing();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendPing(): void {
    this.send({
      id: generateId('msg'),
      type: 'ping',
      timestamp: Date.now(),
      payload: {}
    });
  }

  // -------------------- Send Methods --------------------

  send(message: RealtimeMessage): void {
    if (!this.isConnected()) {
      // Queue message for later
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      this.messageQueue.push(message);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  // -------------------- Subscriptions --------------------

  subscribe(taskId: string): void {
    this.subscribedTasks.add(taskId);
    
    this.send({
      id: generateId('msg'),
      type: 'subscribe',
      timestamp: Date.now(),
      payload: { taskId } as SubscribePayload
    });
  }

  unsubscribe(taskId: string): void {
    this.subscribedTasks.delete(taskId);
    
    this.send({
      id: generateId('msg'),
      type: 'unsubscribe',
      timestamp: Date.now(),
      payload: { taskId } as SubscribePayload
    });
  }

  private resubscribe(): void {
    for (const taskId of this.subscribedTasks) {
      this.send({
        id: generateId('msg'),
        type: 'subscribe',
        timestamp: Date.now(),
        payload: { taskId } as SubscribePayload
      });
    }
  }

  // -------------------- Commands --------------------

  sendCommand(command: CommandPayload['command'], taskId?: string, data?: any): void {
    this.send({
      id: generateId('msg'),
      type: 'command',
      taskId,
      timestamp: Date.now(),
      payload: { command, taskId, data } as CommandPayload
    });
  }

  confirm(taskId: string, data?: any): void {
    this.sendCommand('confirm', taskId, data);
  }

  reject(taskId: string, reason?: string): void {
    this.sendCommand('reject', taskId, { reason });
  }

  cancel(taskId: string): void {
    this.sendCommand('cancel', taskId);
  }

  pause(taskId: string): void {
    this.sendCommand('pause', taskId);
  }

  resume(taskId: string): void {
    this.sendCommand('resume', taskId);
  }

  // -------------------- Event Registration --------------------

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.add(handler);
  }

  offMessage(handler: MessageHandler): void {
    this.messageHandlers.delete(handler);
  }

  onConnect(handler: ConnectionHandler): void {
    this.connectHandlers.add(handler);
  }

  offConnect(handler: ConnectionHandler): void {
    this.connectHandlers.delete(handler);
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.add(handler);
  }

  offDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.add(handler);
  }

  offError(handler: ErrorHandler): void {
    this.errorHandlers.delete(handler);
  }

  // Typed event handlers
  onTaskStart(handler: (payload: any) => void): void {
    this.on('task:start', (msg: RealtimeMessage) => handler(msg.payload));
  }

  onTaskComplete(handler: (payload: any) => void): void {
    this.on('task:complete', (msg: RealtimeMessage) => handler(msg.payload));
  }

  onTaskError(handler: (payload: any) => void): void {
    this.on('task:error', (msg: RealtimeMessage) => handler(msg.payload));
  }

  onPlanCreated(handler: (payload: any) => void): void {
    this.on('plan:created', (msg: RealtimeMessage) => handler(msg.payload));
  }

  onStepStart(handler: (payload: any) => void): void {
    this.on('step:start', (msg: RealtimeMessage) => handler(msg.payload));
  }

  onStepProgress(handler: (payload: any) => void): void {
    this.on('step:progress', (msg: RealtimeMessage) => handler(msg.payload));
  }

  onStepComplete(handler: (payload: any) => void): void {
    this.on('step:complete', (msg: RealtimeMessage) => handler(msg.payload));
  }

  onStateChange(handler: (payload: any) => void): void {
    this.on('state:change', (msg: RealtimeMessage) => handler(msg.payload));
  }

  onWaitingConfirmation(handler: (payload: any) => void): void {
    this.on('waiting:confirmation', (msg: RealtimeMessage) => handler(msg.payload));
  }
}

// -------------------- Factory --------------------

export function createWebSocketClient(url: string, options?: Partial<RealtimeClientConfig>): WebSocketClient {
  return new WebSocketClient({ url, ...options });
}
