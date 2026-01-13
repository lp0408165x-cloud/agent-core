# Agent Core

[![npm version](https://img.shields.io/npm/v/@gtc-tech/agent-core.svg)](https://www.npmjs.com/package/@gtc-tech/agent-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@gtc-tech/agent-core.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## CorePlanner + Executor + StateMachine 架构

一个用于LLM驱动任务自动化的Agent框架，支持OpenAI和Anthropic。

---

## 特性

- 🧠 **智能规划** - LLM驱动的任务分解和依赖解析
- ⚡ **并发执行** - 支持并行步骤执行，自动重试
- 🔄 **状态管理** - XState兼容的状态机
- 💾 **持久化** - 检查点、恢复、执行历史
- 📡 **实时通信** - WebSocket/SSE状态同步
- 🔌 **LLM集成** - OpenAI、Anthropic、Azure开箱即用
- 🛠️ **可扩展** - 自定义工具、存储适配器

---

## 安装

```bash
npm install @gtc-tech/agent-core
# 或
yarn add @gtc-tech/agent-core
# 或
pnpm add @gtc-tech/agent-core
```

---

## 快速开始

```typescript
// 核心Agent从主入口导入
import { createAgent, defaultTools } from '@gtc-tech/agent-core';
// LLM客户端从子模块导入
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';

// 创建LLM客户端
const llm = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
});

// 创建Agent
const agent = createAgent({
  llm,
  plannerConfig: {
    model: 'gpt-4o-mini',
    maxSteps: 15,
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

// 监听事件
agent.on('plan:created', ({ plan }) => {
  console.log(`计划生成: ${plan.steps.length} 步骤`);
});

agent.on('step:complete', ({ result }) => {
  console.log(`✅ ${result.stepName}`);
});

// 执行任务
const response = await agent.process('分析文档并生成报告');
console.log(response);
```

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       StateMachine                           │
│  IDLE → PLANNING → EXECUTING → COMPLETE                      │
│           ↓            ↓                                     │
│         ERROR ←───── WAITING                                 │
└─────────────────────────────────────────────────────────────┘
                    │                 │
          ┌─────────┘                 └─────────┐
          ▼                                     ▼
┌──────────────────────┐            ┌──────────────────────┐
│     CorePlanner      │            │      Executor        │
│  • Task Analysis     │   Plan     │  • Tool Router       │
│  • Step Generation   │ ─────────▶ │  • Step Runner       │
│  • Dependency Graph  │            │  • Error Handler     │
└──────────────────────┘            └──────────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────────┐
                                    │    ToolRegistry      │
                                    │  • File Tools        │
                                    │  • Web Tools         │
                                    │  • Data Tools        │
                                    └──────────────────────┘
```

---

## 快速开始

```typescript
import { createAgent, defaultTools, LLMClient } from '@gtc-tech/agent-core';

// 1. 实现LLM客户端
const llm: LLMClient = {
  async complete(prompt: string) {
    // 调用你的LLM API
    return await callYourLLM(prompt);
  },
  async chat(messages) {
    return await callYourLLM(messages);
  }
};

// 2. 创建Agent
const agent = createAgent({
  llm,
  plannerConfig: {
    model: 'gpt-4',
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

// 3. 监听事件
agent.on('status', (data) => console.log('状态:', data));
agent.on('step:start', (data) => console.log('开始步骤:', data));
agent.on('step:complete', (data) => console.log('完成步骤:', data));

// 4. 处理任务
const response = await agent.process('分析上传的文件并生成报告');
console.log(response);
```

---

## 核心组件

### 1. StateMachine (状态机)

管理Agent生命周期和状态转换。

```typescript
import { StateMachine, AgentState } from '@gtc-tech/agent-core';

const sm = new StateMachine();

// 获取当前状态
console.log(sm.getState()); // AgentState.IDLE

// 触发状态转换
sm.dispatch('START_TASK', { task: '分析文档' });

// 监听转换
sm.on('transition', ({ from, to, trigger }) => {
  console.log(`${from} -> ${to}`);
});

// 检查可用转换
console.log(sm.getAvailableTriggers());
```

**状态流转图:**

| From | Trigger | To |
|------|---------|-----|
| IDLE | START_TASK | PLANNING |
| PLANNING | PLAN_READY | EXECUTING |
| PLANNING | PLAN_FAILED | ERROR |
| EXECUTING | STEP_COMPLETE | EXECUTING/COMPLETE |
| EXECUTING | NEED_CONFIRMATION | WAITING |
| EXECUTING | EXECUTION_FAILED | ERROR |
| WAITING | USER_CONFIRMED | EXECUTING |
| WAITING | USER_REJECTED | ERROR |
| ERROR/COMPLETE | RESET | IDLE |

### 2. CorePlanner (规划器)

分析任务并生成执行计划。

```typescript
import { CorePlanner, ToolRegistry } from '@gtc-tech/agent-core';

const planner = new CorePlanner(llm, config, toolRegistry);

// 创建计划
const plan = await planner.createPlan('读取文件并分析数据');

// 计划结构
{
  id: 'plan_xxx',
  taskDescription: '...',
  steps: [
    {
      id: 'step_1',
      type: 'tool',        // tool | llm | conditional | loop | parallel
      name: '读取文件',
      tool: 'file_read',
      params: { path: '...' },
      dependsOn: [],
      retryable: true,
      timeout: 30000
    }
  ],
  estimatedTime: 60000
}

// 重新规划
const newPlan = await planner.replan(plan, failedStep, error, results);
```

### 3. Executor (执行器)

执行计划中的步骤。

```typescript
import { Executor, ToolRegistry } from '@gtc-tech/agent-core';

const executor = new Executor(toolRegistry, config);

// 执行单个步骤
const result = await executor.executeStep(step, context);

// 执行整个计划
const { results, success } = await executor.executePlan(plan);

// 控制执行
executor.pause();
executor.resume();
executor.cancel();
```

### 4. ToolRegistry (工具注册表)

管理可用工具。

```typescript
import { ToolRegistry, createTool } from '@gtc-tech/agent-core';

const registry = new ToolRegistry();

// 注册工具
registry.register({
  name: 'my_tool',
  description: '描述',
  category: 'custom',
  parameters: [
    { name: 'input', type: 'string', required: true, description: '输入' }
  ],
  returns: 'string',
  execute: async (params) => {
    return `处理: ${params.input}`;
  }
});

// 使用工具构建器
const tool = createTool()
  .name('another_tool')
  .description('另一个工具')
  .category('custom')
  .parameter({ name: 'data', type: 'object', required: true, description: '数据' })
  .returns('object')
  .execute(async (params) => params.data)
  .build();

registry.register(tool);
```

---

## 内置工具

| 类别 | 工具名 | 描述 |
|------|--------|------|
| **filesystem** | file_read | 读取文件 |
| | file_write | 写入文件 |
| | file_list | 列出目录 |
| **web** | web_search | 搜索网页 |
| | web_fetch | 获取URL内容 |
| **data** | json_parse | 解析JSON |
| | json_stringify | 序列化JSON |
| | csv_parse | 解析CSV |
| **text** | text_extract | 正则提取 |
| | text_replace | 文本替换 |
| **code** | code_execute | 执行JS代码 |
| **math** | math_evaluate | 计算表达式 |
| **datetime** | datetime_format | 格式化时间 |

---

## 事件系统

```typescript
// 状态事件
agent.on('status', ({ state, message }) => {});
agent.on('transition', ({ from, to, trigger }) => {});

// 计划事件
agent.on('plan:created', ({ plan }) => {});
agent.on('plan:updated', ({ replan }) => {});

// 步骤事件
agent.on('step:start', ({ stepId, stepName, type }) => {});
agent.on('step:progress', ({ currentStep, totalSteps }) => {});
agent.on('step:complete', ({ result }) => {});
agent.on('step:error', ({ result, error }) => {});

// 任务事件
agent.on('task:complete', ({ success }) => {});
agent.on('task:error', ({ error }) => {});

// 确认事件
agent.on('waiting:confirmation', ({ stepId, description }) => {});
```

---

## 执行计划步骤类型

### tool - 工具调用
```json
{
  "type": "tool",
  "tool": "file_read",
  "params": { "path": "/data/input.txt" }
}
```

### llm - LLM调用
```json
{
  "type": "llm",
  "params": { 
    "prompt": "分析以下数据: {{step_1.output}}",
    "outputFormat": "json"
  }
}
```

### conditional - 条件分支
```json
{
  "type": "conditional",
  "condition": "step_1.output.count > 100"
}
```

### loop - 循环
```json
{
  "type": "loop",
  "params": { "items": "{{step_1.output.files}}" },
  "children": [...]
}
```

### parallel - 并行执行
```json
{
  "type": "parallel",
  "children": [
    { "id": "task_a", ... },
    { "id": "task_b", ... }
  ]
}
```

---

## 参数模板

支持使用 `{{path}}` 语法引用上下文变量：

```json
{
  "params": {
    "file": "{{step_1.output.path}}",
    "message": "处理文件: {{step_1.output.name}}"
  }
}
```

---

## 错误处理

```typescript
// 可重试步骤
{
  "retryable": true,
  "maxRetries": 3
}

// 监听错误
agent.on('step:error', async ({ result, error }) => {
  console.error(`步骤失败: ${result.stepName}`, error);
  
  // 决定是否继续
  if (isRecoverable(error)) {
    agent.confirm(); // 继续下一步
  } else {
    agent.cancel(); // 取消任务
  }
});
```

---

## 人机协作

```typescript
// 标记需要确认的步骤
{
  "needConfirmation": true,
  "description": "即将删除文件，是否继续？"
}

// 处理确认请求
agent.on('waiting:confirmation', ({ stepId, description }) => {
  // 显示确认对话框
  const userChoice = await showConfirmDialog(description);
  
  if (userChoice.approved) {
    agent.confirm(userChoice.data);
  } else {
    agent.reject(userChoice.reason);
  }
});
```

---

## 七、持久化层

### 存储适配器

支持多种存储后端：

| 适配器 | 环境 | 用途 |
|--------|------|------|
| `MemoryStorageAdapter` | 通用 | 开发/测试 |
| `FileStorageAdapter` | Node.js | 服务端持久化 |
| `LocalStorageAdapter` | 浏览器 | 简单客户端存储 |
| `IndexedDBAdapter` | 浏览器 | 大量数据存储 |

```typescript
import { createStorageAdapter, createPersistentAgent } from '@agent-core';

// 内存存储
const memoryAdapter = createStorageAdapter({ type: 'memory' });

// 文件存储
const fileAdapter = createStorageAdapter({ 
  type: 'file', 
  path: '/data/agent' 
});

// 浏览器存储
const indexedDBAdapter = createStorageAdapter({
  type: 'indexedDB',
  dbName: 'MyApp',
  storeName: 'tasks'
});
```

### PersistentAgent

带持久化功能的Agent：

```typescript
const agent = createPersistentAgent({
  llm,
  plannerConfig,
  executorConfig,
  tools: defaultTools,
  persistence: {
    adapter: fileAdapter,
    keyPrefix: 'myapp:',
    checkpointInterval: 30000,    // 30秒自动保存
    checkpointRetention: 86400000, // 检查点保留24小时
    historyRetention: 604800000,   // 历史保留7天
    enableAutoSave: true
  },
  autoCheckpoint: true,
  checkpointOnStep: true
});

// 初始化
await agent.initialize();

// 处理任务
const response = await agent.process('分析文档');

// 关闭
await agent.shutdown();
```

### 任务恢复

从中断点继续执行：

```typescript
// 检查是否可恢复
const { canResume, checkpoint } = await agent.persistenceManager.canResumeTask(taskId);

if (canResume) {
  // 恢复执行
  const response = await agent.resumeTask(taskId);
  console.log('恢复成功:', response.success);
}
```

### 查询任务

```typescript
// 列出任务
const tasks = await agent.listTasks({
  status: 'completed',
  limit: 10,
  offset: 0
});

// 加载单个任务
const task = await agent.loadTask(taskId);

// 获取执行历史
const history = await agent.getTaskHistory(taskId);

// 获取统计信息
const stats = await agent.getStatistics();
```

### 检查点

```typescript
// 手动创建检查点
const checkpoint = await agent.createCheckpoint();

// 获取任务的所有检查点
const checkpoints = await agent.getCheckpoints(taskId);

// 监听检查点事件
agent.on('checkpoint:created', ({ checkpoint }) => {
  console.log(`检查点: ${checkpoint.id}`);
});
```

### 计划版本

```typescript
// 获取计划版本历史
const versions = await agent.getPlanVersions(taskId);

versions.forEach(v => {
  console.log(`v${v.version}: ${v.reason} - ${v.plan.steps.length} 步骤`);
});
```

### 数据清理

```typescript
// 手动清理过期数据
await agent.cleanup();

// 删除任务及相关数据
await agent.deleteTask(taskId);
```

---

## 八、持久化数据结构

### PersistedTask

```typescript
interface PersistedTask {
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
```

### Checkpoint

```typescript
interface Checkpoint {
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
```

### ExecutionRecord

```typescript
interface ExecutionRecord {
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
}
```

---

## 九、实时通信层

支持WebSocket和SSE两种方式将Agent执行状态同步到前端。

### WebSocket (双向通信)

**服务端：**

```typescript
import { RealtimeServer, createWebSocketAgent } from '@agent-core';

// 创建WebSocket服务
const wsServer = new RealtimeServer({
  port: 8080,
  path: '/ws',
  heartbeatInterval: 30000
});

await wsServer.start();

// 创建带实时同步的Agent
const agent = createWebSocketAgent({
  llm,
  plannerConfig,
  executorConfig,
  tools: defaultTools
}, wsServer);

// 处理任务 - 状态自动广播到客户端
await agent.process('分析文档');
```

**客户端：**

```typescript
import { createWebSocketClient } from '@agent-core';

const client = createWebSocketClient('ws://localhost:8080/ws');

// 监听事件
client.onTaskStart((payload) => console.log('任务开始:', payload.taskId));
client.onPlanCreated((payload) => console.log('计划生成:', payload.plan));
client.onStepStart((payload) => console.log('步骤开始:', payload.stepName));
client.onStepProgress((payload) => console.log('进度:', payload.progress));
client.onStepComplete((payload) => console.log('步骤完成:', payload.status));
client.onTaskComplete((payload) => console.log('任务完成:', payload.success));
client.onWaitingConfirmation((payload) => {
  // 需要用户确认
  client.confirm(payload.taskId);
});

await client.connect();

// 发送命令
client.confirm(taskId);
client.reject(taskId, 'reason');
client.cancel(taskId);
client.pause(taskId);
client.resume(taskId);
```

### SSE (单向：服务端→客户端)

**服务端 (Express)：**

```typescript
import express from 'express';
import { SSEServer, createSSEAgent } from '@agent-core';

const app = express();
const sseServer = new SSEServer({ heartbeatInterval: 30000 });

// SSE端点
app.get('/events', (req, res) => {
  const clientId = sseServer.handleConnection(req, res);
  const taskId = req.query.taskId;
  if (taskId) {
    sseServer.subscribeToTask(clientId, taskId);
  }
});

// 命令端点 (SSE是单向的)
app.post('/command', express.json(), (req, res) => {
  agent.handleHttpCommand(req.body, res);
});

app.listen(3000);
```

**客户端：**

```typescript
import { createSSEClient } from '@agent-core';

const client = createSSEClient('http://localhost:3000/events?taskId=task_123');

client.onStepComplete((payload) => console.log('步骤完成:', payload));
client.onTaskComplete((payload) => console.log('任务完成:', payload));

await client.connect();

// 命令通过HTTP发送
await client.confirm('/command', taskId);
await client.cancel('/command', taskId);
```

### 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| `connection` | S→C | 连接建立 |
| `task:start` | S→C | 任务开始 |
| `task:complete` | S→C | 任务完成 |
| `task:error` | S→C | 任务错误 |
| `plan:created` | S→C | 计划生成 |
| `step:start` | S→C | 步骤开始 |
| `step:progress` | S→C | 步骤进度 |
| `step:complete` | S→C | 步骤完成 |
| `state:change` | S→C | 状态变化 |
| `waiting:confirmation` | S→C | 等待确认 |
| `command` | C→S | 客户端命令 |
| `subscribe` | C→S | 订阅任务 |

### React Hook 示例

```typescript
function useAgentRealtime(url: string) {
  const [state, setState] = useState({
    connected: false,
    taskId: null,
    status: 'idle',
    steps: [],
    error: null
  });

  useEffect(() => {
    const client = createWebSocketClient(url);
    
    client.onConnect(() => setState(s => ({ ...s, connected: true })));
    client.onTaskStart((p) => setState(s => ({ ...s, taskId: p.taskId })));
    client.onStepComplete((p) => setState(s => ({
      ...s,
      steps: s.steps.map(step => 
        step.id === p.stepId ? { ...step, status: p.status } : step
      )
    })));
    
    client.connect();
    return () => client.disconnect();
  }, [url]);

  return state;
}
```

---

## 十、完整项目结构

```
agent-core/
├── src/
│   ├── types/
│   │   └── index.ts              # 核心类型定义
│   ├── core/
│   │   ├── StateMachine.ts       # 状态机
│   │   ├── CorePlanner.ts        # 规划器
│   │   ├── Executor.ts           # 执行器
│   │   ├── ToolRegistry.ts       # 工具注册表
│   │   ├── Agent.ts              # 主控制器
│   │   └── index.ts
│   ├── persistence/
│   │   ├── types.ts              # 持久化类型
│   │   ├── adapters.ts           # 存储适配器
│   │   ├── PersistenceManager.ts # 持久化管理器
│   │   ├── PersistentAgent.ts    # 持久化Agent
│   │   ├── examples.ts           # 使用示例
│   │   └── index.ts
│   ├── realtime/
│   │   ├── types.ts              # 实时通信类型
│   │   ├── WebSocketServer.ts    # WebSocket服务端
│   │   ├── WebSocketClient.ts    # WebSocket客户端
│   │   ├── SSEServer.ts          # SSE服务端
│   │   ├── SSEClient.ts          # SSE客户端
│   │   ├── RealtimeAgent.ts      # 实时Agent
│   │   ├── examples.ts           # 使用示例
│   │   └── index.ts
│   ├── llm/
│   │   ├── types.ts              # LLM类型定义
│   │   ├── OpenAIClient.ts       # OpenAI客户端
│   │   ├── AnthropicClient.ts    # Anthropic客户端
│   │   ├── factory.ts            # 工厂和工具类
│   │   ├── examples.ts           # 使用示例
│   │   └── index.ts
│   ├── tools/
│   │   └── index.ts              # 内置工具
│   ├── utils/
│   │   └── index.ts              # 工具函数
│   ├── examples.ts               # 使用示例
│   └── index.ts                  # 主入口
├── tests/
│   ├── config.ts                 # 测试配置
│   ├── run-tests.ts              # 测试运行器
│   ├── demo.ts                   # 演示脚本
│   ├── mocks/
│   │   └── MockLLM.ts            # Mock LLM
│   └── e2e/
│       ├── agent.test.ts         # Agent测试
│       └── cbp-documents.test.ts # CBP测试
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## License

MIT

---

## 十一、LLM 客户端

### 支持的提供商

| 提供商 | 模型 | 特性 |
|--------|------|------|
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4, GPT-3.5 | JSON模式, 流式输出 |
| **Anthropic** | Claude 3.5 Sonnet/Haiku, Claude 3 Opus | 视觉, 流式输出 |
| **Azure OpenAI** | 所有Azure部署模型 | 企业级 |

### OpenAI 客户端

```typescript
import { createOpenAIClient } from '@agent-core';

const openai = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7
});

// 基本完成
const response = await openai.complete('分析这段文本');

// 聊天
const chatResponse = await openai.chat([
  { role: 'system', content: '你是一个合规专家' },
  { role: 'user', content: '检查CBP要求' }
]);

// JSON模式
const data = await openai.chatJSON([
  { role: 'user', content: '提取发票信息，返回JSON' }
]);

// 流式输出
for await (const chunk of openai.chatStream(messages)) {
  process.stdout.write(chunk);
}
```

### Anthropic 客户端

```typescript
import { createAnthropicClient } from '@agent-core';

const anthropic = createAnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  defaultMaxTokens: 4096
});

// 基本用法
const response = await anthropic.complete('分析AD/CVD要求');

// 带系统提示
const response = await anthropic.chatWithSystem(
  '你是CBP合规专家',
  [{ role: 'user', content: '检查进口文档' }]
);

// 视觉 (图片分析)
const result = await anthropic.chatWithImage(
  '描述这张发票',
  imageBase64,
  'image/png'
);
```

### 工厂函数

```typescript
import { createLLMClient } from '@agent-core';

// 创建带速率限制和缓存的客户端
const client = createLLMClient({
  provider: 'openai',
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini'
  },
  rateLimit: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    retryOnRateLimit: true
  },
  cache: {
    enabled: true,
    ttl: 3600000,  // 1小时
    maxSize: 100
  }
});
```

### 多提供商回退

```typescript
import { MultiProviderClient, createOpenAIClient, createAnthropicClient } from '@agent-core';

const client = new MultiProviderClient({
  primary: createOpenAIClient({ apiKey: '...' }),
  fallback: createAnthropicClient({ apiKey: '...' })
});

// 主提供商失败时自动切换到备用
const response = await client.complete('任务描述');
```

### 用量追踪

```typescript
// 获取用量
const usage = client.getUsage();
console.log(`Tokens: ${usage.totalTokens}`);
console.log(`Cost: $${usage.estimatedCost}`);

// 获取调用历史
const history = client.getCallHistory();
history.forEach(call => {
  console.log(`${call.model}: ${call.duration}ms`);
});

// 重置
client.resetUsage();
```

### 与Agent集成

```typescript
import { createAgent, createOpenAIClient, defaultTools } from '@agent-core';

const llm = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
});

const agent = createAgent({
  llm,
  plannerConfig: {
    model: 'gpt-4o-mini',
    maxSteps: 15,
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

const response = await agent.process('CBP合规检查', {
  entryNumber: 'NMR-67472736'
});
```

---

## 十二、测试

### 运行测试

```bash
# 安装依赖
npm install

# 运行所有测试
npm test

# 运行测试 (单次)
npm run test:run

# 运行覆盖率测试
npm run test:coverage

# 运行端到端测试
npm run test:e2e
```

### 快速演示

```bash
# 运行演示脚本
npx ts-node tests/demo.ts
```

### 测试结构

```
tests/
├── config.ts           # 测试配置
├── run-tests.ts        # 简化测试运行器
├── demo.ts             # 快速演示脚本
├── mocks/
│   └── MockLLM.ts      # Mock LLM实现
├── e2e/
│   ├── agent.test.ts   # Agent基础测试
│   └── cbp-documents.test.ts  # CBP文档处理测试
└── fixtures/           # 测试数据
```

### 测试覆盖

| 模块 | 测试内容 |
|------|----------|
| **Agent** | 初始化、任务处理、状态转换、事件触发 |
| **Planner** | 计划生成、步骤验证、依赖排序 |
| **Executor** | 步骤执行、重试、超时、取消 |
| **Persistence** | 保存、加载、检查点、恢复 |
| **Realtime** | WebSocket连接、消息广播、命令处理 |
| **CBP** | 文档解析、合规检查、报告生成 |
