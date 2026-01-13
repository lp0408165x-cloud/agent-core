# 实时通信

Agent Core 支持 WebSocket 和 SSE（Server-Sent Events）两种实时通信协议。

## WebSocket

### 服务端

```typescript
import { WebSocketServer, RealtimeAgent } from '@gtc-tech/agent-core/realtime';
import { createAgent, defaultTools } from '@gtc-tech/agent-core';

// 创建基础 Agent
const agent = createAgent({ llm, tools: defaultTools });

// 包装为实时 Agent
const realtimeAgent = new RealtimeAgent(agent);

// 创建 WebSocket 服务器
const wsServer = new WebSocketServer({
  port: 8080,
  agent: realtimeAgent,
  path: '/ws'
});

wsServer.start();
```

### 客户端

```typescript
import { WebSocketClient } from '@gtc-tech/agent-core/realtime';

const client = new WebSocketClient({
  url: 'ws://localhost:8080/ws',
  autoReconnect: true,
  reconnectInterval: 3000
});

// 连接
await client.connect();

// 提交任务
client.submitTask('分析数据', { context: 'value' });

// 监听事件
client.on('plan:created', (plan) => {
  console.log('计划创建:', plan.steps.length, '步');
});

client.on('step:complete', (step, result) => {
  console.log('步骤完成:', step.name);
});

client.on('task:complete', (result) => {
  console.log('任务完成:', result.success);
});

// 取消任务
client.cancelTask();

// 断开
client.disconnect();
```

## SSE (Server-Sent Events)

### 服务端

```typescript
import { SSEServer, RealtimeAgent } from '@gtc-tech/agent-core/realtime';
import express from 'express';

const app = express();
const agent = createAgent({ llm, tools });
const realtimeAgent = new RealtimeAgent(agent);

// 创建 SSE 服务器
const sseServer = new SSEServer({
  agent: realtimeAgent
});

// 添加路由
app.get('/sse', (req, res) => {
  sseServer.handleRequest(req, res);
});

app.post('/task', express.json(), async (req, res) => {
  const { task, context, clientId } = req.body;
  await sseServer.submitTask(clientId, task, context);
  res.json({ success: true });
});

app.listen(8080);
```

### 客户端

```typescript
import { SSEClient } from '@gtc-tech/agent-core/realtime';

const client = new SSEClient({
  url: 'http://localhost:8080/sse',
  taskUrl: 'http://localhost:8080/task'
});

// 连接
await client.connect();

// 提交任务
await client.submitTask('分析数据');

// 监听事件
client.on('step:complete', (step) => {
  console.log('完成:', step.name);
});
```

## 消息协议

### 客户端 → 服务端

```typescript
// 提交任务
{ type: 'task:submit', data: { task: '...', context: {} } }

// 取消任务
{ type: 'task:cancel' }

// 确认步骤
{ type: 'step:confirm', data: { stepId: '...', approved: true } }

// 获取工具列表
{ type: 'get:tools' }
```

### 服务端 → 客户端

```typescript
// 连接成功
{ type: 'connected', timestamp: 1234567890 }

// 状态变更
{ type: 'status', data: { state: 'planning', message: '...' } }

// 计划创建
{ type: 'plan:created', data: { plan: {...} } }

// 步骤开始
{ type: 'step:start', data: { stepId: '...', stepName: '...' } }

// 步骤进度
{ type: 'step:progress', data: { stepId: '...', progress: 50, message: '...' } }

// 步骤完成
{ type: 'step:complete', data: { stepId: '...', result: {...} } }

// 任务完成
{ type: 'task:complete', data: { success: true, output: '...' } }

// 错误
{ type: 'error', data: { message: '...' } }
```

## RealtimeAgent

包装基础 Agent，添加实时事件广播：

```typescript
const realtimeAgent = new RealtimeAgent(agent, {
  broadcastInterval: 100,  // 进度广播间隔 (ms)
  bufferSize: 100          // 事件缓冲大小
});

// 添加客户端
realtimeAgent.addClient(clientId, send);

// 移除客户端
realtimeAgent.removeClient(clientId);

// 广播消息
realtimeAgent.broadcast({ type: 'custom', data: {} });
```

## 与 React UI 集成

```tsx
import { AgentPanel } from '@gtc-tech/agent-core-ui';

function App() {
  return (
    <AgentPanel
      wsUrl="ws://localhost:8080/ws"
      onTaskComplete={(result) => {
        console.log('完成:', result);
      }}
    />
  );
}
```

## 安全考虑

### 认证

```typescript
const wsServer = new WebSocketServer({
  port: 8080,
  agent: realtimeAgent,
  verifyClient: (info, callback) => {
    const token = info.req.headers['authorization'];
    if (isValidToken(token)) {
      callback(true);
    } else {
      callback(false, 401, 'Unauthorized');
    }
  }
});
```

### CORS

```typescript
const sseServer = new SSEServer({
  agent: realtimeAgent,
  cors: {
    origin: 'https://myapp.com',
    credentials: true
  }
});
```

## 示例

### 完整服务器

```typescript
import { createAgent, defaultTools } from '@gtc-tech/agent-core';
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';
import { WebSocketServer, RealtimeAgent } from '@gtc-tech/agent-core/realtime';

const llm = createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
const agent = createAgent({ llm, tools: defaultTools });
const realtimeAgent = new RealtimeAgent(agent);

const server = new WebSocketServer({
  port: 8080,
  agent: realtimeAgent
});

server.start();
console.log('Server running on ws://localhost:8080');
```

## 下一步

- [React UI](/guide/react-ui)
- [WebSocket 示例](/examples/websocket)
