# 状态持久化

Agent Core 支持多种持久化方式，用于保存任务状态和执行历史。

## 持久化适配器

| 适配器 | 环境 | 用途 |
|--------|------|------|
| MemoryAdapter | 通用 | 开发测试，数据存于内存 |
| FileAdapter | Node.js | 生产环境，数据存于文件 |
| LocalStorageAdapter | 浏览器 | Web 应用，小量数据 |
| IndexedDBAdapter | 浏览器 | Web 应用，大量数据 |

## 基本用法

```typescript
import { PersistentAgent } from '@gtc-tech/agent-core/persistence';
import { FileAdapter } from '@gtc-tech/agent-core/persistence/node';

// 创建持久化 Agent
const agent = new PersistentAgent({
  llm,
  tools: defaultTools,
  storage: new FileAdapter({
    directory: './agent-data',
    format: 'json'
  })
});

// 执行任务（自动保存状态）
const result = await agent.run('处理数据');

// 恢复中断的任务
const resumed = await agent.resume('task_123');
```

## MemoryAdapter

内存存储，适用于开发测试：

```typescript
import { MemoryAdapter } from '@gtc-tech/agent-core/persistence';

const adapter = new MemoryAdapter();

// 数据不会持久化，重启后丢失
```

## FileAdapter (Node.js)

文件存储，适用于 Node.js 环境：

```typescript
import { FileAdapter } from '@gtc-tech/agent-core/persistence/node';

const adapter = new FileAdapter({
  directory: './data',     // 存储目录
  format: 'json',          // 'json' | 'msgpack'
  compress: false,         // 是否压缩
  maxFiles: 1000           // 最大文件数
});

// 操作
await adapter.save('key', { data: 'value' });
const data = await adapter.load('key');
await adapter.delete('key');
const keys = await adapter.list();
```

## LocalStorageAdapter (浏览器)

localStorage 存储，适用于小量数据：

```typescript
import { LocalStorageAdapter } from '@gtc-tech/agent-core/persistence/browser';

const adapter = new LocalStorageAdapter({
  prefix: 'agent_',        // 键前缀
  maxSize: 5 * 1024 * 1024 // 最大 5MB
});
```

## IndexedDBAdapter (浏览器)

IndexedDB 存储，适用于大量数据：

```typescript
import { IndexedDBAdapter } from '@gtc-tech/agent-core/persistence/browser';

const adapter = new IndexedDBAdapter({
  dbName: 'agent-core',
  storeName: 'tasks',
  version: 1
});

await adapter.init();
```

## PersistentAgent

持久化 Agent 自动管理状态：

```typescript
import { PersistentAgent } from '@gtc-tech/agent-core/persistence';

const agent = new PersistentAgent({
  llm,
  tools,
  storage: adapter,
  config: {
    autoSave: true,          // 自动保存
    saveInterval: 5000,      // 保存间隔 (ms)
    keepHistory: 100         // 保留历史数量
  }
});

// 获取任务历史
const history = await agent.getHistory();

// 获取特定任务
const task = await agent.getTask('task_123');

// 清理历史
await agent.clearHistory({ before: Date.now() - 86400000 });
```

## 状态结构

```typescript
interface TaskState {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  task: string;
  plan?: ExecutionPlan;
  currentStep?: string;
  result?: AgentResponse;
  context?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

## 恢复中断任务

```typescript
// 任务中断后恢复
const agent = new PersistentAgent({ ... });

// 列出未完成任务
const pending = await agent.getPendingTasks();

// 恢复执行
for (const task of pending) {
  const result = await agent.resume(task.id);
  console.log(`${task.id}: ${result.success}`);
}
```

## 自定义适配器

```typescript
import type { StorageAdapter } from '@gtc-tech/agent-core/persistence';

class CustomAdapter implements StorageAdapter {
  async save(key: string, data: any): Promise<void> {
    // 保存到自定义存储
  }
  
  async load(key: string): Promise<any> {
    // 从存储加载
  }
  
  async delete(key: string): Promise<void> {
    // 删除数据
  }
  
  async list(): Promise<string[]> {
    // 列出所有键
  }
  
  async clear(): Promise<void> {
    // 清空存储
  }
}
```

## 示例

### 任务检查点

```typescript
const agent = new PersistentAgent({
  llm,
  tools,
  storage: new FileAdapter({ directory: './checkpoints' })
});

agent.on('step:complete', async (step) => {
  // 每步完成后自动保存
  console.log(`检查点: ${step.id}`);
});

// 长时间任务
const result = await agent.run('复杂的数据处理任务');

// 如果中断，可以恢复
// const result = await agent.resume('task_xxx');
```

## 下一步

- [实时通信](/guide/realtime)
- [API 文档](/api/agent)
