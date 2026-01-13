# Agent API

Agent 是 Agent Core 的核心类，负责协调任务的规划和执行。

## 创建 Agent

```typescript
import { createAgent } from '@gtc-tech/agent-core';

const agent = createAgent(options);
```

### 参数

```typescript
interface AgentOptions {
  /** LLM 客户端 */
  llm: LLMClient;
  
  /** 可用工具列表 */
  tools: Tool[];
  
  /** 配置选项 */
  config?: AgentConfig;
}

interface AgentConfig {
  /** 最大执行步骤数，默认 20 */
  maxSteps?: number;
  
  /** 超时时间 (ms)，默认 60000 */
  timeout?: number;
  
  /** 是否自动重试失败步骤，默认 true */
  autoRetry?: boolean;
  
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  
  /** 单步超时 (ms)，默认 30000 */
  stepTimeout?: number;
  
  /** 并行执行数，默认 3 */
  maxConcurrency?: number;
}
```

## 方法

### run(task, context?)

执行任务并返回结果。

```typescript
const result = await agent.run(task: string, context?: Record<string, any>);
```

**参数:**
- `task` - 任务描述
- `context` - 可选的上下文数据

**返回:**

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

**示例:**

```typescript
const result = await agent.run('分析销售数据', {
  dataPath: '/data/sales.csv',
  outputFormat: 'markdown'
});

if (result.success) {
  console.log(result.output);
} else {
  console.error(result.error);
}
```

### runWithPlan(plan, context?)

使用预定义计划执行任务。

```typescript
const result = await agent.runWithPlan(plan: ExecutionPlan, context?: Record<string, any>);
```

**示例:**

```typescript
const plan: ExecutionPlan = {
  id: 'plan_1',
  taskDescription: '处理数据',
  steps: [
    { id: 'step_1', type: 'tool', name: '读取文件', tool: 'file_read', params: { path: 'data.csv' } },
    { id: 'step_2', type: 'tool', name: '解析CSV', tool: 'csv_parse', dependsOn: ['step_1'] }
  ],
  estimatedTime: 5000
};

const result = await agent.runWithPlan(plan);
```

### stop()

停止当前任务执行。

```typescript
agent.stop();
```

### getState()

获取当前状态。

```typescript
const state = agent.getState();
// 'idle' | 'planning' | 'executing' | 'waiting' | 'complete' | 'error'
```

### getPlan()

获取当前执行计划。

```typescript
const plan = agent.getPlan();
```

## 事件

Agent 继承 EventEmitter，支持以下事件：

### plan:created

计划创建完成时触发。

```typescript
agent.on('plan:created', (plan: ExecutionPlan) => {
  console.log('计划步骤数:', plan.steps.length);
});
```

### plan:updated

计划更新时触发。

```typescript
agent.on('plan:updated', (plan: ExecutionPlan) => {
  console.log('计划已更新');
});
```

### step:start

步骤开始执行时触发。

```typescript
agent.on('step:start', (step: ExecutionStep) => {
  console.log('开始:', step.name);
});
```

### step:progress

步骤执行进度更新时触发。

```typescript
agent.on('step:progress', (step: ExecutionStep, progress: number) => {
  console.log(`${step.name}: ${progress}%`);
});
```

### step:complete

步骤执行完成时触发。

```typescript
agent.on('step:complete', (step: ExecutionStep, result: StepResult) => {
  console.log('完成:', step.name, result.duration, 'ms');
});
```

### step:error

步骤执行出错时触发。

```typescript
agent.on('step:error', (step: ExecutionStep, error: Error) => {
  console.error('错误:', step.name, error.message);
});
```

### task:complete

任务完成时触发。

```typescript
agent.on('task:complete', (result: AgentResponse) => {
  console.log('任务完成:', result.success);
});
```

### task:error

任务出错时触发。

```typescript
agent.on('task:error', (error: Error) => {
  console.error('任务失败:', error.message);
});
```

### waiting:confirmation

需要用户确认时触发。

```typescript
agent.on('waiting:confirmation', (step: ExecutionStep, reason: string) => {
  console.log('需要确认:', reason);
  // agent.confirm(step.id, true);  // 确认继续
});
```

## 完整示例

```typescript
import { createAgent, defaultTools } from '@gtc-tech/agent-core';
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';

// 创建 Agent
const agent = createAgent({
  llm: createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY }),
  tools: defaultTools,
  config: {
    maxSteps: 10,
    timeout: 30000,
    autoRetry: true
  }
});

// 监听事件
agent.on('step:start', (step) => {
  console.log(`[${step.id}] 开始: ${step.name}`);
});

agent.on('step:complete', (step, result) => {
  console.log(`[${step.id}] 完成: ${result.duration}ms`);
});

agent.on('task:complete', (result) => {
  console.log('='.repeat(40));
  console.log('任务完成!');
  console.log('成功:', result.success);
  console.log('步骤数:', result.steps.length);
  console.log('总时长:', result.duration, 'ms');
});

// 执行任务
try {
  const result = await agent.run('读取 data.csv 文件并统计行数');
  console.log('输出:', result.output);
} catch (error) {
  console.error('执行失败:', error);
}
```

## 相关

- [Planner API](/api/planner)
- [Executor API](/api/executor)
- [StateMachine API](/api/state-machine)
