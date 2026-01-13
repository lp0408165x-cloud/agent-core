# Agent Core - NPM 发布指南

## ⚠️ 发布前必须修改

在发布前，你需要替换以下占位符：

1. **包名 `@gtc-tech/agent-core`**
   - 在 `package.json` 中替换为你的 npm scope
   - 推荐: `@your-username/agent-core` 或 `@your-org/agent-core`

2. **仓库地址 `lp0408165x-cloud/agent-core`**
   - 在 `package.json` 的 repository、homepage、bugs 中替换

3. **README中的导入示例**
   - 搜索替换所有 `@gtc-tech/agent-core`

```bash
# 快速替换示例 (替换 your-scope 为你的实际 scope)
sed -i 's/@gtc-tech/\@your-scope/g' package.json README.md
sed -i 's/lp0408165x-cloud/your-org/g' package.json
```

---

## 发布前检查清单

### 1. 代码准备
```bash
# 确保代码最新
git pull origin main

# 检查代码质量
npm run lint
npm run typecheck

# 运行测试
npm run test:run

# 运行端到端测试
npm run test:e2e
```

### 2. 版本更新
```bash
# 查看当前版本
npm version

# 更新版本 (选择一个)
npm version patch  # 1.0.0 -> 1.0.1 (bug fixes)
npm version minor  # 1.0.0 -> 1.1.0 (new features)
npm version major  # 1.0.0 -> 2.0.0 (breaking changes)
```

### 3. 更新 CHANGELOG
编辑 `CHANGELOG.md`，添加新版本的变更记录。

### 4. 构建
```bash
# 清理并构建
npm run clean
npm run build

# 检查构建输出
ls -la dist/
```

### 5. 发布预览
```bash
# 模拟发布 (不实际发布)
npm run release:dry

# 检查将要发布的文件
npm pack --dry-run
```

---

## 发布步骤

### NPM 登录
```bash
# 登录 npm (首次)
npm login

# 检查登录状态
npm whoami
```

### 发布到 NPM
```bash
# 发布公开包
npm run release

# 或手动发布
npm publish --access public
```

### 发布后
```bash
# 打标签
git tag v1.0.0
git push origin v1.0.0

# 推送代码
git push origin main
```

---

## 包结构

发布后的包结构：
```
@gtc-tech/agent-core/
├── dist/
│   ├── index.js          # CJS 主入口
│   ├── index.mjs         # ESM 主入口
│   ├── index.d.ts        # 类型声明
│   ├── index.d.mts       # ESM 类型声明
│   ├── core/             # 核心模块
│   ├── persistence/      # 持久化模块
│   ├── realtime/         # 实时通信模块
│   └── llm/              # LLM 客户端模块
├── README.md
├── LICENSE
└── CHANGELOG.md
```

---

## 安装和使用

### 安装
```bash
npm install @gtc-tech/agent-core
# 或
yarn add @gtc-tech/agent-core
# 或
pnpm add @gtc-tech/agent-core
```

### 基本使用
```typescript
import { createAgent, createOpenAIClient, defaultTools } from '@gtc-tech/agent-core';

const llm = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
});

const agent = createAgent({
  llm,
  plannerConfig: {
    model: 'gpt-4o-mini',
    maxSteps: 15,
    enableParallel: true,
    confidenceThreshold: 0.8,
    planningTimeout: 60000
  },
  executorConfig: {
    maxConcurrency: 3,
    defaultTimeout: 30000,
    retryDelay: 1000,
    maxRetries: 3
  },
  tools: defaultTools
});

const response = await agent.process('分析文档并生成报告');
console.log(response);
```

### 子模块导入
```typescript
// 仅导入核心模块
import { Agent, CorePlanner } from '@gtc-tech/agent-core/core';

// 仅导入持久化模块
import { PersistenceManager, FileStorageAdapter } from '@gtc-tech/agent-core/persistence';

// 仅导入实时模块
import { RealtimeServer, WebSocketClient } from '@gtc-tech/agent-core/realtime';

// 仅导入LLM模块
import { OpenAIClient, AnthropicClient } from '@gtc-tech/agent-core/llm';
```

---

## 版本策略

### Semantic Versioning (SemVer)

- **MAJOR (X.0.0)**: 不兼容的 API 变更
  - 删除或重命名公开 API
  - 改变函数签名
  - 改变默认行为

- **MINOR (0.X.0)**: 向后兼容的功能添加
  - 新增 API
  - 新增可选参数
  - 新增工具或适配器

- **PATCH (0.0.X)**: 向后兼容的 bug 修复
  - Bug 修复
  - 性能优化
  - 文档更新

---

## 常见问题

### Q: 发布失败 "403 Forbidden"
```bash
# 检查包名是否可用
npm search @gtc-tech/agent-core

# 确保已登录
npm login
```

### Q: 发布失败 "402 Payment Required"
```bash
# 公开发布需要 --access public
npm publish --access public
```

### Q: 类型声明缺失
```bash
# 重新构建
npm run clean
npm run build

# 检查 dist/ 中是否有 .d.ts 文件
ls dist/*.d.ts
```

### Q: 测试失败
```bash
# 查看详细错误
npm run test:run -- --reporter=verbose
```

---

## CI/CD 集成

### GitHub Actions
```yaml
# .github/workflows/publish.yml
name: Publish

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm run test:run
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 联系方式

- GitHub Issues: https://github.com/anthropic/agent-core/issues
- 文档: https://github.com/anthropic/agent-core#readme
