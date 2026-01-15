// ============================================
// Agent Core - Main Entry Point
// ============================================
// 
// Main entry exports core Agent functionality.
// For specialized features, import from submodules:
//   - '<scope>/agent-core/llm' - LLM clients (OpenAI, Anthropic)
//   - '<scope>/agent-core/persistence' - Storage adapters
//   - '<scope>/agent-core/realtime' - WebSocket/SSE communication
//
// ============================================

// -------------------- Types --------------------
export type {
  // Core types
  LLMClient,
  LLMMessage,
  LLMCompletionOptions,
  AgentConfig,
  AgentResponse,
  PlannerConfig,
  ExecutorConfig,
  
  // Plan types
  Plan,
  PlanStep,
  StepType,
  StepStatus,
  StepResult,
  StepDependency,
  ExecutionPlan,
  ExecutionStep,
  ExecutionContext,
  StateContext,
  StateTransition,
  TaskAnalysis,
  
  // Tool types
  ToolDefinition,
  ToolParameter,
  ToolCategory,
  ToolExecutor,
  ToolResult,
  ToolExecuteOptions,
  
  // Event types
  AgentEvent,
  AgentEventType,
  StatusEvent,
  TransitionEvent,
  PlanCreatedEvent,
  StepStartEvent,
  StepCompleteEvent,
  TaskCompleteEvent,
  TaskErrorEvent,
  WaitingEvent,
  EventCallback
} from './types';

// AgentState is an enum, export separately
export { AgentState } from './types';

// -------------------- Core --------------------
export {
  // Agent
  Agent,
  createAgent,
  
  // Planner
  CorePlanner,
  
  // Executor
  Executor,
  
  // State Machine
  StateMachine,
  
  // Tool Registry
  ToolRegistry,
  ToolBuilder,
  createTool
} from './core';

// -------------------- Default Tools --------------------
export {
  defaultTools,
  getToolsByCategory,
  getToolCategories
} from './tools';

// -------------------- Utilities --------------------
export {
  EventEmitter,
  generateId,
  delay,
  timeout,
  retry,
  deepClone,
  formatDuration,
  truncate
} from './utils';

// -------------------- LLM (Re-export for convenience) --------------------
export {
  createOpenAIClient,
  createAnthropicClient,
  createLLMClient,
  OpenAIClient,
  AnthropicClient
} from './llm';

// -------------------- Persistence (Re-export for convenience) --------------------
export {
  MemoryStorageAdapter,
  createPersistentAgent,
  PersistenceManager
} from './persistence';

// -------------------- Realtime (Re-export for convenience) --------------------
export {
  RealtimeServer,
  RealtimeAgent,
  createRealtimeAgent,
  createWebSocketAgent,
  SSEServer,
  SSEClient,
  WebSocketClient,
  createWebSocketClient,
  createSSEClient
} from './realtime';

// -------------------- Plugins (Re-export for convenience) --------------------
export {
  PluginManager,
  PluginRegistry,
  PluginLoader,
  createPluginManager,
  createPluginLoader,
  createToolPlugin,
  createMiddlewarePlugin
} from './plugins';

// -------------------- Skills (Re-export for convenience) --------------------
export {
  SkillManager,
  createSkillManager,
  cbpComplianceSkill
} from './skills';

export type {
  Skill,
  SkillCategory,
  SkillStatus,
  SkillTemplate,
  SkillRule,
  SkillExample,
  SkillManagerInterface
} from './skills';
// ============================================
// Quick Start Example
// ============================================
/*
import { createAgent, defaultTools } from '<scope>/agent-core';
import { createOpenAIClient } from '<scope>/agent-core/llm';

// Create LLM client
const llm = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
});

// Create agent
const agent = createAgent({
  llm,
  plannerConfig: {
    model: 'gpt-4o-mini',
    maxSteps: 20,
    enableParallel: true,
    confidenceThreshold: 0.8,
    planningTimeout: 60000
  },
  executorConfig: {
    maxConcurrency: 3,
    defaultTimeout: 30000,
    retryDelay: 1000,
    maxRetries: 3
  },
  tools: defaultTools
});

// Listen to events
agent.on('plan:created', ({ plan }) => {
  console.log(`Plan: ${plan.steps.length} steps`);
});

agent.on('step:complete', ({ result }) => {
  console.log(`✅ ${result.stepName}`);
});

// Process a task
const response = await agent.process('Analyze and summarize');
console.log(response);
*/
