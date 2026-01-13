// ============================================
// Agent Core - Server-Sent Events (SSE) Client
// ============================================

import {
  RealtimeMessage,
  MessageType,
  RealtimeTransport,
  ConnectionState,
  MessageHandler,
  ConnectionHandler,
  DisconnectHandler,
  ErrorHandler
} from './types';
import { EventEmitter } from '../utils';

export interface SSEClientConfig {
  url: string;
  withCredentials?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
}

export class SSEClient extends EventEmitter implements RealtimeTransport {
  private eventSource: EventSource | null = null;
  private config: Required<SSEClientConfig>;
  private state: ConnectionState = 'disconnected';
  private clientId: string | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Event handlers
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<DisconnectHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  constructor(config: SSEClientConfig) {
    super();
    this.config = {
      url: config.url,
      withCredentials: config.withCredentials ?? false,
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 3000,
      reconnectAttempts: config.reconnectAttempts ?? 10
    };
  }

  // -------------------- Connection --------------------

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    if (typeof EventSource === 'undefined') {
      throw new Error('EventSource is not supported in this environment');
    }

    this.state = 'connecting';
    this.emit('state:change', { state: this.state });

    return new Promise((resolve, reject) => {
      try {
        this.eventSource = new EventSource(this.config.url, {
          withCredentials: this.config.withCredentials
        });

        this.eventSource.onopen = () => {
          this.handleOpen();
          resolve();
        };

        this.eventSource.onerror = (event) => {
          this.handleError(event);
          if (this.state === 'connecting') {
            reject(new Error('SSE connection failed'));
          }
        };

        // Listen for all message types
        this.setupEventListeners();

      } catch (error) {
        this.state = 'error';
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopReconnect();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.state = 'disconnected';
    this.emit('state:change', { state: this.state });
  }

  isConnected(): boolean {
    return this.state === 'connected' && 
           this.eventSource?.readyState === EventSource.OPEN;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getClientId(): string | null {
    return this.clientId;
  }

  // -------------------- Event Listeners --------------------

  private setupEventListeners(): void {
    if (!this.eventSource) return;

    // Connection event
    this.eventSource.addEventListener('connection', (event) => {
      this.handleMessage(event as MessageEvent);
    });

    // All other event types
    const eventTypes: MessageType[] = [
      'task:start',
      'task:complete',
      'task:error',
      'task:cancelled',
      'plan:created',
      'plan:updated',
      'step:start',
      'step:progress',
      'step:complete',
      'step:error',
      'state:change',
      'checkpoint:created',
      'waiting:confirmation',
      'error'
    ];

    eventTypes.forEach(type => {
      this.eventSource!.addEventListener(type, (event) => {
        this.handleMessage(event as MessageEvent);
      });
    });

    // Generic message handler for any event
    this.eventSource.onmessage = (event) => {
      this.handleMessage(event);
    };
  }

  // -------------------- Event Handlers --------------------

  private handleOpen(): void {
    this.state = 'connected';
    this.reconnectAttempts = 0;

    this.emit('state:change', { state: this.state });
    this.connectHandlers.forEach(handler => handler());
  }

  private handleError(event: Event): void {
    if (this.eventSource?.readyState === EventSource.CLOSED) {
      // Connection closed
      const wasConnected = this.state === 'connected';
      this.state = 'disconnected';
      this.eventSource = null;

      this.emit('state:change', { state: this.state });
      this.disconnectHandlers.forEach(handler => handler('Connection closed'));

      // Auto reconnect
      if (wasConnected && this.config.reconnect) {
        this.scheduleReconnect();
      }
    } else {
      // Error during connection
      const error = new Error('SSE error');
      this.emit('error', { error });
      this.errorHandlers.forEach(handler => handler(error));
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: RealtimeMessage = JSON.parse(event.data);

      // Handle connection message
      if (message.type === 'connection') {
        this.clientId = message.payload.clientId;
        this.emit('connected', message.payload);
      }

      // Emit typed event
      this.emit(message.type, message);
      this.emit('message', message);

      // Call registered handlers
      this.messageHandlers.forEach(handler => handler(message));

    } catch (error) {
      console.error('Failed to parse SSE message:', error);
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
        // Will trigger handleError -> scheduleReconnect
      });
    }, this.config.reconnectInterval);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -------------------- SSE is one-way, so send methods use HTTP --------------------

  /**
   * SSE is server-to-client only. Commands must be sent via HTTP.
   * This method provides a placeholder that would call your API.
   */
  send(message: RealtimeMessage): void {
    console.warn('SSE is one-way (server to client). Use sendCommand() instead.');
  }

  /**
   * Send command to server via HTTP POST
   */
  async sendCommand(
    endpoint: string,
    command: string,
    taskId?: string,
    data?: any
  ): Promise<void> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: this.config.withCredentials ? 'include' : 'same-origin',
      body: JSON.stringify({
        clientId: this.clientId,
        command,
        taskId,
        data
      })
    });

    if (!response.ok) {
      throw new Error(`Command failed: ${response.statusText}`);
    }
  }

  // Convenience methods (require command endpoint URL)
  async confirm(endpoint: string, taskId: string, data?: any): Promise<void> {
    await this.sendCommand(endpoint, 'confirm', taskId, data);
  }

  async reject(endpoint: string, taskId: string, reason?: string): Promise<void> {
    await this.sendCommand(endpoint, 'reject', taskId, { reason });
  }

  async cancel(endpoint: string, taskId: string): Promise<void> {
    await this.sendCommand(endpoint, 'cancel', taskId);
  }

  async pause(endpoint: string, taskId: string): Promise<void> {
    await this.sendCommand(endpoint, 'pause', taskId);
  }

  async resume(endpoint: string, taskId: string): Promise<void> {
    await this.sendCommand(endpoint, 'resume', taskId);
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

export function createSSEClient(url: string, options?: Partial<SSEClientConfig>): SSEClient {
  return new SSEClient({ url, ...options });
}
