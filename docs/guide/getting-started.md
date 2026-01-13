# 快速开始

## 安装

::: code-group

```bash [npm]
npm install @gtc-tech/agent-core
```

```bash [pnpm]
pnpm add @gtc-tech/agent-core
```

```bash [yarn]
yarn add @gtc-tech/agent-core
```

:::

## 基本用法

### 1. 创建 Agent

```typescript
import { createAgent, defaultTools } from '@gtc-tech/agent-core';
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';

// 创建 LLM 客户端
const llm = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
});

// 创建 Agent
const agent = createAgent({
  llm,
  tools: defaultTools,
  config: {
    maxSteps: 20,
    timeout: 60000
  }
});
```

### 2. 执行任务

```typescript
// 简单任务
const result = await agent.run('分析这份数据并生成报告');

console.log(result.success);  // true
console.log(result.output);   // 任务输出
console.log(result.steps);    // 执行步骤
```

### 3. 监听事件

```typescript
agent.on('plan:created', (plan) => {
  console.log('计划创建:', plan.steps.length, '步');
});

agent.on('step:start', (step) => {
  console.log('开始执行:', step.name);
});

agent.on('step:complete', (step, result) => {
  console.log('完成:', step.name, result.duration, 'ms');
});

agent.on('task:complete', (result) => {
  console.log('任务完成!');
});
```

## 使用 CLI

Agent Core 提供开箱即用的命令行工具：

```bash
# 执行任务（使用 mock LLM）
npx agent-core run "处理数据"

# 使用 OpenAI
npx agent-core run "分析报告" --llm openai

# 使用本地 Ollama
npx agent-core run "写代码" --llm ollama --model llama3.2

# 交互模式
npx agent-core interactive

# 查看可用工具
npx agent-core list-tools
```

## 选择 LLM

Agent Core 支持多种 LLM 提供商：

```typescript
import {
  createOpenAIClient,
  createAnthropicClient,
  createGeminiClient,
  createMistralClient,
  createOllamaClient
} from '@gtc-tech/agent-core/llm';

// OpenAI
const openai = createOpenAIClient({ apiKey: '...' });

// Anthropic Claude
const claude = createAnthropicClient({ apiKey: '...' });

// Google Gemini
const gemini = createGeminiClient({ apiKey: '...' });

// Mistral
const mistral = createMistralClient({ apiKey: '...' });

// Ollama (本地，无需 API Key)
const ollama = createOllamaClient({ model: 'llama3.2' });
```

## 下一步

- [核心概念](/guide/concepts) - 了解 Agent、Planner、Executor 的工作原理
- [LLM 客户端](/guide/llm-clients) - 详细的 LLM 配置指南
- [工具系统](/guide/tools) - 创建自定义工具
- [API 文档](/api/agent) - 完整的 API 参考
