# 基础用法示例

## 简单任务执行

```typescript
import { createAgent, defaultTools } from '@gtc-tech/agent-core';
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';

// 创建 Agent
const agent = createAgent({
  llm: createOpenAIClient({ 
    apiKey: process.env.OPENAI_API_KEY 
  }),
  tools: defaultTools
});

// 执行简单任务
const result = await agent.run('计算 1+2+3+4+5 的结果');

console.log(result.output);  // 15
```

## 文件处理

```typescript
// 读取并处理文件
const result = await agent.run(`
  读取 data.csv 文件，
  解析其中的数据，
  统计每列的平均值，
  将结果保存到 result.json
`);

if (result.success) {
  console.log('处理完成:', result.summary);
}
```

## 带上下文的任务

```typescript
// 提供额外上下文
const result = await agent.run('生成报告', {
  dataSource: '/data/sales.csv',
  reportFormat: 'markdown',
  language: 'zh-CN',
  includeCharts: false
});
```

## 事件监听

```typescript
// 监听执行过程
agent.on('plan:created', (plan) => {
  console.log('📋 计划创建完成');
  plan.steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.name}`);
  });
});

agent.on('step:start', (step) => {
  console.log(`▶️  开始: ${step.name}`);
});

agent.on('step:complete', (step, result) => {
  console.log(`✅ 完成: ${step.name} (${result.duration}ms)`);
});

agent.on('step:error', (step, error) => {
  console.log(`❌ 失败: ${step.name} - ${error.message}`);
});

agent.on('task:complete', (result) => {
  console.log('🎉 任务完成!');
});

// 执行任务
await agent.run('处理数据');
```

## 超时和取消

```typescript
// 设置超时
const agent = createAgent({
  llm,
  tools: defaultTools,
  config: {
    timeout: 30000,      // 总超时 30 秒
    stepTimeout: 10000   // 单步超时 10 秒
  }
});

// 手动取消
const promise = agent.run('长时间任务');

setTimeout(() => {
  agent.stop();
  console.log('任务已取消');
}, 5000);

try {
  await promise;
} catch (error) {
  console.log('任务被中断');
}
```

## 错误处理

```typescript
try {
  const result = await agent.run('可能失败的任务');
  
  if (!result.success) {
    console.error('任务失败:', result.error);
    
    // 检查失败的步骤
    const failedSteps = result.steps.filter(s => s.status === 'failed');
    failedSteps.forEach(step => {
      console.error(`  - ${step.name}: ${step.error}`);
    });
  }
  
} catch (error) {
  // 处理系统错误
  console.error('系统错误:', error.message);
}
```

## 自定义工具

```typescript
import { createAgent } from '@gtc-tech/agent-core';
import type { Tool } from '@gtc-tech/agent-core';

// 定义自定义工具
const sendEmailTool: Tool = {
  name: 'send_email',
  description: '发送邮件',
  category: 'communication',
  parameters: [
    { name: 'to', type: 'string', required: true, description: '收件人' },
    { name: 'subject', type: 'string', required: true, description: '主题' },
    { name: 'body', type: 'string', required: true, description: '正文' }
  ],
  async execute(params) {
    // 实际发送邮件的逻辑
    console.log(`发送邮件到 ${params.to}`);
    return { success: true, data: { messageId: 'msg_123' } };
  }
};

// 使用自定义工具
const agent = createAgent({
  llm,
  tools: [sendEmailTool, ...defaultTools]
});

await agent.run('给 user@example.com 发送一封问候邮件');
```

## 筛选工具

```typescript
import { defaultTools } from '@gtc-tech/agent-core';

// 只使用安全的工具（排除文件写入和代码执行）
const safeTools = defaultTools.filter(tool => 
  !['file_write', 'code_execute'].includes(tool.name)
);

const agent = createAgent({
  llm,
  tools: safeTools
});
```

## 预定义计划

```typescript
import type { ExecutionPlan } from '@gtc-tech/agent-core';

// 手动创建执行计划
const plan: ExecutionPlan = {
  id: 'plan_custom',
  taskDescription: '数据处理流程',
  steps: [
    {
      id: 'step_1',
      name: '读取数据',
      description: '从文件读取原始数据',
      type: 'tool',
      tool: 'file_read',
      params: { path: 'input.csv' },
      status: 'pending'
    },
    {
      id: 'step_2',
      name: '解析CSV',
      description: '将CSV转换为JSON',
      type: 'tool',
      tool: 'csv_parse',
      params: { headers: true },
      dependsOn: ['step_1'],
      status: 'pending'
    },
    {
      id: 'step_3',
      name: '保存结果',
      description: '保存处理后的数据',
      type: 'tool',
      tool: 'file_write',
      params: { path: 'output.json' },
      dependsOn: ['step_2'],
      status: 'pending'
    }
  ],
  estimatedTime: 3000,
  createdAt: new Date().toISOString()
};

// 执行预定义计划
const result = await agent.runWithPlan(plan);
```

## 并行执行

```typescript
// 同时运行多个独立任务
const tasks = [
  '分析 sales.csv',
  '分析 inventory.csv',
  '分析 customers.csv'
];

const results = await Promise.all(
  tasks.map(task => agent.run(task))
);

results.forEach((result, i) => {
  console.log(`任务 ${i + 1}: ${result.success ? '成功' : '失败'}`);
});
```

## 下一步

- [CBP 合规检查示例](/examples/cbp-compliance)
- [多LLM切换示例](/examples/multi-llm)
- [WebSocket 实时示例](/examples/websocket)
