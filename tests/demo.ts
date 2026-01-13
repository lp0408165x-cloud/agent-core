#!/usr/bin/env node
// ============================================
// Agent Core - Quick Demo
// ============================================

/**
 * 快速演示Agent Core功能
 * 运行: npx ts-node tests/demo.ts
 */

import {
  createAgent,
  createPersistentAgent,
  Agent,
  AgentState,
  defaultTools,
  MemoryStorageAdapter,
  createTool,
  formatDuration
} from '../src';

// -------------------- Mock LLM --------------------

class DemoLLM {
  private delay: number;

  constructor(delay = 200) {
    this.delay = delay;
  }

  async complete(prompt: string): Promise<string> {
    await this.sleep(this.delay);

    // Task analysis
    if (prompt.includes('分析') || prompt.includes('任务')) {
      return JSON.stringify({
        taskType: 'document',
        resources: ['invoice', 'packing_list'],
        outputFormat: 'report',
        risks: ['数据不一致', '文档缺失'],
        confirmationPoints: ['最终审核'],
        complexity: 'medium'
      });
    }

    // CBP compliance plan
    if (prompt.includes('CBP') || prompt.includes('合规')) {
      return JSON.stringify([
        {
          id: 'step_1',
          type: 'llm',
          name: '提取发票信息',
          description: '从商业发票提取关键数据',
          params: { prompt: '提取发票信息' },
          retryable: true,
          timeout: 10000
        },
        {
          id: 'step_2',
          type: 'llm',
          name: '提取装箱单信息',
          description: '从装箱单提取数量和重量',
          params: { prompt: '提取装箱单信息' },
          retryable: true,
          timeout: 10000
        },
        {
          id: 'step_3',
          type: 'llm',
          name: '交叉验证',
          description: '对比发票和装箱单数据',
          params: { prompt: '验证数据一致性' },
          dependsOn: ['step_1', 'step_2'],
          timeout: 15000
        },
        {
          id: 'step_4',
          type: 'llm',
          name: 'AD/CVD评估',
          description: '评估反倾销/反补贴风险',
          params: { prompt: '评估AD/CVD风险' },
          dependsOn: ['step_3'],
          timeout: 15000
        },
        {
          id: 'step_5',
          type: 'llm',
          name: '生成报告',
          description: '生成合规检查报告',
          params: { prompt: '生成最终报告' },
          dependsOn: ['step_4'],
          timeout: 20000
        }
      ]);
    }

    // Step execution responses
    if (prompt.includes('发票')) {
      return JSON.stringify({
        invoiceNumber: 'CI-CLDT2509-1',
        seller: 'Vietnam Tire Co.',
        buyer: 'PIONEER RUBBER INC',
        total: 26100,
        currency: 'USD',
        terms: 'DDP'
      });
    }

    if (prompt.includes('装箱单')) {
      return JSON.stringify({
        packingListNumber: 'PL-CLDT2509-1',
        totalPackages: 250,
        grossWeight: 6600,
        netWeight: 6000
      });
    }

    if (prompt.includes('验证') || prompt.includes('一致性')) {
      return JSON.stringify({
        matched: true,
        discrepancies: [],
        confidence: 0.95
      });
    }

    if (prompt.includes('AD/CVD') || prompt.includes('风险')) {
      return JSON.stringify({
        caseNumber: 'A-552-822',
        riskLevel: 'medium',
        dutyRate: 'Under review',
        recommendations: [
          '确认出口商合作状态',
          '准备付款证明链',
          '完成18点问卷'
        ]
      });
    }

    if (prompt.includes('报告')) {
      return `
# CBP合规检查报告

## 案件信息
- Entry Number: NMR-67472736
- Importer: PIONEER RUBBER INC
- Product: Passenger Tires from Vietnam

## 检查结果

### 文档验证
| 项目 | 状态 | 备注 |
|------|------|------|
| 商业发票 | ✓ | CI-CLDT2509-1 |
| 装箱单 | ✓ | PL-CLDT2509-1 |
| 数据一致性 | ✓ | 100%匹配 |

### AD/CVD评估
- 案件: A-552-822
- 风险等级: 中等
- 建议: 完善付款证明

## 结论
文档完整，建议补充付款链证明。
`;
    }

    return JSON.stringify({ status: 'completed', result: 'Task processed successfully' });
  }

  async chat(messages: any[]): Promise<string> {
    return this.complete(messages[messages.length - 1]?.content || '');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// -------------------- Demo Functions --------------------

async function demoBasicAgent() {
  console.log('\n' + '='.repeat(60));
  console.log('📦 Demo 1: Basic Agent');
  console.log('='.repeat(60));

  const llm = new DemoLLM(100);
  const agent = createAgent({
    llm,
    plannerConfig: {
      model: 'demo',
      maxSteps: 10,
      enableParallel: false,
      confidenceThreshold: 0.8,
      planningTimeout: 30000
    },
    executorConfig: {
      maxConcurrency: 1,
      defaultTimeout: 15000,
      retryDelay: 1000,
      maxRetries: 2
    },
    tools: defaultTools
  });

  console.log('\n初始状态:', agent.getState());

  // Listen to events
  agent.on('status', ({ state, message }) => {
    console.log(`\n📊 状态: ${state}${message ? ' - ' + message : ''}`);
  });

  agent.on('plan:created', ({ plan }) => {
    console.log(`\n📋 计划生成 (${plan.steps.length} 步骤):`);
    plan.steps.forEach((step: any, i: number) => {
      console.log(`   ${i + 1}. ${step.name}`);
    });
  });

  agent.on('step:start', ({ stepName }) => {
    console.log(`\n▶️  开始: ${stepName}`);
  });

  agent.on('step:complete', ({ result }) => {
    const icon = result.status === 'success' ? '✅' : '❌';
    console.log(`${icon} 完成: ${result.stepName} (${result.duration}ms)`);
  });

  // Process task
  console.log('\n🚀 开始处理任务...\n');
  const response = await agent.process('CBP合规检查', {
    entryNumber: 'NMR-67472736',
    importer: 'PIONEER RUBBER INC'
  });

  console.log('\n' + '-'.repeat(40));
  console.log('📝 结果:');
  console.log(`   任务ID: ${response.taskId}`);
  console.log(`   成功: ${response.success}`);
  console.log(`   耗时: ${formatDuration(response.duration)}`);
  
  if (response.summary) {
    console.log(`   摘要: ${response.summary}`);
  }

  agent.reset();
  console.log('\n最终状态:', agent.getState());
}

async function demoPersistentAgent() {
  console.log('\n' + '='.repeat(60));
  console.log('💾 Demo 2: Persistent Agent');
  console.log('='.repeat(60));

  const llm = new DemoLLM(100);
  const storage = new MemoryStorageAdapter();
  await storage.connect();

  const agent = createPersistentAgent({
    llm,
    plannerConfig: {
      model: 'demo',
      maxSteps: 10,
      enableParallel: false,
      confidenceThreshold: 0.8,
      planningTimeout: 30000
    },
    executorConfig: {
      maxConcurrency: 1,
      defaultTimeout: 15000,
      retryDelay: 1000,
      maxRetries: 2
    },
    tools: defaultTools,
    persistence: {
      adapter: storage,
      keyPrefix: 'demo:',
      enableAutoSave: true,
      checkpointInterval: 5000
    },
    autoCheckpoint: true,
    checkpointOnStep: true
  });

  await agent.initialize();

  agent.on('checkpoint:created', ({ checkpoint }) => {
    console.log(`💾 检查点: ${checkpoint.id} (步骤 ${checkpoint.stepIndex})`);
  });

  // Process first task
  console.log('\n🚀 处理任务 1...');
  const response1 = await agent.process('分析商业发票');
  console.log(`   任务ID: ${response1.taskId}`);

  // Process second task
  console.log('\n🚀 处理任务 2...');
  const response2 = await agent.process('验证装箱单');
  console.log(`   任务ID: ${response2.taskId}`);

  // List tasks
  const tasks = await agent.listTasks({ limit: 10 });
  console.log(`\n📋 保存的任务: ${tasks.length}`);
  tasks.forEach(task => {
    console.log(`   - ${task.id}: ${task.description} (${task.status})`);
  });

  // Get statistics
  const stats = await agent.getStatistics();
  console.log('\n📊 统计:');
  console.log(`   总任务: ${stats.totalTasks}`);
  console.log(`   已完成: ${stats.tasksByStatus.completed || 0}`);

  await agent.shutdown();
}

async function demoCustomTools() {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 Demo 3: Custom Tools');
  console.log('='.repeat(60));

  // Create custom CBP tools
  const invoiceExtractor = createTool()
    .name('extract_invoice')
    .description('提取商业发票信息')
    .category('cbp')
    .parameter({ name: 'content', type: 'string', required: true, description: '发票内容' })
    .returns('object')
    .execute(async (params) => {
      console.log('   🔍 提取发票信息...');
      return {
        invoiceNumber: 'CI-CLDT2509-1',
        date: '2024-11-15',
        total: 26100,
        currency: 'USD'
      };
    })
    .build();

  const complianceChecker = createTool()
    .name('check_compliance')
    .description('检查CBP合规性')
    .category('cbp')
    .parameter({ name: 'data', type: 'object', required: true, description: '检查数据' })
    .returns('object')
    .execute(async (params) => {
      console.log('   🔍 检查合规性...');
      return {
        passed: true,
        score: 92,
        issues: [],
        recommendations: ['补充付款证明']
      };
    })
    .build();

  const llm = new DemoLLM(100);
  const agent = createAgent({
    llm,
    plannerConfig: {
      model: 'demo',
      maxSteps: 10,
      enableParallel: false,
      confidenceThreshold: 0.8,
      planningTimeout: 30000
    },
    executorConfig: {
      maxConcurrency: 1,
      defaultTimeout: 15000,
      retryDelay: 1000,
      maxRetries: 2
    },
    tools: [invoiceExtractor, complianceChecker]
  });

  console.log('\n注册的工具:');
  agent.getAvailableTools().forEach(tool => {
    console.log(`   - ${tool}`);
  });

  console.log('\n🚀 使用自定义工具处理任务...');
  const response = await agent.process('使用自定义工具检查合规');
  console.log(`   成功: ${response.success}`);
}

async function demoEventSystem() {
  console.log('\n' + '='.repeat(60));
  console.log('📡 Demo 4: Event System');
  console.log('='.repeat(60));

  const llm = new DemoLLM(150);
  const agent = createAgent({
    llm,
    plannerConfig: {
      model: 'demo',
      maxSteps: 10,
      enableParallel: false,
      confidenceThreshold: 0.8,
      planningTimeout: 30000
    },
    executorConfig: {
      maxConcurrency: 1,
      defaultTimeout: 15000,
      retryDelay: 1000,
      maxRetries: 2
    },
    tools: defaultTools
  });

  const events: string[] = [];

  // Register all event listeners
  agent.on('status', () => events.push('status'));
  agent.on('transition', ({ from, to }) => events.push(`transition:${from}->${to}`));
  agent.on('plan:created', () => events.push('plan:created'));
  agent.on('step:start', () => events.push('step:start'));
  agent.on('step:complete', () => events.push('step:complete'));
  agent.on('task:complete', () => events.push('task:complete'));

  console.log('\n🚀 处理任务并收集事件...\n');
  await agent.process('CBP文档分析');

  console.log('📡 接收到的事件:');
  events.forEach((event, i) => {
    console.log(`   ${i + 1}. ${event}`);
  });

  console.log(`\n总事件数: ${events.length}`);
}

// -------------------- Main --------------------

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                 Agent Core - Quick Demo                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await demoBasicAgent();
    await demoPersistentAgent();
    await demoCustomTools();
    await demoEventSystem();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All demos completed successfully!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Demo error:', error);
    process.exit(1);
  }
}

main();
