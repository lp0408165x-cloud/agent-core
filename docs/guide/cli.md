# CLI 工具

Agent Core 提供开箱即用的命令行工具，无需编写代码即可执行任务。

## 安装

全局安装：

```bash
npm install -g @gtc-tech/agent-core
```

或使用 npx 直接运行：

```bash
npx agent-core --help
```

## 基本命令

### run - 执行任务

```bash
# 基本用法
agent-core run "任务描述"

# 使用引号包裹复杂任务
agent-core run "读取 data.csv 文件，统计每列的平均值"
```

### interactive - 交互模式

```bash
agent-core interactive

# 进入交互式 REPL
> 分析这份数据
> 生成报告
> exit
```

### list-tools - 查看工具

```bash
agent-core list-tools

# 输出:
# FILESYSTEM
#   file_read - 读取文件内容
#   file_write - 写入文件内容
#   file_list - 列出目录文件
# WEB
#   web_search - 网络搜索
#   web_fetch - 获取网页内容
# ...
```

### version - 版本信息

```bash
agent-core version
# agent-core v1.0.0
```

### help - 帮助

```bash
agent-core help
agent-core --help
agent-core -h
```

## 选项

### --llm

指定 LLM 提供商：

```bash
# 使用 OpenAI
agent-core run "任务" --llm openai

# 使用 Anthropic
agent-core run "任务" --llm anthropic

# 使用 Gemini
agent-core run "任务" --llm gemini

# 使用 Mistral
agent-core run "任务" --llm mistral

# 使用本地 Ollama
agent-core run "任务" --llm ollama

# 使用 Mock（默认，无需 API Key）
agent-core run "任务" --llm mock
```

### --model

指定模型：

```bash
# OpenAI 模型
agent-core run "任务" --llm openai --model gpt-4o

# Gemini 模型
agent-core run "任务" --llm gemini --model gemini-1.5-pro

# Ollama 模型
agent-core run "任务" --llm ollama --model llama3.2
```

### --verbose / -v

显示详细输出：

```bash
agent-core run "任务" --verbose
agent-core run "任务" -v
```

### --max-steps

设置最大执行步骤：

```bash
agent-core run "复杂任务" --max-steps 50
```

### --timeout

设置超时时间（毫秒）：

```bash
agent-core run "任务" --timeout 120000
```

### --tools

指定使用的工具：

```bash
# 只使用文件相关工具
agent-core run "任务" --tools file_read,file_write,file_list

# 使用数据处理工具
agent-core run "任务" --tools json_parse,csv_parse,math_evaluate
```

### --ollama-url

指定 Ollama 服务器地址：

```bash
agent-core run "任务" --llm ollama --ollama-url http://192.168.1.100:11434
```

## 环境变量

在使用云端 LLM 之前，设置相应的 API Key：

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Google Gemini
export GOOGLE_API_KEY="AIza..."

# Mistral
export MISTRAL_API_KEY="..."
```

## 示例

### 数据处理

```bash
# 分析 CSV 文件
agent-core run "读取 sales.csv，计算总销售额" --llm openai

# 转换数据格式
agent-core run "将 data.json 转换为 CSV 格式" --llm gemini
```

### 文件操作

```bash
# 批量重命名
agent-core run "列出当前目录所有 .txt 文件"

# 生成报告
agent-core run "分析 logs/ 目录下的所有日志文件"
```

### 代码生成

```bash
# 使用 Ollama 本地模型
agent-core run "写一个 Python 函数计算斐波那契数列" --llm ollama --model codellama
```

### 交互式会话

```bash
# 启动交互模式
agent-core interactive --llm openai

Agent Core Interactive Mode
Type 'exit' to quit, 'clear' to reset

> 帮我分析一下今天的销售数据
[执行中...]
分析完成，总销售额 $12,345

> 生成一份周报
[执行中...]
周报已生成...

> exit
Goodbye!
```

## 输出格式

CLI 使用彩色输出显示执行状态：

```
▶ Starting task...
  Task: 分析数据文件
  LLM: openai (gpt-4o-mini)

📋 Plan created: 3 steps
  1. 读取文件
  2. 解析数据
  3. 生成统计

▶ Step 1/3: 读取文件
  ✓ Completed (125ms)

▶ Step 2/3: 解析数据
  ✓ Completed (89ms)

▶ Step 3/3: 生成统计
  ✓ Completed (234ms)

✅ Task completed successfully!
   Duration: 448ms
   Steps: 3/3 successful
```

## 错误处理

```bash
# API Key 未设置
agent-core run "任务" --llm openai
# Error: OPENAI_API_KEY environment variable not set

# Ollama 未运行
agent-core run "任务" --llm ollama
# Error: Failed to connect to Ollama at http://localhost:11434
```

## 下一步

- [React UI](/guide/react-ui) - 可视化界面
- [API 文档](/api/agent) - 编程接口
