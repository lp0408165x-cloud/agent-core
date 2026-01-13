// ============================================
// Agent Core - Usage Examples
// ============================================

import {
  Agent,
  createAgent,
  defaultTools,
  LLMClient,
  LLMMessage,
  AgentConfig,
  AgentResponse,
  ToolDefinition,
  createTool
} from './index';

// ============================================
// Example 1: Simple LLM Client Implementation
// ============================================

class OpenAIClient implements LLMClient {
  private apiKey: string;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4';
  }

  async complete(prompt: string, options?: { signal?: AbortSignal }): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      }),
      signal: options?.signal
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async chat(messages: LLMMessage[], options?: { signal?: AbortSignal }): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7
      }),
      signal: options?.signal
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// ============================================
// Example 2: Create Agent with Configuration
// ============================================

async function createDocumentAnalysisAgent(): Promise<Agent> {
  const llm = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4'
  });

  const config: AgentConfig = {
    llm,
    plannerConfig: {
      model: 'gpt-4',
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
    tools: defaultTools,
    onEvent: (event) => {
      console.log(`[${event.type}]`, JSON.stringify(event.data, null, 2));
    }
  };

  return createAgent(config);
}

// ============================================
// Example 3: Custom Tool Definition
// ============================================

const pdfExtractTool: ToolDefinition = createTool()
  .name('pdf_extract')
  .description('从PDF文件中提取文本和表格')
  .category('document')
  .parameter({
    name: 'filePath',
    type: 'string',
    required: true,
    description: 'PDF文件路径'
  })
  .parameter({
    name: 'pages',
    type: 'string',
    required: false,
    description: '页码范围，如 "1-5" 或 "1,3,5"'
  })
  .parameter({
    name: 'extractTables',
    type: 'boolean',
    required: false,
    description: '是否提取表格',
    default: true
  })
  .returns('object')
  .execute(async (params) => {
    // Placeholder - would use pdf-parse or similar library
    console.log(`Extracting from PDF: ${params.filePath}`);
    return {
      text: 'Extracted text content...',
      tables: [],
      metadata: {
        pages: 1,
        author: 'Unknown'
      }
    };
  })
  .build();

const invoiceParserTool: ToolDefinition = createTool()
  .name('invoice_parse')
  .description('解析发票信息')
  .category('document')
  .parameter({
    name: 'text',
    type: 'string',
    required: true,
    description: '发票文本内容'
  })
  .returns('object')
  .execute(async (params) => {
    // Would use LLM or specialized parser
    return {
      invoiceNumber: '',
      date: '',
      vendor: '',
      buyer: '',
      items: [],
      total: 0,
      currency: 'USD'
    };
  })
  .build();

// ============================================
// Example 4: Process Task with Events
// ============================================

async function processDocumentTask() {
  const agent = await createDocumentAnalysisAgent();

  // Add custom tools
  agent.registerTool(pdfExtractTool);
  agent.registerTool(invoiceParserTool);

  // Set up event listeners
  agent.on('status', ({ state, message }) => {
    console.log(`\n📊 状态: ${state} - ${message}`);
  });

  agent.on('step:start', ({ stepId, stepName, type }) => {
    console.log(`\n▶️  开始步骤: ${stepName} (${type})`);
  });

  agent.on('step:complete', ({ result }) => {
    const status = result.status === 'success' ? '✅' : '❌';
    console.log(`${status} 完成: ${result.stepName} (${result.duration}ms)`);
  });

  agent.on('step:error', ({ result, error }) => {
    console.error(`❌ 错误: ${result.stepName} - ${error.message}`);
  });

  agent.on('plan:created', ({ plan }) => {
    console.log(`\n📋 执行计划 (${plan.steps.length} 步骤):`);
    plan.steps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step.name} [${step.type}]`);
    });
  });

  // Process task
  try {
    const response: AgentResponse = await agent.process(
      '分析上传的商业发票，提取供应商、产品、数量、价格信息，并验证总金额',
      {
        file: '/path/to/invoice.pdf',
        expectedCurrency: 'USD'
      }
    );

    if (response.success) {
      console.log('\n✅ 任务完成!');
      console.log('输出:', JSON.stringify(response.output, null, 2));
      console.log('摘要:', response.summary);
    } else {
      console.log('\n❌ 任务失败:', response.error?.message);
    }

    console.log(`\n⏱️  总耗时: ${response.duration}ms`);

  } catch (error) {
    console.error('处理错误:', error);
  }
}

// ============================================
// Example 5: Interactive Agent with Confirmation
// ============================================

async function interactiveAgent() {
  const agent = await createDocumentAnalysisAgent();

  // Handle confirmation requests
  agent.on('waiting:confirmation', ({ stepId, stepName, description }) => {
    console.log(`\n⚠️  需要确认: ${stepName}`);
    console.log(`   ${description}`);
    
    // In a real app, would prompt user
    // For demo, auto-confirm after delay
    setTimeout(() => {
      console.log('   → 自动确认');
      agent.confirm({ approved: true });
    }, 1000);
  });

  const response = await agent.process(
    '删除所有临时文件并清理缓存',
    { directory: '/tmp/cache' }
  );

  console.log('结果:', response.success ? '成功' : '失败');
}

// ============================================
// Example 6: State Machine Direct Usage
// ============================================

import { StateMachine, AgentState } from './index';

function stateMachineExample() {
  const sm = new StateMachine();

  // Listen to transitions
  sm.on('transition', ({ from, to, trigger }) => {
    console.log(`状态转换: ${from} -> ${to} (${trigger})`);
  });

  // Check current state
  console.log('当前状态:', sm.getState()); // IDLE

  // Start a task
  sm.dispatch('START_TASK', { task: '分析文档' });
  console.log('当前状态:', sm.getState()); // PLANNING

  // Simulate plan ready
  sm.updateContext({
    plan: {
      id: 'plan_1',
      taskDescription: '分析文档',
      steps: [{ id: 'step_1', type: 'tool', name: 'Read File', description: '' }],
      estimatedTime: 5000,
      createdAt: new Date()
    }
  });
  sm.dispatch('PLAN_READY');
  console.log('当前状态:', sm.getState()); // EXECUTING

  // Available triggers
  console.log('可用触发器:', sm.getAvailableTriggers());
}

// ============================================
// Example 7: Planner Direct Usage
// ============================================

import { CorePlanner, ToolRegistry } from './index';

async function plannerExample() {
  const llm = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key'
  });

  const toolRegistry = new ToolRegistry();
  toolRegistry.registerMany(defaultTools);
  toolRegistry.setLLM(llm);

  const planner = new CorePlanner(
    llm,
    {
      model: 'gpt-4',
      maxSteps: 10,
      enableParallel: true,
      confidenceThreshold: 0.8,
      planningTimeout: 30000
    },
    toolRegistry
  );

  // Create plan
  const plan = await planner.createPlan(
    '读取CSV文件，计算每列的平均值，生成报告'
  );

  console.log('生成的计划:');
  console.log(JSON.stringify(plan, null, 2));

  // Analyze plan
  const analysis = planner.analyzePlan(plan);
  console.log('计划分析:', analysis);
}

// ============================================
// Run Examples
// ============================================

// Uncomment to run:
// processDocumentTask();
// interactiveAgent();
// stateMachineExample();
// plannerExample();

export {
  OpenAIClient,
  createDocumentAnalysisAgent,
  pdfExtractTool,
  invoiceParserTool,
  processDocumentTask,
  interactiveAgent,
  stateMachineExample,
  plannerExample
};
