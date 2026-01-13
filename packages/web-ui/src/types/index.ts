// ============================================
// Agent Core UI - Type Definitions
// ============================================

export type AgentState = 
  | 'idle' 
  | 'planning' 
  | 'executing' 
  | 'waiting' 
  | 'complete' 
  | 'error';

export type StepStatus = 
  | 'pending' 
  | 'running' 
  | 'success' 
  | 'failed' 
  | 'skipped';

export interface ExecutionStep {
  id: string;
  name: string;
  description: string;
  type: 'tool' | 'llm' | 'conditional' | 'loop' | 'parallel';
  tool?: string;
  status: StepStatus;
  duration?: number;
  output?: unknown;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  taskDescription: string;
  steps: ExecutionStep[];
  estimatedTime: number;
  createdAt: string;
}

export interface TaskResult {
  success: boolean;
  taskId: string;
  output?: unknown;
  summary?: string;
  error?: string;
  duration: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
}

// WebSocket Message Types
export type MessageType =
  | 'status'
  | 'plan:created'
  | 'plan:updated'
  | 'step:start'
  | 'step:progress'
  | 'step:complete'
  | 'step:error'
  | 'task:complete'
  | 'task:error'
  | 'waiting:confirmation'
  | 'tools:list'
  | 'connected'
  | 'error';

export interface WSMessage {
  type: MessageType;
  timestamp: number;
  data: unknown;
}

// Component Props
export interface AgentPanelProps {
  wsUrl?: string;
  apiUrl?: string;
  onTaskComplete?: (result: TaskResult) => void;
  onError?: (error: Error) => void;
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
}

export interface TaskInputProps {
  onSubmit: (task: string, context?: Record<string, unknown>) => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface PlanViewProps {
  plan: ExecutionPlan | null;
  currentStepId?: string;
}

export interface StepCardProps {
  step: ExecutionStep;
  isActive: boolean;
  index: number;
}

export interface LogPanelProps {
  logs: LogEntry[];
  maxHeight?: number;
  autoScroll?: boolean;
}

export interface ToolsPanelProps {
  tools: ToolDefinition[];
  onToolSelect?: (tool: ToolDefinition) => void;
}

export interface ResultViewProps {
  result: TaskResult | null;
  onNewTask?: () => void;
}
