# 插件系统

Agent Core 提供灵活的插件系统，支持动态加载工具、LLM 提供商、存储适配器和中间件。

## 插件类型

| 类型 | 说明 | 用途 |
|------|------|------|
| `tool` | 工具插件 | 扩展可用工具 |
| `llm` | LLM 插件 | 添加 LLM 提供商 |
| `storage` | 存储插件 | 自定义存储后端 |
| `middleware` | 中间件插件 | 拦截执行流程 |
| `extension` | 扩展插件 | 通用扩展 |

## 快速开始

```typescript
import { createPluginManager } from '@gtc-tech/agent-core/plugins';

// 创建插件管理器
const plugins = createPluginManager();

// 加载插件
await plugins.load(myToolPlugin);
await plugins.load(myMiddlewarePlugin);

// 获取所有工具
const tools = plugins.getAllTools();

// 在 Agent 中使用
const agent = createAgent({
  llm,
  tools: [...defaultTools, ...plugins.getAllTools()]
});
```

## 工具插件

提供额外的工具：

```typescript
import type { ToolPlugin } from '@gtc-tech/agent-core/plugins';

const weatherPlugin: ToolPlugin = {
  id: 'weather-tools',
  name: 'Weather Tools',
  version: '1.0.0',
  type: 'tool',
  
  tools: [
    {
      name: 'get_weather',
      description: '获取天气信息',
      category: 'weather',
      returns: 'Weather data',
      parameters: [
        { name: 'location', type: 'string', required: true, description: '城市' }
      ],
      async execute(params) {
        // 实现
        return { success: true, data: { temp: 22, condition: 'sunny' } };
      }
    }
  ],
  
  init(context) {
    context.logger.info('Weather plugin loaded');
  }
};

// 快捷创建
import { createToolPlugin } from '@gtc-tech/agent-core/plugins';

const myPlugin = createToolPlugin('my-plugin', 'My Plugin', [
  { name: 'tool1', ... },
  { name: 'tool2', ... }
]);
```

## LLM 插件

添加自定义 LLM 提供商：

```typescript
import type { LLMPlugin } from '@gtc-tech/agent-core/plugins';

const customLLMPlugin: LLMPlugin = {
  id: 'custom-llm',
  name: 'Custom LLM',
  version: '1.0.0',
  type: 'llm',
  provider: 'custom',
  
  defaultConfig: {
    apiKey: '',
    model: 'custom-v1'
  },
  
  configSchema: {
    apiKey: { type: 'string', required: true, description: 'API Key' },
    model: { type: 'string', required: false, description: 'Model name' }
  },
  
  createClient(config) {
    return {
      async complete(prompt) {
        // 调用自定义 API
        return 'response';
      },
      async chat(messages) {
        return 'response';
      }
    };
  }
};
```

## 存储插件

自定义存储后端：

```typescript
import type { StoragePlugin } from '@gtc-tech/agent-core/plugins';

const redisPlugin: StoragePlugin = {
  id: 'redis-storage',
  name: 'Redis Storage',
  version: '1.0.0',
  type: 'storage',
  storageType: 'redis',
  
  createAdapter(config) {
    const client = createRedisClient(config);
    
    return {
      async get(key) { ... },
      async set(key, value, ttl) { ... },
      async delete(key) { ... },
      async exists(key) { ... },
      async getMany(keys) { ... },
      async setMany(entries, ttl) { ... },
      async deleteMany(keys) { ... },
      async keys(pattern) { ... },
      async clear(pattern) { ... },
      async connect() { await client.connect(); },
      async disconnect() { await client.disconnect(); },
      isConnected() { return client.isConnected; }
    };
  }
};
```

## 中间件插件

拦截任务和步骤执行：

```typescript
import type { MiddlewarePlugin } from '@gtc-tech/agent-core/plugins';

const loggingPlugin: MiddlewarePlugin = {
  id: 'logging',
  name: 'Logging Middleware',
  version: '1.0.0',
  type: 'middleware',
  priority: 10,  // 越小越先执行
  
  async beforeTask(task, context) {
    context.logger.info(`Task: ${task}`);
    context.data.set('startTime', Date.now());
    return task;  // 可修改任务
  },
  
  async afterTask(result, context) {
    const duration = Date.now() - context.data.get('startTime');
    context.logger.info(`Completed in ${duration}ms`);
    return result;  // 可修改结果
  },
  
  async beforeStep(step, context) {
    context.logger.debug(`Step: ${step.name}`);
    return step;
  },
  
  async afterStep(step, result, context) {
    return result;
  },
  
  async onError(error, context) {
    context.logger.error(`Error: ${error.message}`);
  }
};

// 快捷创建
import { createMiddlewarePlugin } from '@gtc-tech/agent-core/plugins';

const rateLimitPlugin = createMiddlewarePlugin(
  'rate-limit',
  'Rate Limit',
  {
    beforeTask: async (task, ctx) => {
      // 检查速率限制
      return task;
    }
  },
  { priority: 5 }
);
```

## 插件管理器

### 加载插件

```typescript
const plugins = createPluginManager({
  configs: {
    'my-plugin': { apiKey: '...' }
  },
  disabled: ['plugin-to-skip']
});

// 从对象加载
await plugins.load(myPlugin);

// 从模块加载
await plugins.load('./plugins/my-plugin');

// 加载多个
await plugins.loadAll([plugin1, plugin2, plugin3]);
```

### 管理插件

```typescript
// 卸载
await plugins.unload('my-plugin');

// 重载
await plugins.reload('my-plugin');

// 禁用/启用
await plugins.disable('my-plugin');
await plugins.enable('my-plugin');

// 查询
const plugin = plugins.get('my-plugin');
const status = plugins.getStatus('my-plugin');
const allPlugins = plugins.getAll();
const toolPlugins = plugins.getByType('tool');
```

### 事件

```typescript
plugins.on('plugin:loaded', (plugin) => {
  console.log(`Loaded: ${plugin.name}`);
});

plugins.on('plugin:unloaded', (plugin) => {
  console.log(`Unloaded: ${plugin.name}`);
});

plugins.on('tool:registered', ({ tool, pluginId }) => {
  console.log(`Tool ${tool.name} from ${pluginId}`);
});
```

## 插件上下文

插件初始化时获得上下文：

```typescript
const myPlugin: ToolPlugin = {
  // ...
  
  init(context) {
    // 配置
    const apiKey = context.config.apiKey;
    
    // 日志
    context.logger.info('Initializing...');
    context.logger.debug('Debug info');
    
    // 事件
    context.events.on('custom-event', handler);
    context.events.emit('ready', {});
    
    // 访问其他插件
    const otherPlugin = context.getPlugin('other-plugin');
    
    // 动态注册工具
    context.registerTool({
      name: 'dynamic_tool',
      // ...
    });
  },
  
  destroy() {
    // 清理资源
  }
};
```

## 插件清单

使用 `plugin.json` 描述插件：

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "type": "tool",
  "main": "./index.js",
  "description": "A custom plugin",
  "author": "Your Name",
  "homepage": "https://github.com/...",
  "dependencies": ["other-plugin"],
  "agentCoreVersion": ">=1.0.0",
  "configSchema": {
    "apiKey": {
      "type": "string",
      "required": true,
      "description": "API Key"
    }
  }
}
```

## 内置示例插件

```typescript
import {
  weatherToolPlugin,
  loggingMiddlewarePlugin,
  rateLimitMiddlewarePlugin,
  redisStoragePlugin,
  metricsExtensionPlugin
} from '@gtc-tech/agent-core/plugins';

await plugins.load(weatherToolPlugin);
await plugins.load(loggingMiddlewarePlugin);
```

## 下一步

- [工具系统](/guide/tools) - 创建工具
- [API 文档](/api/agent) - Agent API
