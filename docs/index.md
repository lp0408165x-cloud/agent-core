---
layout: home

hero:
  name: Agent Core
  text: TypeScript LLM Agent Framework
  tagline: 构建智能自动化任务的现代框架
  image:
    src: /logo.svg
    alt: Agent Core
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: API 文档
      link: /api/agent
    - theme: alt
      text: GitHub
      link: https://github.com/anthropic/agent-core

features:
  - icon: 🤖
    title: 多LLM支持
    details: 支持 OpenAI、Anthropic、Gemini、Mistral、Ollama 等主流LLM提供商，统一接口轻松切换。
  - icon: 🛠️
    title: 丰富的工具
    details: 13个内置工具覆盖文件、网络、数据处理等场景，支持自定义扩展。
  - icon: 📊
    title: 状态管理
    details: 强大的状态机驱动执行流程，支持内存、文件、浏览器等多种持久化方式。
  - icon: ⚡
    title: 实时通信
    details: WebSocket 和 SSE 双协议支持，实现任务执行的实时监控和交互。
  - icon: 💻
    title: CLI 工具
    details: 开箱即用的命令行工具，支持任务执行、交互模式、工具列表等功能。
  - icon: ⚛️
    title: React UI
    details: 精心设计的 React 组件库，可视化展示任务执行过程。
---

## 快速体验

```bash
# 安装
npm install @gtc-tech/agent-core

# 使用 CLI
npx agent-core run "分析数据并生成报告"

# 或在代码中使用
```

```typescript
import { createAgent, defaultTools } from '@gtc-tech/agent-core';
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';

const agent = createAgent({
  llm: createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY }),
  tools: defaultTools,
});

const result = await agent.run('分析这份销售数据');
console.log(result);
```

## 为什么选择 Agent Core？

- **类型安全** - 完整的 TypeScript 支持，IDE 自动补全
- **零依赖核心** - 核心模块无外部依赖，轻量高效
- **灵活架构** - 模块化设计，按需引入
- **生产就绪** - 完善的错误处理、重试机制、速率限制
