# Ollama API

Ollama 客户端用于连接本地运行的 Ollama 服务，支持 Llama、Mistral、CodeLlama 等开源模型。

## 创建客户端

```typescript
import { createOllamaClient } from '@gtc-tech/agent-core/llm';

const client = createOllamaClient({
  baseURL: 'http://localhost:11434',  // 默认地址
  model: 'llama3.2',
  keepAlive: '5m'
});
```

## 配置选项

```typescript
interface OllamaConfig {
  /** Ollama 服务器地址，默认 http://localhost:11434 */
  baseURL?: string;
  
  /** 模型名称，默认 llama3.2 */
  model?: string;
  
  /** 最大输出 token，默认 4096 */
  defaultMaxTokens?: number;
  
  /** 温度，默认 0.7 */
  defaultTemperature?: number;
  
  /** 模型保持加载时间，默认 5m */
  keepAlive?: string;
}
```

## 基本用法

```typescript
// 简单对话
const response = await client.chat([
  { role: 'user', content: '你好' }
]);

// 系统提示
const response = await client.chat([
  { role: 'system', content: '你是一个代码助手' },
  { role: 'user', content: '写一个快速排序' }
]);

// JSON 模式
const data = await client.chatJSON([
  { role: 'user', content: '返回一个用户对象' }
]);
```

## 完成选项

```typescript
interface OllamaCompletionOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  numPredict?: number;  // 最大输出 token
  stop?: string[];
  seed?: number;
  numCtx?: number;      // 上下文窗口大小
  repeatPenalty?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

const response = await client.chat(messages, {
  temperature: 0.8,
  topP: 0.9,
  numPredict: 2048,
  numCtx: 8192
});
```

## 流式输出

```typescript
for await (const chunk of client.chatStream(messages)) {
  process.stdout.write(chunk);
}
```

## 模型管理

### 列出本地模型

```typescript
const models = await client.listModels();
// [
//   { name: 'llama3.2:latest', size: 2000000000, ... },
//   { name: 'mistral:latest', size: 4100000000, ... }
// ]
```

### 拉取模型

```typescript
await client.pullModel('mistral', (status) => {
  console.log('下载进度:', status);
});
```

### 删除模型

```typescript
await client.deleteModel('old-model');
```

## 嵌入向量

```typescript
// 生成文本嵌入
const embedding = await client.embed('Hello world');
// [0.123, -0.456, 0.789, ...]

// 指定模型
const embedding = await client.embed('text', 'nomic-embed-text');
```

## 健康检查

```typescript
// 检查 Ollama 是否运行
const isRunning = await client.ping();
if (!isRunning) {
  console.error('Ollama 服务未启动');
}
```

## 常用模型

| 模型 | 大小 | 用途 |
|------|------|------|
| llama3.2 | 2B | 通用对话 |
| llama3.1 | 8B | 高质量对话 |
| mistral | 7B | 通用，快速 |
| mixtral | 47B | 高质量，MoE |
| codellama | 7B | 代码生成 |
| deepseek-coder | 6.7B | 代码生成 |
| phi3 | 3.8B | 轻量高效 |
| gemma2 | 9B | Google 模型 |
| qwen2.5 | 7B | 中文友好 |

## 错误处理

```typescript
import { OllamaError } from '@gtc-tech/agent-core/llm';

try {
  await client.chat(messages);
} catch (error) {
  if (error instanceof OllamaError) {
    if (error.isConnectionError()) {
      console.error('无法连接到 Ollama 服务');
    } else if (error.isModelNotFound()) {
      console.error('模型不存在，请先拉取');
    }
  }
}
```

## 示例

### 代码生成

```typescript
const ollama = createOllamaClient({ model: 'codellama' });

const code = await ollama.chat([
  { role: 'system', content: '你是一个 Python 专家' },
  { role: 'user', content: '实现一个二分查找算法' }
]);

console.log(code);
```

### 文档问答

```typescript
const ollama = createOllamaClient({ model: 'llama3.2' });

const answer = await ollama.chat([
  { role: 'user', content: `
    文档内容：
    ${documentContent}
    
    问题：这份文档的主要内容是什么？
  `}
]);
```

## 下一步

- [LLM 客户端概览](/guide/llm-clients)
- [OpenAI API](/api/llm-openai)
- [Gemini API](/api/llm-gemini)
