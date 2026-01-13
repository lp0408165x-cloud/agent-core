// ============================================
// Agent Core - Realtime Communication Types
// ============================================

import { AgentState, ExecutionPlan, StepResult } from '../types';

// -------------------- Message Types --------------------

export type MessageType =
  | 'connection'
  | 'task:start'
  | 'task:complete'
  | 'task:error'
  | 'task:cancelled'
  | 'plan:created'
  | 'plan:updated'
  | 'step:start'
  | 'step:progress'
  | 'step:complete'
  | 'step:error'
  | 'state:change'
  | 'checkpoint:created'
  | 'waiting:confirmation'
  | 'ping'
  | 'pong'
  | 'error'
  | 'subscribe'
  | 'unsubscribe'
  | 'command';

export interface RealtimeMessage<T = any> {
  id: string;
  type: MessageType;
  taskId?: string;
  timestamp: number;
  payload: T;
}

// -------------------- Payload Types --------------------

export interface ConnectionPayload {
  clientId: string;
  serverTime: number;
  version: string;
}

export interface TaskStartPayload {
  taskId: string;
  description: string;
  context?: Record<string, any>;
}

export interface TaskCompletePayload {
  taskId: string;
  success: boolean;
  duration: number;
  summary?: string;
}

export interface TaskErrorPayload {
  taskId: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface PlanCreatedPayload {
  taskId: string;
  plan: {
    id: string;
    steps: Array<{
      id: string;
      name: string;
      type: string;
      description: string;
    }>;
    estimatedTime: number;
  };
}

export interface StepStartPayload {
  taskId: string;
  stepId: string;
  stepName: string;
  stepIndex: number;
  totalSteps: number;
  type: string;
}

export interface StepProgressPayload {
  taskId: string;
  stepId: string;
  progress: number;  // 0-100
  message?: string;
}

export interface StepCompletePayload {
  taskId: string;
  stepId: string;
  stepName: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  output?: any;
}

export interface StateChangePayload {
  taskId?: string;
  previousState: AgentState;
  currentState: AgentState;
  trigger: string;
}

export interface CheckpointPayload {
  taskId: string;
  checkpointId: string;
  stepIndex: number;
  canResume: boolean;
}

export interface WaitingConfirmationPayload {
  taskId: string;
  stepId: string;
  stepName: string;
  description: string;
  options?: string[];
}

export interface CommandPayload {
  command: 'confirm' | 'reject' | 'cancel' | 'pause' | 'resume';
  taskId?: string;
  data?: any;
}

export interface SubscribePayload {
  taskId?: string;
  events?: MessageType[];
}

// -------------------- Transport Interface --------------------

export interface RealtimeTransport {
  send(message: RealtimeMessage): void;
  onMessage(handler: (message: RealtimeMessage) => void): void;
  onConnect(handler: () => void): void;
  onDisconnect(handler: (reason?: string) => void): void;
  onError(handler: (error: Error) => void): void;
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
}

// -------------------- Server Config --------------------

export interface RealtimeServerConfig {
  port?: number;
  path?: string;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  maxConnections?: number;
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
}

// -------------------- Client Config --------------------

export interface RealtimeClientConfig {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
  protocols?: string[];
}

// -------------------- Connection State --------------------

export type ConnectionState = 
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface ConnectionInfo {
  clientId: string;
  state: ConnectionState;
  connectedAt?: number;
  lastMessageAt?: number;
  subscribedTasks: Set<string>;
}

// -------------------- Event Handlers --------------------

export type MessageHandler = (message: RealtimeMessage) => void;
export type ConnectionHandler = () => void;
export type DisconnectHandler = (reason?: string) => void;
export type ErrorHandler = (error: Error) => void;
