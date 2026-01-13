# 核心概念

Agent Core 的架构由几个核心组件组成，理解它们的工作方式有助于更好地使用框架。

## 架构概览

```
┌─────────────────────────────────────────────────┐
│                    Agent                         │
│  ┌─────────────┐  ┌──────────┐  ┌────────────┐  │
│  │   Planner   │→ │ Executor │→ │   Tools    │  │
│  └─────────────┘  └──────────┘  └────────────┘  │
│         ↑              ↑              ↑         │
│         └──────────────┼──────────────┘         │
│                        ↓                         │
│                 ┌────────────┐                   │
│                 │ StateMachine│                  │
│                 └────────────┘                   │
└─────────────────────────────────────────────────┘
```

## Agent

Agent 是框架的核心入口，负责协调整个任务执行流程。

```typescript
import { createAgent } from '@gtc-tech/agent-core';

const agent = createAgent({
  llm,           // LLM 客户端
  tools,         // 可用工具列表
  config: {
    maxSteps: 20,      // 最大执行步骤
    timeout: 60000,    // 超时时间 (ms)
    autoRetry: true,   // 自动重试
    maxRetries: 3      // 最大重试次数
  }
});
```

### 生命周期

1. **接收任务** - `agent.run(task)`
2. **分析任务** - Planner 分析任务，生成执行计划
3. **执行计划** - Executor 按步骤执行
4. **返回结果** - 汇总执行结果

## Planner

Planner 负责将自然语言任务转换为可执行的步骤计划。

```typescript
import { CorePlanner } from '@gtc-tech/agent-core/core';

const planner = new CorePlanner(llm, tools);

// 分析任务
const analysis = await planner.analyzeTask('处理CSV文件');
// { taskType: 'data_processing', resources: ['file'], ... }

// 生成计划
const plan = await planner.createPlan(task, context);
// { steps: [...], estimatedTime: 5000 }
```

### 步骤类型

| 类型 | 说明 |
|------|------|
| `tool` | 调用工具 |
| `llm` | 调用 LLM |
| `conditional` | 条件分支 |
| `loop` | 循环执行 |
| `parallel` | 并行执行 |

## Executor

Executor 负责执行计划中的每个步骤。

```typescript
import { Executor } from '@gtc-tech/agent-core/core';

const executor = new Executor(toolRegistry, llm, {
  maxConcurrency: 3,   // 并行执行数
  stepTimeout: 30000   // 单步超时
});

// 执行计划
const result = await executor.execute(plan, context);
```

### 执行特性

- **错误处理** - 单步失败不影响整体
- **重试机制** - 可配置自动重试
- **超时控制** - 防止任务卡死
- **并行执行** - 支持 `parallel` 类型步骤

## StateMachine

StateMachine 管理任务的状态转换。

```typescript
import { StateMachine } from '@gtc-tech/agent-core/core';

const sm = new StateMachine();

// 状态: idle → planning → executing → complete/error
sm.on('transition', (from, to) => {
  console.log(`${from} → ${to}`);
});
```

### 状态流转

```
     ┌──────────┐
     │   idle   │
     └────┬─────┘
          ↓
     ┌──────────┐
     │ planning │
     └────┬─────┘
          ↓
     ┌──────────┐     ┌─────────┐
     │executing │────→│ waiting │
     └────┬─────┘     └────┬────┘
          ↓                ↓
     ┌──────────┐     ┌─────────┐
     │ complete │     │  error  │
     └──────────┘     └─────────┘
```

## ToolRegistry

ToolRegistry 管理可用工具的注册和查找。

```typescript
import { ToolRegistry } from '@gtc-tech/agent-core/core';

const registry = new ToolRegistry();

// 注册工具
registry.register({
  name: 'my_tool',
  description: '自定义工具',
  category: 'custom',
  parameters: [...],
  execute: async (params) => { ... }
});

// 查找工具
const tool = registry.get('my_tool');

// 按类别查找
const fileTools = registry.getByCategory('filesystem');
```

## 事件系统

所有核心组件都支持事件监听：

```typescript
// Agent 事件
agent.on('plan:created', (plan) => {});
agent.on('step:start', (step) => {});
agent.on('step:complete', (step, result) => {});
agent.on('step:error', (step, error) => {});
agent.on('task:complete', (result) => {});
agent.on('task:error', (error) => {});

// StateMachine 事件
sm.on('transition', (from, to) => {});
sm.on('error', (error) => {});
```

## 下一步

- [LLM 客户端](/guide/llm-clients) - 配置不同的 LLM 提供商
- [工具系统](/guide/tools) - 创建和使用工具
- [API 文档](/api/agent) - 完整的 API 参考
