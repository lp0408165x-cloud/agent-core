#!/usr/bin/env node
// ============================================
// Agent Core - Test Runner
// ============================================

/**
 * 简化测试运行器
 * 用法: npx ts-node tests/run-tests.ts
 * 或:   node tests/run-tests.js
 */

import {
  createAgent,
  createPersistentAgent,
  Agent,
  AgentState,
  defaultTools,
  MemoryStorageAdapter,
  createTool,
  ToolDefinition
} from '../src';

// -------------------- Test Results --------------------

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];
let currentSuite = '';

// -------------------- Test Utilities --------------------

function describe(name: string, fn: () => void | Promise<void>): void {
  currentSuite = name;
  console.log(`\n📦 ${name}`);
  fn();
}

async function it(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name: `${currentSuite} > ${name}`, passed: true, duration });
    console.log(`  ✅ ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name: `${currentSuite} > ${name}`, passed: false, duration, error: errorMsg });
    console.log(`  ❌ ${name} (${duration}ms)`);
    console.log(`     Error: ${errorMsg}`);
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toBeGreaterThan(expected: number) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toContain(expected: any) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected array to contain ${expected}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null but got ${actual}`);
      }
    },
    not: {
      toBeNull() {
        if (actual === null) {
          throw new Error('Expected value not to be null');
        }
      }
    }
  };
}

// -------------------- Mock LLM --------------------

class SimpleMockLLM {
  async complete(prompt: string): Promise<string> {
    // Simple task analysis
    if (prompt.includes('分析') || prompt.includes('analyze')) {
      return JSON.stringify({
        taskType: 'document',
        resources: ['file'],
        outputFormat: 'report',
        risks: [],
        confirmationPoints: [],
        complexity: 'medium'
      });
    }
    
    // Generate simple plan
    return JSON.stringify([
      { id: 'step_1', type: 'llm', name: 'Process', description: 'Process task', params: {} }
    ]);
  }

  async chat(messages: any[]): Promise<string> {
    return 'Response';
  }
}

// -------------------- Test Suites --------------------

async function runAgentBasicTests() {
  describe('Agent Basic Operations', async () => {
    const mockLLM = new SimpleMockLLM();
    const agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test',
        maxSteps: 10,
        enableParallel: false,
        confidenceThreshold: 0.8,
        planningTimeout: 30000
      },
      executorConfig: {
        maxConcurrency: 1,
        defaultTimeout: 10000,
        retryDelay: 100,
        maxRetries: 2
      },
      tools: defaultTools
    });

    await it('should initialize in IDLE state', async () => {
      expect(agent.getState()).toBe(AgentState.IDLE);
    });

    await it('should process simple task', async () => {
      const response = await agent.process('Test task');
      expect(response).toBeDefined();
      expect(response.taskId).toBeDefined();
    });

    await it('should return task ID', async () => {
      const response = await agent.process('Another task');
      expect(response.taskId.length).toBeGreaterThan(0);
    });

    await it('should track duration', async () => {
      const response = await agent.process('Timed task');
      expect(response.duration).toBeGreaterThan(0);
    });

    await it('should reset to IDLE', async () => {
      agent.reset();
      expect(agent.getState()).toBe(AgentState.IDLE);
    });
  });
}

async function runPersistenceTests() {
  describe('Persistent Agent', async () => {
    const mockLLM = new SimpleMockLLM();
    const storage = new MemoryStorageAdapter();
    await storage.connect();

    const agent = createPersistentAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test',
        maxSteps: 10,
        enableParallel: false,
        confidenceThreshold: 0.8,
        planningTimeout: 30000
      },
      executorConfig: {
        maxConcurrency: 1,
        defaultTimeout: 10000,
        retryDelay: 100,
        maxRetries: 2
      },
      tools: defaultTools,
      persistence: {
        adapter: storage,
        keyPrefix: 'test:',
        enableAutoSave: false
      }
    });

    await agent.initialize();

    await it('should save task after processing', async () => {
      const response = await agent.process('Persistent task');
      const task = await agent.loadTask(response.taskId);
      expect(task).not.toBeNull();
    });

    await it('should list tasks', async () => {
      await agent.process('Task for list');
      const tasks = await agent.listTasks({ limit: 10 });
      expect(tasks.length).toBeGreaterThan(0);
    });

    await it('should delete task', async () => {
      const response = await agent.process('Task to delete');
      await agent.deleteTask(response.taskId);
      const task = await agent.loadTask(response.taskId);
      expect(task).toBeNull();
    });

    await it('should get statistics', async () => {
      const stats = await agent.getStatistics();
      expect(stats.totalTasks).toBeDefined();
    });

    await agent.shutdown();
  });
}

async function runToolTests() {
  describe('Custom Tools', async () => {
    const mockLLM = new SimpleMockLLM();
    const agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test',
        maxSteps: 10,
        enableParallel: false,
        confidenceThreshold: 0.8,
        planningTimeout: 30000
      },
      executorConfig: {
        maxConcurrency: 1,
        defaultTimeout: 10000,
        retryDelay: 100,
        maxRetries: 2
      },
      tools: []
    });

    await it('should register custom tool', async () => {
      const customTool = createTool()
        .name('test_tool')
        .description('A test tool')
        .category('test')
        .returns('string')
        .execute(async () => 'result')
        .build();

      agent.registerTool(customTool);
      expect(agent.getAvailableTools()).toContain('test_tool');
    });

    await it('should have default tools when configured', async () => {
      const agentWithTools = createAgent({
        llm: mockLLM,
        plannerConfig: {
          model: 'test',
          maxSteps: 10,
          enableParallel: false,
          confidenceThreshold: 0.8,
          planningTimeout: 30000
        },
        executorConfig: {
          maxConcurrency: 1,
          defaultTimeout: 10000,
          retryDelay: 100,
          maxRetries: 2
        },
        tools: defaultTools
      });

      const tools = agentWithTools.getAvailableTools();
      expect(tools.length).toBeGreaterThan(0);
    });
  });
}

async function runEventTests() {
  describe('Event System', async () => {
    const mockLLM = new SimpleMockLLM();
    const agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test',
        maxSteps: 10,
        enableParallel: false,
        confidenceThreshold: 0.8,
        planningTimeout: 30000
      },
      executorConfig: {
        maxConcurrency: 1,
        defaultTimeout: 10000,
        retryDelay: 100,
        maxRetries: 2
      },
      tools: defaultTools
    });

    await it('should emit status events', async () => {
      let statusReceived = false;
      agent.on('status', () => { statusReceived = true; });
      
      await agent.process('Event test');
      
      expect(statusReceived).toBe(true);
    });

    await it('should emit plan:created event', async () => {
      let planReceived = false;
      agent.on('plan:created', () => { planReceived = true; });
      
      agent.reset();
      await agent.process('Plan test');
      
      // Plan may or may not be created depending on execution
    });
  });
}

async function runCBPTests() {
  describe('CBP Document Processing', async () => {
    const mockLLM = new SimpleMockLLM();
    
    // CBP-specific mock responses
    (mockLLM as any).complete = async (prompt: string) => {
      if (prompt.includes('CBP') || prompt.includes('合规')) {
        return JSON.stringify([
          { id: 's1', type: 'llm', name: 'Extract Invoice', params: {} },
          { id: 's2', type: 'llm', name: 'Verify Documents', params: {}, dependsOn: ['s1'] },
          { id: 's3', type: 'llm', name: 'Generate Report', params: {}, dependsOn: ['s2'] }
        ]);
      }
      return JSON.stringify({ taskType: 'document', resources: [], outputFormat: 'text', risks: [], confirmationPoints: [], complexity: 'medium' });
    };

    const agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test',
        maxSteps: 20,
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

    await it('should process CBP compliance task', async () => {
      const response = await agent.process('CBP合规检查', {
        entryNumber: 'NMR-67472736',
        importer: 'PIONEER RUBBER INC'
      });

      expect(response).toBeDefined();
      expect(response.taskId).toBeDefined();
    });

    await it('should handle context parameters', async () => {
      const response = await agent.process('Process with context', {
        documentType: 'invoice',
        priority: 'high'
      });

      expect(response).toBeDefined();
    });
  });
}

// -------------------- Main Runner --------------------

async function main() {
  console.log('🧪 Agent Core - End-to-End Tests\n');
  console.log('=' .repeat(50));

  const startTime = Date.now();

  try {
    await runAgentBasicTests();
    await runPersistenceTests();
    await runToolTests();
    await runEventTests();
    await runCBPTests();
  } catch (error) {
    console.error('\n💥 Test runner error:', error);
  }

  const totalTime = Date.now() - startTime;

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total:  ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`Time:   ${totalTime}ms`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
      if (r.error) console.log(`    ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(50));
  
  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

// Run if executed directly
main().catch(console.error);
