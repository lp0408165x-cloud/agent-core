# Agent Core UI

React 组件库，用于可视化 Agent Core 任务执行。

## 安装

```bash
npm install @gtc-tech/agent-core-ui
```

## 使用

### 基础用法

```tsx
import { AgentPanel } from '@gtc-tech/agent-core-ui';
import '@gtc-tech/agent-core-ui/styles.css';

function App() {
  return (
    <AgentPanel
      wsUrl="ws://localhost:8080/ws"
      theme="light"
      onTaskComplete={(result) => {
        console.log('Task completed:', result);
      }}
    />
  );
}
```

### 使用 Hook

```tsx
import { useAgent } from '@gtc-tech/agent-core-ui';

function CustomUI() {
  const {
    connected,
    state,
    plan,
    result,
    logs,
    submitTask,
    cancelTask,
  } = useAgent({
    wsUrl: 'ws://localhost:8080/ws',
  });

  return (
    <div>
      <p>状态: {state}</p>
      <button onClick={() => submitTask('分析数据')}>
        开始任务
      </button>
    </div>
  );
}
```

## 组件

| 组件 | 说明 |
|------|------|
| `AgentPanel` | 完整的任务面板（推荐） |
| `TaskInput` | 任务输入框 |
| `PlanView` | 执行计划展示 |
| `StepCard` | 单个步骤卡片 |
| `LogPanel` | 日志面板 |
| `ResultView` | 结果展示 |

## Props

### AgentPanel

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `wsUrl` | `string` | `ws://localhost:8080/ws` | WebSocket 地址 |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | 主题 |
| `onTaskComplete` | `(result) => void` | - | 任务完成回调 |
| `onError` | `(error) => void` | - | 错误回调 |
| `className` | `string` | - | 自定义类名 |

### useAgent

| 返回值 | 类型 | 说明 |
|--------|------|------|
| `connected` | `boolean` | 是否已连接 |
| `state` | `AgentState` | 当前状态 |
| `plan` | `ExecutionPlan \| null` | 执行计划 |
| `currentStepId` | `string \| null` | 当前步骤ID |
| `result` | `TaskResult \| null` | 执行结果 |
| `logs` | `LogEntry[]` | 日志 |
| `tools` | `ToolDefinition[]` | 可用工具 |
| `submitTask` | `(task, context?) => void` | 提交任务 |
| `cancelTask` | `() => void` | 取消任务 |
| `confirmStep` | `(stepId, approved) => void` | 确认步骤 |

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建库
npm run build:lib
```

## 样式定制

CSS 变量：

```css
:root {
  --agent-primary: #6366f1;
  --agent-success: #10b981;
  --agent-warning: #f59e0b;
  --agent-error: #ef4444;
  --agent-bg: #ffffff;
  --agent-text: #111827;
  /* ... */
}
```
