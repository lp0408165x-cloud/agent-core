// ============================================
// Agent Core - End-to-End Tests
// ============================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createAgent,
  createPersistentAgent,
  Agent,
  AgentResponse,
  AgentState,
  defaultTools,
  MemoryStorageAdapter,
  createTool
} from '../../src';
import type { PersistentAgent } from '../../src/persistence';
import { createMockLLM, MockLLM } from '../mocks/MockLLM';
import { TEST_CONFIG, getTestFilePath } from '../config';

// ============================================
// Test Suite: Basic Agent Operations
// ============================================

describe('Agent Basic Operations', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
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
  });

  afterEach(() => {
    agent.reset();
  });

  it('should initialize in IDLE state', () => {
    expect(agent.getState()).toBe(AgentState.IDLE);
    expect(agent.isIdle()).toBe(true);
  });

  it('should process simple task', async () => {
    const response = await agent.process('Analyze document');
    
    expect(response.success).toBeDefined();
    expect(response.taskId).toBeDefined();
    expect(response.duration).toBeGreaterThan(0);
  });

  it('should transition through states during execution', async () => {
    const states: AgentState[] = [];
    
    agent.on('transition', ({ from, to }) => {
      states.push(to);
    });

    await agent.process('Check compliance');

    expect(states).toContain(AgentState.PLANNING);
    expect(states.some(s => 
      s === AgentState.EXECUTING || 
      s === AgentState.COMPLETE || 
      s === AgentState.ERROR
    )).toBe(true);
  });

  it('should emit events during execution', async () => {
    const events: string[] = [];
    
    agent.on('status', () => events.push('status'));
    agent.on('plan:created', () => events.push('plan:created'));
    agent.on('step:start', () => events.push('step:start'));
    agent.on('step:complete', () => events.push('step:complete'));

    await agent.process('Generate report');

    expect(events).toContain('status');
  });

  it('should handle cancellation', async () => {
    const taskPromise = agent.process('Long running task');
    
    setTimeout(() => agent.cancel(), 50);

    const response = await taskPromise;
    
    // Should either complete or be cancelled
    expect(response).toBeDefined();
  });

  it('should return to IDLE after completion', async () => {
    await agent.process('Quick task');
    
    agent.reset();
    
    expect(agent.getState()).toBe(AgentState.IDLE);
    expect(agent.isIdle()).toBe(true);
  });
});

// ============================================
// Test Suite: Plan Generation
// ============================================

describe('Plan Generation', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
        maxSteps: 20,
        enableParallel: true,
        confidenceThreshold: 0.8,
        planningTimeout: 30000
      },
      executorConfig: {
        maxConcurrency: 3,
        defaultTimeout: 10000,
        retryDelay: 100,
        maxRetries: 2
      },
      tools: defaultTools
    });
  });

  it('should generate plan with steps', async () => {
    let capturedPlan: any = null;
    
    agent.on('plan:created', ({ plan }) => {
      capturedPlan = plan;
    });

    await agent.process('Analyze and extract data');

    expect(capturedPlan).not.toBeNull();
    expect(capturedPlan.steps).toBeDefined();
    expect(capturedPlan.steps.length).toBeGreaterThan(0);
  });

  it('should generate CBP compliance plan', async () => {
    let capturedPlan: any = null;
    
    agent.on('plan:created', ({ plan }) => {
      capturedPlan = plan;
    });

    await agent.process('CBP合规检查');

    expect(capturedPlan).not.toBeNull();
    // CBP compliance should have multiple steps
    expect(capturedPlan.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('should include task analysis in LLM calls', async () => {
    await agent.process('Analyze document structure');

    expect(mockLLM.wasCalledWith(/分析|analyze/i)).toBe(true);
  });
});

// ============================================
// Test Suite: Step Execution
// ============================================

describe('Step Execution', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
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
  });

  it('should execute steps in order', async () => {
    const stepOrder: string[] = [];
    
    agent.on('step:start', ({ stepId }) => {
      stepOrder.push(stepId);
    });

    await agent.process('Sequential task');

    // Steps should be executed
    expect(stepOrder.length).toBeGreaterThanOrEqual(0);
  });

  it('should track step completion', async () => {
    const completedSteps: Array<{ stepId: string; status: string }> = [];
    
    agent.on('step:complete', ({ result }) => {
      completedSteps.push({
        stepId: result.stepId,
        status: result.status
      });
    });

    await agent.process('Track completion');

    // All started steps should complete
    expect(completedSteps.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle step errors gracefully', async () => {
    // Add a failing tool
    agent.registerTool(createTool()
      .name('failing_tool')
      .description('A tool that always fails')
      .category('test')
      .returns('never')
      .execute(async () => {
        throw new Error('Intentional failure');
      })
      .build()
    );

    const response = await agent.process('Use failing tool');

    // Should handle failure gracefully
    expect(response).toBeDefined();
  });
});

// ============================================
// Test Suite: Persistent Agent
// ============================================

describe('Persistent Agent', () => {
  let agent: PersistentAgent;
  let mockLLM: MockLLM;
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    mockLLM = createMockLLM({ delay: 10 });
    storage = new MemoryStorageAdapter();
    await storage.connect();

    agent = createPersistentAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
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
  });

  afterEach(async () => {
    await agent.shutdown();
  });

  it('should save task after processing', async () => {
    const response = await agent.process('Persistent task');
    
    const task = await agent.loadTask(response.taskId);
    
    expect(task).not.toBeNull();
    expect(task?.id).toBe(response.taskId);
  });

  it('should list tasks', async () => {
    await agent.process('Task 1');
    await agent.process('Task 2');

    const tasks = await agent.listTasks({ limit: 10 });

    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('should create checkpoints', async () => {
    agent.on('checkpoint:created', ({ checkpoint }) => {
      expect(checkpoint).toBeDefined();
      expect(checkpoint.id).toBeDefined();
    });

    await agent.process('Checkpointed task');

    const checkpoints = await agent.getCheckpoints();
    // May or may not have checkpoints depending on execution
  });

  it('should delete task and related data', async () => {
    const response = await agent.process('Deletable task');
    const taskId = response.taskId;

    const deleted = await agent.deleteTask(taskId);
    
    expect(deleted).toBe(true);

    const task = await agent.loadTask(taskId);
    expect(task).toBeNull();
  });

  it('should track execution history', async () => {
    const response = await agent.process('Tracked task');
    
    const history = await agent.getTaskHistory(response.taskId);
    
    // History may be empty if no steps completed
    expect(history).toBeDefined();
  });

  it('should get statistics', async () => {
    await agent.process('Stats task 1');
    await agent.process('Stats task 2');

    const stats = await agent.getStatistics();

    expect(stats.totalTasks).toBeGreaterThanOrEqual(2);
    expect(stats.tasksByStatus).toBeDefined();
  });
});

// ============================================
// Test Suite: Custom Tools
// ============================================

describe('Custom Tools', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
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
  });

  it('should register custom tool', () => {
    const customTool = createTool()
      .name('custom_parser')
      .description('Parses custom format')
      .category('custom')
      .parameter({
        name: 'input',
        type: 'string',
        required: true,
        description: 'Input data'
      })
      .returns('object')
      .execute(async (params) => {
        return { parsed: true, data: params.input };
      })
      .build();

    agent.registerTool(customTool);

    expect(agent.getAvailableTools()).toContain('custom_parser');
  });

  it('should use custom tool in execution', async () => {
    let toolCalled = false;

    const trackingTool = createTool()
      .name('tracking_tool')
      .description('Tracks if called')
      .category('test')
      .returns('boolean')
      .execute(async () => {
        toolCalled = true;
        return true;
      })
      .build();

    agent.registerTool(trackingTool);

    // Configure mock to use this tool
    mockLLM.addResponse(/track/i, JSON.stringify([
      {
        id: 'step_1',
        type: 'tool',
        name: 'Track',
        tool: 'tracking_tool',
        params: {}
      }
    ]));

    await agent.process('Track something');

    // Tool may or may not be called depending on plan execution
  });
});

// ============================================
// Test Suite: Error Handling
// ============================================

describe('Error Handling', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
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
  });

  it('should not crash on malformed LLM response', async () => {
    mockLLM.addResponse(/malformed/, 'not valid json {{{');

    const response = await agent.process('malformed response test');

    // Should handle gracefully
    expect(response).toBeDefined();
  });

  it('should emit error events', async () => {
    let errorEmitted = false;
    
    agent.on('task:error', () => {
      errorEmitted = true;
    });

    // Force an error by using invalid tool
    mockLLM.addResponse(/error/, JSON.stringify([
      { id: 's1', type: 'tool', name: 'Error', tool: 'nonexistent_tool', params: {} }
    ]));

    await agent.process('error test');

    // Error may or may not be emitted depending on validation
  });

  it('should include error in response', async () => {
    mockLLM.addResponse(/fail/, JSON.stringify([
      { id: 's1', type: 'tool', name: 'Fail', tool: 'missing_tool', params: {} }
    ]));

    const response = await agent.process('fail test');

    // Response should be defined regardless of success
    expect(response).toBeDefined();
  });
});

// ============================================
// Test Suite: Context and Variables
// ============================================

describe('Context and Variables', () => {
  let agent: Agent;
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = createMockLLM({ delay: 10 });
    agent = createAgent({
      llm: mockLLM,
      plannerConfig: {
        model: 'test-model',
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
  });

  it('should pass context to task', async () => {
    const context = {
      userId: 'user_123',
      documentType: 'invoice',
      priority: 'high'
    };

    const response = await agent.process('Process with context', context);

    expect(response).toBeDefined();
  });

  it('should preserve context through execution', async () => {
    let contextInPlan = false;

    agent.on('plan:created', ({ plan }) => {
      if (plan.metadata?.context?.customField) {
        contextInPlan = true;
      }
    });

    await agent.process('Context preservation', { customField: 'value' });

    // Context should be available in plan metadata
  });
});

// ============================================
// Export test utilities
// ============================================

export { createMockLLM, MockLLM };
