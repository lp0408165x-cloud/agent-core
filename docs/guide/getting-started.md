# 快速开始

::: tip 5 分钟上手
本指南帮助你在 5 分钟内运行第一个 Agent 任务。
:::

## 环境要求

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **OpenAI API Key**（或其他 LLM 提供商的 Key）

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

## 环境变量配置

创建 `.env` 文件或设置环境变量：

::: code-group
```bash [Windows CMD]
set OPENAI_API_KEY=sk-proj-your-api-key-here
```
```bash [Windows PowerShell]
$env:OPENAI_API_KEY="sk-proj-your-api-key-here"
```
```bash [macOS/Linux]
export OPENAI_API_KEY=sk-proj-your-api-key-here
```

:::

## 最小可运行示例

创建 `demo.js` 文件：
```javascript
// demo.js
import { createAgent, defaultTools } from '@gtc-tech/agent-core';
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';

// 1. 创建 LLM 客户端
const llm = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
});

// 2. 创建 Agent
const agent = createAgent({
  llm,
  tools: defaultTools
});

// 3. 执行任务
const result = await agent.run('计算 123 + 456 的结果');

// 4. 输出结果
console.log('成功:', result.success);
console.log('输出:', result.output);
console.log('步骤数:', result.steps.length);
```

运行：
```bash
node demo.js
```

预期输出：
```
成功: true
输出: 579
步骤数: 3
```

## 使用 CLI（无需写代码）

Agent Core 提供开箱即用的命令行工具：
```bash
# 执行任务（使用 mock LLM 测试）
npx agent-core run "处理数据"

# 使用 OpenAI
npx agent-core run "计算 100 * 25" --llm openai

# 使用本地 Ollama（免费）
npx agent-core run "写一段代码" --llm ollama --model llama3.2

# 交互模式
npx agent-core interactive

# 查看可用工具
npx agent-core list-tools
```

## React UI 示例

安装 UI 组件包：
```bash
npm install @gtc-tech/agent-core-ui
```

在 React 项目中使用：
```tsx
// App.tsx
import { useState, useEffect } from 'react';
import { createAgent, defaultTools } from '@gtc-tech/agent-core';
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';
import { AgentPanel } from '@gtc-tech/agent-core-ui';
import '@gtc-tech/agent-core-ui/style.css';

function App() {
  const [agent, setAgent] = useState(null);

  useEffect(() => {
    const llm = createOpenAIClient({
      apiKey: 'your-api-key',
      model: 'gpt-4o-mini'
    });
    
    const newAgent = createAgent({ llm, tools: defaultTools });
    setAgent(newAgent);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Agent Core Demo</h1>
      {agent && <AgentPanel agent={agent} />}
    </div>
  );
}

export default App;
```

## 选择 LLM 提供商

Agent Core 支持多种 LLM：

| 提供商 | 模型示例 | 需要 API Key |
|--------|----------|--------------|
| OpenAI | gpt-4o-mini, gpt-4o | ✅ |
| Anthropic | claude-3-sonnet | ✅ |
| Google | gemini-pro | ✅ |
| Mistral | mistral-medium | ✅ |
| Ollama | llama3.2, qwen2.5 | ❌ 本地运行 |
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

## 监听事件
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

## 下一步

- [核心概念](/guide/concepts) - 了解 Agent、Planner、Executor 的工作原理
- [LLM 客户端](/guide/llm-clients) - 详细的 LLM 配置指南
- [工具系统](/guide/tools) - 创建自定义工具
- [API 文档](/api/agent) - 完整的 API 参考