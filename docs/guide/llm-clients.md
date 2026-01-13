# LLM 客户端

Agent Core 支持多种 LLM 提供商，所有客户端都实现统一的接口。

## 支持的提供商

| 提供商 | 模型示例 | 特点 |
|--------|----------|------|
| OpenAI | gpt-4o, gpt-4o-mini | 功能全面，广泛使用 |
| Anthropic | claude-3-opus, claude-3-haiku | 安全性高，推理强 |
| Gemini | gemini-1.5-pro, gemini-1.5-flash | 长上下文，性价比高 |
| Mistral | mistral-large, codestral | 欧洲服务器，开源友好 |
| Ollama | llama3.2, mixtral | 本地运行，完全免费 |

## OpenAI

```typescript
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';

const client = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',           // 默认模型
  organization: 'org-xxx',         // 可选
  baseURL: 'https://api.openai.com/v1',  // 可自定义
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7
});

// 基本用法
const response = await client.chat([
  { role: 'system', content: '你是一个助手' },
  { role: 'user', content: '你好' }
]);

// JSON 模式
const data = await client.chatJSON([
  { role: 'user', content: '返回一个包含name和age的JSON对象' }
]);

// 流式输出
for await (const chunk of client.chatStream(messages)) {
  process.stdout.write(chunk);
}
```

## Anthropic

```typescript
import { createAnthropicClient } from '@gtc-tech/agent-core/llm';

const client = createAnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-haiku-20240307',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7
});

// 带系统提示
const response = await client.chatWithSystem(
  '你是一个专业的代码审查员',
  [{ role: 'user', content: '审查这段代码...' }]
);
```

## Google Gemini

```typescript
import { createGeminiClient } from '@gtc-tech/agent-core/llm';

const client = createGeminiClient({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-1.5-flash',  // 或 gemini-1.5-pro
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7
});

// Gemini 特有的安全设置
const response = await client.chat(messages, {
  safetySettings: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
  ]
});
```

## Mistral

```typescript
import { createMistralClient } from '@gtc-tech/agent-core/llm';

const client = createMistralClient({
  apiKey: process.env.MISTRAL_API_KEY,
  model: 'mistral-small-latest',  // 或 mistral-large-latest
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7
});

// 安全提示模式
const response = await client.chat(messages, {
  safePrompt: true  // 启用安全过滤
});
```

## Ollama (本地)

```typescript
import { createOllamaClient } from '@gtc-tech/agent-core/llm';

const client = createOllamaClient({
  baseURL: 'http://localhost:11434',  // Ollama 服务器地址
  model: 'llama3.2',
  keepAlive: '5m'  // 模型保持加载时间
});

// 检查服务是否运行
const isRunning = await client.ping();

// 列出本地模型
const models = await client.listModels();

// 拉取新模型
await client.pullModel('mistral', (status) => {
  console.log('下载进度:', status);
});

// 生成嵌入向量
const embedding = await client.embed('Hello world');
```

## 统一接口

所有客户端都实现 `ExtendedLLMClient` 接口：

```typescript
interface ExtendedLLMClient {
  // 基础方法
  complete(prompt: string): Promise<string>;
  chat(messages: LLMMessage[]): Promise<string>;
  
  // 扩展方法
  chatJSON<T>(): Promise<T>;
  chatStream(): AsyncGenerator<string>;
  
  // 使用统计
  getUsage(): LLMUsage;
  getCallHistory(): LLMCallRecord[];
  resetUsage(): void;
  
  // 配置
  setModel(model: string): void;
  setTemperature(temp: number): void;
  setMaxTokens(tokens: number): void;
  getAvailableModels(): string[];
}
```

## 用量追踪

```typescript
// 获取当前用量
const usage = client.getUsage();
console.log('Token 用量:', usage.totalTokens);
console.log('预估费用:', usage.estimatedCost);

// 获取调用历史
const history = client.getCallHistory();
history.forEach(call => {
  console.log(`${call.model}: ${call.duration}ms, ${call.usage.totalTokens} tokens`);
});

// 重置统计
client.resetUsage();
```

## 多提供商切换

```typescript
import { MultiProviderClient } from '@gtc-tech/agent-core/llm';

const multi = new MultiProviderClient({
  providers: {
    openai: createOpenAIClient({ apiKey: '...' }),
    claude: createAnthropicClient({ apiKey: '...' }),
    local: createOllamaClient({ model: 'llama3.2' })
  },
  default: 'openai',
  fallback: ['claude', 'local']  // 失败时降级
});

// 自动使用默认提供商
const response = await multi.chat(messages);

// 指定提供商
const response2 = await multi.chat(messages, { provider: 'claude' });
```

## 速率限制

```typescript
import { RateLimitedClient } from '@gtc-tech/agent-core/llm';

const limited = new RateLimitedClient(client, {
  requestsPerMinute: 60,
  tokensPerMinute: 100000,
  retryOnRateLimit: true,
  maxRetries: 3,
  retryDelay: 1000
});
```

## 响应缓存

```typescript
import { CachedClient } from '@gtc-tech/agent-core/llm';

const cached = new CachedClient(client, {
  enabled: true,
  ttl: 3600000,   // 1 小时
  maxSize: 1000   // 最多缓存 1000 条
});
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 |
| `GOOGLE_API_KEY` | Google Gemini API 密钥 |
| `MISTRAL_API_KEY` | Mistral API 密钥 |

## 下一步

- [工具系统](/guide/tools) - 创建和使用工具
- [API 文档](/api/llm-openai) - 完整的 LLM API 参考
