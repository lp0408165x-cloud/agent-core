// ============================================
// Agent Core - Type Definitions
// ============================================

// -------------------- State Types --------------------

export enum AgentState {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  WAITING = 'WAITING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface StateContext {
  state: AgentState;
  taskId: string;
  task: string;
  plan: ExecutionPlan | null;
  currentStepIndex: number;
  results: StepResult[];
  error: Error | null;
  startTime: number;
  metadata: Record<string, any>;
}

export interface StateTransition {
  from: AgentState | AgentState[];
  to: AgentState;
  trigger: string;
  guard?: (ctx: StateContext) => boolean;
  action?: (ctx: StateContext, payload?: any) => void;
}

export interface TransitionEvent {
  from: AgentState;
  to: AgentState;
  trigger: string;
  timestamp: number;
}

// -------------------- Plan Types --------------------

export type StepType = 'tool' | 'llm' | 'conditional' | 'loop' | 'parallel';

export interface ExecutionStep {
  id: string;
  type: StepType;
  name: string;
  description: string;
  tool?: string;
  params?: Record<string, any>;
  dependsOn?: string[];
  condition?: string;
  retryable?: boolean;
  maxRetries?: number;
  timeout?: number;
  needConfirmation?: boolean;
  children?: ExecutionStep[];  // For loop/parallel
}

export interface ExecutionPlan {
  id: string;
  taskDescription: string;
  steps: ExecutionStep[];
  estimatedTime: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface TaskAnalysis {
  taskType: 'retrieval' | 'document' | 'analysis' | 'code' | 'other';
  resources: string[];
  outputFormat: string;
  risks: string[];
  confirmationPoints: string[];
  complexity: 'low' | 'medium' | 'high';
}

// -------------------- Executor Types --------------------

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export interface StepResult {
  stepId: string;
  stepName: string;
  status: StepStatus;
  output?: any;
  error?: Error;
  startTime: number;
  endTime: number;
  duration: number;
  retries: number;
}

export interface ExecutionContext {
  taskId: string;
  variables: Record<string, any>;
  stepResults: Map<string, StepResult>;
  abortSignal?: AbortSignal;
}

// -------------------- Tool Types --------------------

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  parameters: ToolParameter[];
  returns: string;
  execute: (params: Record<string, any>, options?: ToolExecuteOptions) => Promise<any>;
}

export interface ToolExecuteOptions {
  signal?: AbortSignal;
  timeout?: number;
  context?: Record<string, any>;
}

// -------------------- LLM Types --------------------

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
}

export interface LLMClient {
  complete(prompt: string, options?: LLMCompletionOptions): Promise<string>;
  chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string>;
}

// -------------------- Config Types --------------------

export interface PlannerConfig {
  model: string;
  maxSteps: number;
  enableParallel: boolean;
  confidenceThreshold: number;
  planningTimeout: number;
}

export interface ExecutorConfig {
  maxConcurrency: number;
  defaultTimeout: number;
  retryDelay: number;
  maxRetries: number;
}

export interface AgentConfig {
  llm: LLMClient;
  plannerConfig: PlannerConfig;
  executorConfig: ExecutorConfig;
  tools?: ToolDefinition[];
  onEvent?: (event: AgentEvent) => void;
}

// -------------------- Event Types --------------------

export type AgentEventType = 
  | 'status'
  | 'transition'
  | 'plan:created'
  | 'plan:updated'
  | 'step:start'
  | 'step:progress'
  | 'step:complete'
  | 'step:error'
  | 'task:complete'
  | 'task:error'
  | 'waiting:confirmation';

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  data: any;
}

// -------------------- Response Types --------------------

export interface AgentResponse {
  success: boolean;
  taskId: string;
  plan?: ExecutionPlan;
  results?: StepResult[];
  output?: any;
  summary?: string;
  error?: Error;
  duration: number;
}

// -------------------- Utility Types --------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventCallback<T = any> = (data: T) => void;

export interface EventEmitterInterface {
  on<T>(event: string, callback: EventCallback<T>): void;
  off(event: string, callback: EventCallback): void;
  emit<T>(event: string, data: T): void;
}

// -------------------- Type Aliases (for compatibility) --------------------

/** @deprecated Use ExecutionPlan instead */
export type Plan = ExecutionPlan;

/** @deprecated Use ExecutionStep instead */
export type PlanStep = ExecutionStep;

export interface StepDependency {
  stepId: string;
  required: boolean;
}

export type ToolCategory = 'file' | 'http' | 'data' | 'system' | 'custom';

export type ToolExecutor = (params: Record<string, unknown>, options?: ToolExecuteOptions) => Promise<unknown>;

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// -------------------- Event Payload Types --------------------

export interface StatusEvent {
  state: AgentState;
  message: string;
}

export interface PlanCreatedEvent {
  plan: ExecutionPlan;
}

export interface StepStartEvent {
  stepId: string;
  stepName: string;
  description: string;
  type: StepType;
}

export interface StepCompleteEvent {
  stepId: string;
  stepName: string;
  result: StepResult;
}

export interface TaskCompleteEvent {
  taskId: string;
  result: AgentResponse;
}

export interface TaskErrorEvent {
  taskId: string;
  error: Error;
  result?: AgentResponse;
}

export interface WaitingEvent {
  stepId: string;
  stepName: string;
  reason: string;
}
