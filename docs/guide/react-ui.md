# React UI

Agent Core 提供精心设计的 React 组件库，用于可视化展示任务执行过程。

## 安装

```bash
npm install @gtc-tech/agent-core-ui
```

## 快速开始

```tsx
import { AgentPanel } from '@gtc-tech/agent-core-ui';
import '@gtc-tech/agent-core-ui/styles.css';

function App() {
  return (
    <AgentPanel
      wsUrl="ws://localhost:8080/ws"
      theme="light"
      onTaskComplete={(result) => {
        console.log('任务完成:', result);
      }}
    />
  );
}
```

## 组件

### AgentPanel

完整的任务面板，包含输入、计划展示、日志等功能。

```tsx
<AgentPanel
  wsUrl="ws://localhost:8080/ws"
  theme="light"  // 'light' | 'dark' | 'auto'
  className="my-panel"
  onTaskComplete={(result) => {}}
  onError={(error) => {}}
/>
```

### TaskInput

任务输入组件。

```tsx
<TaskInput
  onSubmit={(task, context) => {
    console.log('提交任务:', task);
  }}
  disabled={false}
  placeholder="输入任务描述..."
/>
```

### PlanView

执行计划展示组件。

```tsx
<PlanView
  plan={plan}
  currentStepId="step_2"
/>
```

### StepCard

单个步骤卡片。

```tsx
<StepCard
  step={step}
  index={0}
  isActive={true}
/>
```

### LogPanel

日志面板。

```tsx
<LogPanel
  logs={logs}
  maxHeight={200}
  autoScroll={true}
/>
```

### ResultView

结果展示组件。

```tsx
<ResultView
  result={result}
  onNewTask={() => {}}
/>
```

## useAgent Hook

使用 Hook 自定义 UI：

```tsx
import { useAgent } from '@gtc-tech/agent-core-ui';

function CustomUI() {
  const {
    connected,
    state,
    plan,
    currentStepId,
    result,
    logs,
    tools,
    submitTask,
    cancelTask,
    confirmStep,
    clearLogs
  } = useAgent({
    wsUrl: 'ws://localhost:8080/ws',
    autoConnect: true,
    reconnect: true,
    reconnectInterval: 3000,
    onConnect: () => console.log('已连接'),
    onDisconnect: () => console.log('已断开'),
    onError: (error) => console.error(error)
  });

  return (
    <div>
      <p>状态: {state}</p>
      <p>连接: {connected ? '是' : '否'}</p>
      
      <button onClick={() => submitTask('分析数据')}>
        开始任务
      </button>
      
      {state === 'executing' && (
        <button onClick={cancelTask}>取消</button>
      )}
      
      {plan && (
        <ul>
          {plan.steps.map(step => (
            <li key={step.id}>
              {step.name} - {step.status}
            </li>
          ))}
        </ul>
      )}
      
      {result && (
        <div>
          <h3>结果</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

## 主题定制

使用 CSS 变量自定义主题：

```css
:root {
  --agent-primary: #6366f1;
  --agent-primary-hover: #4f46e5;
  --agent-success: #10b981;
  --agent-warning: #f59e0b;
  --agent-error: #ef4444;
  --agent-info: #3b82f6;
  
  --agent-bg: #ffffff;
  --agent-bg-secondary: #f9fafb;
  --agent-bg-tertiary: #f3f4f6;
  --agent-border: #e5e7eb;
  --agent-text: #111827;
  --agent-text-secondary: #6b7280;
  --agent-text-muted: #9ca3af;
  
  --agent-radius: 8px;
  --agent-radius-lg: 12px;
}

/* 自定义深色主题 */
[data-theme="dark"] {
  --agent-bg: #1f2937;
  --agent-bg-secondary: #111827;
  --agent-text: #f9fafb;
}
```

## 服务端配置

UI 需要 WebSocket 服务器支持：

```typescript
import { WebSocketServer, RealtimeAgent } from '@gtc-tech/agent-core/realtime';
import { createAgent, defaultTools } from '@gtc-tech/agent-core';
import { createOpenAIClient } from '@gtc-tech/agent-core/llm';

// 创建 Agent
const agent = createAgent({
  llm: createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY }),
  tools: defaultTools
});

// 创建实时 Agent
const realtimeAgent = new RealtimeAgent(agent);

// 启动 WebSocket 服务器
const wsServer = new WebSocketServer({
  port: 8080,
  agent: realtimeAgent
});

wsServer.start();
console.log('WebSocket server running on ws://localhost:8080');
```

## 完整示例

```tsx
import React, { useState } from 'react';
import { AgentPanel, useAgent } from '@gtc-tech/agent-core-ui';
import '@gtc-tech/agent-core-ui/styles.css';

function App() {
  const [showPanel, setShowPanel] = useState(true);
  
  return (
    <div style={{ padding: 20 }}>
      <h1>Agent Core Demo</h1>
      
      <button onClick={() => setShowPanel(!showPanel)}>
        {showPanel ? '隐藏' : '显示'}面板
      </button>
      
      {showPanel && (
        <div style={{ height: 600, marginTop: 20 }}>
          <AgentPanel
            wsUrl="ws://localhost:8080/ws"
            theme="auto"
            onTaskComplete={(result) => {
              if (result.success) {
                alert('任务完成!');
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
```

## 下一步

- [WebSocket 示例](/examples/websocket) - 实时通信详解
- [API 文档](/api/agent) - 完整 API 参考
