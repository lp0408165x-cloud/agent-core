# 工具系统

工具是 Agent 执行任务的核心能力。Agent Core 提供 13 个内置工具，并支持自定义扩展。

## 内置工具

### 文件系统

| 工具 | 说明 |
|------|------|
| `file_read` | 读取文件内容 |
| `file_write` | 写入文件内容 |
| `file_list` | 列出目录文件 |

```typescript
// 读取文件
await tools.file_read.execute({ path: '/data/input.txt' });

// 写入文件
await tools.file_write.execute({ 
  path: '/data/output.txt',
  content: 'Hello World'
});

// 列出目录
await tools.file_list.execute({ path: '/data', recursive: true });
```

### 网络

| 工具 | 说明 |
|------|------|
| `web_search` | 网络搜索 |
| `web_fetch` | 获取网页内容 |

```typescript
// 搜索
await tools.web_search.execute({ query: 'TypeScript best practices' });

// 获取网页
await tools.web_fetch.execute({ url: 'https://example.com' });
```

### 数据处理

| 工具 | 说明 |
|------|------|
| `json_parse` | 解析 JSON |
| `json_stringify` | 序列化 JSON |
| `csv_parse` | 解析 CSV |

```typescript
// 解析 JSON
await tools.json_parse.execute({ text: '{"name": "test"}' });

// 解析 CSV
await tools.csv_parse.execute({ 
  text: 'name,age\nAlice,30\nBob,25',
  headers: true
});
```

### 文本处理

| 工具 | 说明 |
|------|------|
| `text_extract` | 提取文本模式 |
| `text_replace` | 替换文本 |

```typescript
// 提取邮箱
await tools.text_extract.execute({ 
  text: 'Contact: user@example.com',
  pattern: '[a-z]+@[a-z]+\\.[a-z]+'
});

// 替换文本
await tools.text_replace.execute({
  text: 'Hello World',
  pattern: 'World',
  replacement: 'Agent'
});
```

### 其他

| 工具 | 说明 |
|------|------|
| `code_execute` | 执行代码 |
| `math_evaluate` | 数学计算 |
| `datetime_format` | 日期格式化 |

```typescript
// 数学计算
await tools.math_evaluate.execute({ expression: '(10 + 5) * 2' });

// 日期格式化
await tools.datetime_format.execute({ 
  date: '2024-01-15',
  format: 'YYYY年MM月DD日'
});
```

## 使用默认工具

```typescript
import { createAgent, defaultTools } from '@gtc-tech/agent-core';

const agent = createAgent({
  llm,
  tools: defaultTools  // 包含所有 13 个内置工具
});
```

## 筛选工具

```typescript
import { defaultTools } from '@gtc-tech/agent-core';

// 只使用文件相关工具
const fileTools = defaultTools.filter(t => 
  t.category === 'filesystem'
);

// 排除危险工具
const safeTools = defaultTools.filter(t => 
  !['code_execute', 'file_write'].includes(t.name)
);
```

## 自定义工具

### 基本结构

```typescript
import type { Tool } from '@gtc-tech/agent-core';

const myTool: Tool = {
  name: 'my_custom_tool',
  description: '这是一个自定义工具',
  category: 'custom',
  
  parameters: [
    {
      name: 'input',
      type: 'string',
      required: true,
      description: '输入参数'
    },
    {
      name: 'options',
      type: 'object',
      required: false,
      description: '可选配置'
    }
  ],
  
  async execute(params) {
    const { input, options } = params;
    
    // 执行逻辑
    const result = processInput(input, options);
    
    return {
      success: true,
      data: result
    };
  }
};
```

### 带验证的工具

```typescript
const validatedTool: Tool = {
  name: 'validated_tool',
  description: '带参数验证的工具',
  category: 'custom',
  
  parameters: [
    {
      name: 'email',
      type: 'string',
      required: true,
      description: '邮箱地址',
      validate: (value) => {
        if (!value.includes('@')) {
          return '无效的邮箱格式';
        }
        return true;
      }
    }
  ],
  
  async execute(params) {
    // 验证已通过
    return { success: true, data: params.email };
  }
};
```

### 异步工具

```typescript
const asyncTool: Tool = {
  name: 'async_api_call',
  description: '调用外部 API',
  category: 'api',
  
  parameters: [
    { name: 'endpoint', type: 'string', required: true, description: 'API 端点' }
  ],
  
  async execute(params) {
    try {
      const response = await fetch(params.endpoint);
      const data = await response.json();
      
      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
```

## 工具注册表

```typescript
import { ToolRegistry } from '@gtc-tech/agent-core/core';

const registry = new ToolRegistry();

// 注册单个工具
registry.register(myTool);

// 批量注册
registry.registerAll([tool1, tool2, tool3]);

// 获取工具
const tool = registry.get('my_custom_tool');

// 按类别获取
const apiTools = registry.getByCategory('api');

// 获取所有工具
const allTools = registry.getAll();

// 检查工具是否存在
if (registry.has('my_tool')) {
  // ...
}

// 移除工具
registry.unregister('my_tool');
```

## 工具执行上下文

工具可以访问执行上下文：

```typescript
const contextAwareTool: Tool = {
  name: 'context_tool',
  description: '使用上下文的工具',
  category: 'custom',
  parameters: [],
  
  async execute(params, context) {
    // 访问任务信息
    const taskId = context.taskId;
    const stepId = context.stepId;
    
    // 访问共享数据
    const sharedData = context.get('sharedKey');
    
    // 设置共享数据
    context.set('resultKey', 'some value');
    
    // 访问之前步骤的结果
    const prevResult = context.getStepResult('step_1');
    
    return { success: true, data: {} };
  }
};
```

## 工具组合

```typescript
// 创建工具组合
const toolChain = createToolChain([
  { tool: 'file_read', params: { path: 'input.csv' } },
  { tool: 'csv_parse', params: { headers: true } },
  { tool: 'json_stringify', params: { pretty: true } },
  { tool: 'file_write', params: { path: 'output.json' } }
]);

// 执行链
const result = await toolChain.execute();
```

## 最佳实践

1. **明确描述** - 工具描述要清晰，帮助 LLM 理解何时使用
2. **参数验证** - 使用 validate 函数确保输入有效
3. **错误处理** - 捕获异常，返回有意义的错误信息
4. **幂等设计** - 尽可能让工具可以安全重试
5. **最小权限** - 工具只应有必要的权限

## 下一步

- [状态持久化](/guide/persistence) - 保存任务状态
- [API 文档](/api/tool-registry) - ToolRegistry API 参考
