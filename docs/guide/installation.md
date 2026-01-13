# 安装配置

## 系统要求

- Node.js 18.0 或更高版本
- npm、pnpm 或 yarn

## 安装方式

### npm 安装

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

### 全局安装 CLI

```bash
npm install -g @gtc-tech/agent-core
```

## 模块结构

Agent Core 采用模块化设计，可以按需引入：

```typescript
// 核心模块
import { createAgent, defaultTools } from '@gtc-tech/agent-core';

// LLM 客户端
import { 
  createOpenAIClient,
  createAnthropicClient,
  createGeminiClient,
  createMistralClient,
  createOllamaClient
} from '@gtc-tech/agent-core/llm';

// 核心组件
import { 
  Agent,
  CorePlanner,
  Executor,
  StateMachine,
  ToolRegistry
} from '@gtc-tech/agent-core/core';

// 持久化
import { 
  PersistentAgent,
  MemoryAdapter,
  FileAdapter,
  LocalStorageAdapter
} from '@gtc-tech/agent-core/persistence';

// 实时通信
import { 
  RealtimeAgent,
  WebSocketServer,
  SSEServer
} from '@gtc-tech/agent-core/realtime';

// Node.js 特定
import { FileAdapter } from '@gtc-tech/agent-core/persistence/node';

// 浏览器特定
import { 
  LocalStorageAdapter,
  IndexedDBAdapter 
} from '@gtc-tech/agent-core/persistence/browser';
```

## 环境变量

根据使用的 LLM 提供商配置 API Key：

```bash
# .env 文件

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GOOGLE_API_KEY=AIza...

# Mistral
MISTRAL_API_KEY=...
```

加载环境变量：

```typescript
import 'dotenv/config';
// 或
import { config } from 'dotenv';
config();
```

## TypeScript 配置

Agent Core 完全支持 TypeScript，推荐配置：

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## ESM vs CommonJS

Agent Core 同时支持 ESM 和 CommonJS：

```javascript
// ESM
import { createAgent } from '@gtc-tech/agent-core';

// CommonJS
const { createAgent } = require('@gtc-tech/agent-core');
```

## Ollama 配置

使用本地 Ollama 时，确保服务已启动：

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 拉取模型
ollama pull llama3.2

# 启动服务（默认端口 11434）
ollama serve
```

配置远程 Ollama：

```typescript
const ollama = createOllamaClient({
  baseURL: 'http://192.168.1.100:11434',
  model: 'llama3.2'
});
```

## React UI 安装

```bash
npm install @gtc-tech/agent-core-ui
```

```tsx
import { AgentPanel } from '@gtc-tech/agent-core-ui';
import '@gtc-tech/agent-core-ui/styles.css';
```

## 验证安装

```bash
# 使用 CLI 验证
npx agent-core version

# 使用 mock LLM 测试
npx agent-core run "计算 1+1" --llm mock
```

## 常见问题

### Module not found

确保 Node.js 版本 >= 18：

```bash
node --version
```

### API Key 无效

检查环境变量是否正确设置：

```bash
echo $OPENAI_API_KEY
```

### Ollama 连接失败

确保 Ollama 服务正在运行：

```bash
ollama list
```

## 下一步

- [快速开始](/guide/getting-started) - 开始使用
- [核心概念](/guide/concepts) - 了解架构
