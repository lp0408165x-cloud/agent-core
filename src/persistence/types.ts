// ============================================
// Agent Core - Persistence Types
// ============================================

import { ExecutionPlan, StepResult, AgentState, StateContext } from '../types';

// -------------------- Storage Interface --------------------

export interface StorageAdapter {
  // Basic operations
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  
  // Batch operations
  getMany<T>(keys: string[]): Promise<Map<string, T>>;
  setMany<T>(entries: Map<string, T>, ttl?: number): Promise<void>;
  deleteMany(keys: string[]): Promise<number>;
  
  // Query operations
  keys(pattern?: string): Promise<string[]>;
  clear(pattern?: string): Promise<void>;
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

// -------------------- Task Persistence --------------------

export interface PersistedTask {
  id: string;
  description: string;
  status: TaskStatus;
  state: AgentState;
  plan: ExecutionPlan | null;
  context: Record<string, any>;
  results: StepResult[];
  currentStepIndex: number;
  error: SerializedError | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  metadata: Record<string, any>;
}

export type TaskStatus = 
  | 'pending'
  | 'planning'
  | 'executing'
  | 'paused'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

// -------------------- Execution History --------------------

export interface ExecutionRecord {
  id: string;
  taskId: string;
  stepId: string;
  stepName: string;
  type: string;
  status: 'success' | 'failed' | 'skipped' | 'cancelled';
  input: any;
  output: any;
  error: SerializedError | null;
  startTime: number;
  endTime: number;
  duration: number;
  retries: number;
  metadata: Record<string, any>;
}

export interface TaskHistory {
  taskId: string;
  records: ExecutionRecord[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
}

// -------------------- Checkpoint --------------------

export interface Checkpoint {
  id: string;
  taskId: string;
  timestamp: number;
  state: AgentState;
  stepIndex: number;
  context: Record<string, any>;
  results: StepResult[];
  canResume: boolean;
  expiresAt: number | null;
}

// -------------------- Plan Versioning --------------------

export interface PlanVersion {
  id: string;
  taskId: string;
  version: number;
  plan: ExecutionPlan;
  reason: 'initial' | 'replan' | 'modification';
  createdAt: number;
  parentVersionId: string | null;
}

// -------------------- Query Options --------------------

export interface TaskQueryOptions {
  status?: TaskStatus | TaskStatus[];
  fromDate?: number;
  toDate?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'completedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface HistoryQueryOptions {
  taskId?: string;
  stepId?: string;
  status?: string;
  fromDate?: number;
  toDate?: number;
  limit?: number;
  offset?: number;
}

// -------------------- Persistence Manager Config --------------------

export interface PersistenceConfig {
  adapter: StorageAdapter;
  keyPrefix?: string;
  checkpointInterval?: number;  // Auto-checkpoint interval in ms
  checkpointRetention?: number; // How long to keep checkpoints in ms
  historyRetention?: number;    // How long to keep history in ms
  enableAutoSave?: boolean;
  enableCompression?: boolean;
}

// -------------------- Events --------------------

export interface PersistenceEvent {
  type: 'save' | 'load' | 'delete' | 'checkpoint' | 'restore';
  taskId: string;
  timestamp: number;
  success: boolean;
  error?: Error;
}
