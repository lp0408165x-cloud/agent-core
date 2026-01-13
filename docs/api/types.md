# 类型定义

Agent Core 的核心类型定义。

## LLM 类型

### LLMClient

```typescript
interface LLMClient {
  /** 单次补全 */
  complete(prompt: string, options?: LLMCompletionOptions): Promise<string>;
  
  /** 多轮对话 */
  chat(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<string>;
}
```

### LLMMessage

```typescript
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### LLMCompletionOptions

```typescript
interface LLMCompletionOptions {
  /** 模型名称 */
  model?: string;
  
  /** 最大输出 token 数 */
  maxTokens?: number;
  
  /** 温度 (0-2) */
  temperature?: number;
  
  /** 停止序列 */
  stop?: string[];
  
  /** 中止信号 */
  signal?: AbortSignal;
}
```

### ExtendedLLMClient

```typescript
interface ExtendedLLMClient extends LLMClient {
  /** 提供商名称 */
  provider: LLMProvider;
  
  /** 当前模型 */
  model: string;
  
  /** 获取用量统计 */
  getUsage(): LLMUsage;
  
  /** 获取调用历史 */
  getCallHistory(): LLMCallRecord[];
  
  /** 重置统计 */
  resetUsage(): void;
  
  /** 设置模型 */
  setModel(model: string): void;
  
  /** 获取可用模型列表 */
  getAvailableModels(): string[];
  
  /** 设置温度 */
  setTemperature(temp: number): void;
  
  /** 设置最大 token */
  setMaxTokens(tokens: number): void;
}
```

### LLMUsage

```typescript
interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}
```

### LLMProvider

```typescript
type LLMProvider = 
  | 'openai' 
  | 'anthropic' 
  | 'gemini' 
  | 'mistral' 
  | 'ollama' 
  | 'azure' 
  | 'custom';
```

## 工具类型

### Tool

```typescript
interface Tool {
  /** 工具名称 */
  name: string;
  
  /** 工具描述 */
  description: string;
  
  /** 工具类别 */
  category?: string;
  
  /** 参数定义 */
  parameters: ToolParameter[];
  
  /** 执行函数 */
  execute(params: Record<string, any>, context?: ExecutionContext): Promise<ToolResult>;
}
```

### ToolParameter

```typescript
interface ToolParameter {
  /** 参数名 */
  name: string;
  
  /** 参数类型 */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  
  /** 是否必填 */
  required: boolean;
  
  /** 参数描述 */
  description: string;
  
  /** 默认值 */
  default?: any;
  
  /** 验证函数 */
  validate?: (value: any) => boolean | string;
}
```

### ToolResult

```typescript
interface ToolResult {
  /** 是否成功 */
  success: boolean;
  
  /** 返回数据 */
  data?: any;
  
  /** 错误信息 */
  error?: string;
}
```

## 执行类型

### ExecutionPlan

```typescript
interface ExecutionPlan {
  /** 计划 ID */
  id: string;
  
  /** 任务描述 */
  taskDescription: string;
  
  /** 执行步骤 */
  steps: ExecutionStep[];
  
  /** 预估时间 (ms) */
  estimatedTime: number;
  
  /** 创建时间 */
  createdAt: string;
}
```

### ExecutionStep

```typescript
interface ExecutionStep {
  /** 步骤 ID */
  id: string;
  
  /** 步骤名称 */
  name: string;
  
  /** 步骤描述 */
  description: string;
  
  /** 步骤类型 */
  type: 'tool' | 'llm' | 'conditional' | 'loop' | 'parallel';
  
  /** 使用的工具 */
  tool?: string;
  
  /** 工具参数 */
  params?: Record<string, any>;
  
  /** 依赖的步骤 */
  dependsOn?: string[];
  
  /** 执行状态 */
  status: StepStatus;
  
  /** 执行时长 (ms) */
  duration?: number;
  
  /** 执行输出 */
  output?: any;
  
  /** 错误信息 */
  error?: string;
}
```

### StepStatus

```typescript
type StepStatus = 
  | 'pending' 
  | 'running' 
  | 'success' 
  | 'failed' 
  | 'skipped';
```

### AgentResponse

```typescript
interface AgentResponse {
  /** 是否成功 */
  success: boolean;
  
  /** 任务 ID */
  taskId: string;
  
  /** 任务输出 */
  output?: any;
  
  /** 结果摘要 */
  summary?: string;
  
  /** 错误信息 */
  error?: string;
  
  /** 执行步骤 */
  steps: ExecutionStep[];
  
  /** 执行时长 (ms) */
  duration: number;
}
```

## 状态类型

### AgentState

```typescript
type AgentState = 
  | 'idle' 
  | 'planning' 
  | 'executing' 
  | 'waiting' 
  | 'complete' 
  | 'error';
```

## 上下文类型

### ExecutionContext

```typescript
interface ExecutionContext {
  /** 任务 ID */
  taskId: string;
  
  /** 当前步骤 ID */
  stepId?: string;
  
  /** 获取共享数据 */
  get(key: string): any;
  
  /** 设置共享数据 */
  set(key: string, value: any): void;
  
  /** 获取步骤结果 */
  getStepResult(stepId: string): any;
}
```

## 配置类型

### AgentConfig

```typescript
interface AgentConfig {
  maxSteps?: number;
  timeout?: number;
  autoRetry?: boolean;
  maxRetries?: number;
  stepTimeout?: number;
  maxConcurrency?: number;
}
```

## 导入类型

```typescript
import type {
  LLMClient,
  LLMMessage,
  LLMCompletionOptions,
  ExtendedLLMClient,
  LLMUsage,
  LLMProvider,
  Tool,
  ToolParameter,
  ToolResult,
  ExecutionPlan,
  ExecutionStep,
  StepStatus,
  AgentResponse,
  AgentState,
  ExecutionContext,
  AgentConfig
} from '@gtc-tech/agent-core';
```
